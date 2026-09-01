import { hasAnsi } from '@lpm.dev/neo.ansi'
import {
  AnsiTextView,
  TokenizedText,
  assertSafeCountedAnsiHelperInput,
  assertSafeAnsiExpansion,
  assertWidth,
  finalizeAnsiOutput,
  isWhitespaceToken,
} from '../core/ansi-text.js'
import { GraphemeIterator } from '../core/grapheme-iterator.js'
import {
  getGraphemeWidth,
  resolveStringWidthOptions,
  stringWidth,
  type ResolvedStringWidthOptions,
} from '../core/width-calculator.js'
import type { SplitOptions } from '../types.js'

type ResolvedSplitOptions = ResolvedStringWidthOptions & {
  readonly preferSplitOnSpace: boolean
  readonly preserveWhitespace: boolean
}

const SPLIT_RANGE_PAGE_SIZE = 16_384
const MAX_POOLED_SPLIT_RANGE_PAGES = 64
const MAX_ANSI_SPLIT_RANGES =
  SPLIT_RANGE_PAGE_SIZE * MAX_POOLED_SPLIT_RANGE_PAGES
const splitRangePagePool: Uint32Array[] = []

function acquireSplitRangePage(rangePageSize: number): Uint32Array {
  if (rangePageSize === SPLIT_RANGE_PAGE_SIZE) {
    const pooled = splitRangePagePool.pop()
    if (pooled !== undefined) return pooled
  }
  return new Uint32Array(rangePageSize * 2)
}

function releaseSplitRangePage(page: Uint32Array): void {
  if (
    page.length === SPLIT_RANGE_PAGE_SIZE * 2 &&
    splitRangePagePool.length < MAX_POOLED_SPLIT_RANGE_PAGES
  ) {
    splitRangePagePool.push(page)
  }
}

function resolveSplitOptions(options?: SplitOptions): ResolvedSplitOptions {
  return {
    ...resolveStringWidthOptions(options),
    preferSplitOnSpace:
      options?.preferSplitOnSpace ?? options?.wordBoundary ?? true,
    preserveWhitespace: options?.preserveWhitespace ?? false,
  }
}

function forEachPlainTextRangeByWidth(
  text: string,
  maxWidth: number,
  options: ResolvedSplitOptions,
  onRange: (start: number, end: number) => void
): boolean {
  const { preferSplitOnSpace, preserveWhitespace } = options
  let bufferStart = -1
  let bufferEnd = -1
  let bufferWidth = 0
  let firstContentStart = -1
  let lastContentEnd = -1
  let lastWhitespaceStart = -1
  let lastWhitespaceEnd = -1
  let contentEndBeforeLastWhitespace = -1
  let firstAfterLastWhitespaceStart = -1
  let widthAfterLastWhitespace = 0
  let didSplit = false

  const pushRange = (start: number, end: number): void => {
    if (start >= 0 && end > start) onRange(start, end)
  }

  const pushBuffer = (): void => {
    if (preserveWhitespace) pushRange(bufferStart, bufferEnd)
    else pushRange(firstContentStart, lastContentEnd)
  }

  const resetBuffer = (): void => {
    bufferStart = -1
    bufferEnd = -1
    bufferWidth = 0
    firstContentStart = -1
    lastContentEnd = -1
    lastWhitespaceStart = -1
    lastWhitespaceEnd = -1
    contentEndBeforeLastWhitespace = -1
    firstAfterLastWhitespaceStart = -1
    widthAfterLastWhitespace = 0
  }

  for (const segment of new GraphemeIterator(text).segments()) {
    const width = getGraphemeWidth(segment.segment, options)
    if (width > maxWidth) {
      throw new RangeError(
        `maxWidth (${maxWidth}) is smaller than an indivisible grapheme (${width})`
      )
    }
    const whitespace = /^\s+$/u.test(segment.segment)
    let consumedToken = false

    while (bufferWidth + width > maxWidth) {
      didSplit = true
      if (whitespace) {
        pushBuffer()
        resetBuffer()
        if (preserveWhitespace) {
          bufferStart = segment.index
          bufferEnd = segment.end
          bufferWidth = width
          lastWhitespaceStart = segment.index
          lastWhitespaceEnd = segment.end
        }
        consumedToken = true
        break
      }

      if (preferSplitOnSpace && lastWhitespaceStart >= 0) {
        if (preserveWhitespace) {
          pushRange(bufferStart, lastWhitespaceEnd)
        } else {
          pushRange(firstContentStart, contentEndBeforeLastWhitespace)
        }

        bufferStart = lastWhitespaceEnd
        bufferWidth = widthAfterLastWhitespace
        firstContentStart = firstAfterLastWhitespaceStart
        if (firstContentStart < 0) lastContentEnd = -1
        lastWhitespaceStart = -1
        lastWhitespaceEnd = -1
        contentEndBeforeLastWhitespace = -1
        firstAfterLastWhitespaceStart = -1
        widthAfterLastWhitespace = 0
        continue
      }

      pushBuffer()
      resetBuffer()
    }

    if (consumedToken) continue

    if (bufferStart < 0) bufferStart = segment.index
    bufferEnd = segment.end
    bufferWidth += width
    if (whitespace) {
      lastWhitespaceStart = segment.index
      lastWhitespaceEnd = segment.end
      contentEndBeforeLastWhitespace = lastContentEnd
      firstAfterLastWhitespaceStart = -1
      widthAfterLastWhitespace = 0
    } else {
      if (firstContentStart < 0) firstContentStart = segment.index
      lastContentEnd = segment.end
      if (lastWhitespaceStart >= 0) {
        widthAfterLastWhitespace += width
        if (firstAfterLastWhitespaceStart < 0) {
          firstAfterLastWhitespaceStart = segment.index
        }
      }
    }
  }

  if (!didSplit) return false
  pushBuffer()
  return true
}

function splitPlainTextByWidth(
  text: string,
  maxWidth: number,
  options: ResolvedSplitOptions
): string[] {
  const result: string[] = []
  const didSplit = forEachPlainTextRangeByWidth(
    text,
    maxWidth,
    options,
    (start, end) => result.push(text.slice(start, end))
  )
  if (!didSplit) return [text]
  return result
}

function findLastWhitespace(text: TokenizedText, start: number, end: number): number {
  for (let index = end - 1; index >= start; index--) {
    if (isWhitespaceToken(text.tokens[index]!)) return index
  }
  return -1
}

function trimRange(
  text: TokenizedText,
  start: number,
  end: number
): [number, number] {
  while (
    start < end &&
    (text.tokens[start]!.ansiOnly || isWhitespaceToken(text.tokens[start]!))
  ) {
    start++
  }
  while (
    end > start &&
    (text.tokens[end - 1]!.ansiOnly || isWhitespaceToken(text.tokens[end - 1]!))
  ) {
    end--
  }
  return [start, end]
}

function splitSparseAnsiByWidth(
  source: AnsiTextView,
  originalText: string,
  maxWidth: number,
  options: ResolvedSplitOptions
): string[] {
  let renderedOutputLength = 0
  const rangePageSize = Math.max(
    1,
    Math.min(SPLIT_RANGE_PAGE_SIZE, source.plainText.length)
  )
  const rangePages: Uint32Array[] = []
  let rangeCount = 0

  try {
    const didSplit = forEachPlainTextRangeByWidth(
      source.plainText,
      maxWidth,
      options,
      (start, end) => {
        if (rangeCount >= MAX_ANSI_SPLIT_RANGES) {
          throw new RangeError('ANSI split output contains too many chunks')
        }
        const pageOffset = rangeCount % rangePageSize
        if (pageOffset === 0) {
          rangePages.push(acquireSplitRangePage(rangePageSize))
        }
        const page = rangePages[rangePages.length - 1]!
        page[pageOffset * 2] = start
        page[pageOffset * 2 + 1] = end
        rangeCount++
        const boundaries = {
          includeStartSequences: start === 0,
          includeEndSequences: true,
        }
        const renderedLength = source.renderLength(start, end, boundaries)
        source.assertSafeRender(start, end, boundaries)
        assertSafeAnsiExpansion(
          source.sourceLength,
          renderedOutputLength + renderedLength
        )
        renderedOutputLength += renderedLength
      }
    )
    if (!didSplit) return [originalText]

    const result: string[] = []
    for (let index = 0; index < rangeCount; index++) {
      const page = rangePages[Math.floor(index / rangePageSize)]!
      const pageOffset = index % rangePageSize
      const start = page[pageOffset * 2]!
      const end = page[pageOffset * 2 + 1]!
      result.push(
        source.render(start, end, {
          includeStartSequences: start === 0,
          includeEndSequences: true,
        })
      )
    }
    return result
  } finally {
    for (const page of rangePages) releaseSplitRangePage(page)
  }
}

export function splitByWidth(
  text: string,
  maxWidth: number,
  options?: SplitOptions
): string[] {
  assertWidth(maxWidth, 'maxWidth', { allowZero: false })
  if (text === '') return []

  const resolved = resolveSplitOptions(options)
  const { preferSplitOnSpace, preserveWhitespace } = resolved
  if (!hasAnsi(text)) return splitPlainTextByWidth(text, maxWidth, resolved)

  if (resolved.countAnsiEscapeCodes) {
    assertSafeCountedAnsiHelperInput(text)
  }

  const sparseSource = new AnsiTextView(text)
  if (!resolved.countAnsiEscapeCodes) {
    return splitSparseAnsiByWidth(sparseSource, text, maxWidth, resolved)
  }

  if (stringWidth(text, resolved) <= maxWidth) return [text]

  const source = new TokenizedText(text, resolved, {
    renderLengths: true,
    visibleTokens: resolved.countAnsiEscapeCodes,
  })
  for (const token of source.tokens) {
    if (token.width > maxWidth) {
      throw new RangeError(
        `maxWidth (${maxWidth}) is smaller than an indivisible grapheme (${token.width})`
      )
    }
  }

  const result: string[] = []
  let renderedOutputLength = 0
  const pushRenderedRange = (start: number, end: number): void => {
    const renderedLength = source.renderLength(start, end)
    assertSafeAnsiExpansion(text.length, renderedOutputLength + renderedLength)
    result.push(finalizeAnsiOutput(source.render(start, end)))
    renderedOutputLength += renderedLength
  }
  const pushRange = (rangeStart: number, rangeEnd: number): void => {
    const [start, end] = preserveWhitespace
      ? [rangeStart, rangeEnd]
      : trimRange(source, rangeStart, rangeEnd)
    if (start >= end) return

    if (!source.options.countAnsiEscapeCodes) {
      pushRenderedRange(start, end)
      return
    }

    if (!source.hasVisibleTokens(start, end)) {
      throw new RangeError(
        `maxWidth (${maxWidth}) cannot contain an ANSI-balanced grapheme`
      )
    }

    let cursor = start
    while (cursor < end) {
      let candidateEnd = end
      while (
        candidateEnd > cursor &&
        (source.renderWidth(cursor, candidateEnd) > maxWidth ||
          !source.hasVisibleTokens(cursor, candidateEnd))
      ) {
        candidateEnd--
      }
      if (candidateEnd === cursor) {
        throw new RangeError(
          `maxWidth (${maxWidth}) cannot contain an ANSI-balanced grapheme`
        )
      }
      pushRenderedRange(cursor, candidateEnd)
      cursor = candidateEnd
    }
  }

  let chunkStart = 0
  let currentWidth = 0
  let lastWhitespace = -1
  let index = 0

  while (index < source.tokens.length) {
    const token = source.tokens[index]!
    if (currentWidth + token.width <= maxWidth) {
      currentWidth += token.width
      if (isWhitespaceToken(token)) lastWhitespace = index
      index++
      continue
    }

    if (isWhitespaceToken(token)) {
      pushRange(chunkStart, index)
      if (preserveWhitespace) {
        chunkStart = index
      } else {
        index++
        chunkStart = index
      }
      currentWidth = 0
      lastWhitespace = -1
      continue
    }

    if (preferSplitOnSpace && lastWhitespace >= chunkStart) {
      pushRange(
        chunkStart,
        preserveWhitespace ? lastWhitespace + 1 : lastWhitespace
      )
      chunkStart = lastWhitespace + 1
      currentWidth = source.rangeWidth(chunkStart, index)
      lastWhitespace = findLastWhitespace(source, chunkStart, index)
      continue
    }

    pushRange(chunkStart, index)
    chunkStart = index
    currentWidth = 0
    lastWhitespace = -1
  }

  pushRange(chunkStart, source.tokens.length)
  return result
}
