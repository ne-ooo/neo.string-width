import { hasAnsi } from '@lpm.dev/neo.ansi'
import {
  TokenizedText,
  assertWidth,
  isWhitespaceToken,
} from '../core/ansi-text.js'
import { GraphemeIterator } from '../core/grapheme-iterator.js'
import {
  getGraphemeWidth,
  resolveStringWidthOptions,
} from '../core/width-calculator.js'
import type { SplitOptions } from '../types.js'

interface PlainToken {
  readonly text: string
  readonly width: number
  readonly whitespace: boolean
}

function splitPlainTextByWidth(
  text: string,
  maxWidth: number,
  options?: SplitOptions
): string[] {
  const preferSplitOnSpace =
    options?.preferSplitOnSpace ?? options?.wordBoundary ?? true
  const preserveWhitespace = options?.preserveWhitespace ?? false
  const resolved = resolveStringWidthOptions(options)
  const result: string[] = []
  let buffer: PlainToken[] = []
  let bufferWidth = 0
  let lastWhitespace = -1
  let didSplit = false

  const push = (tokens: readonly PlainToken[]): void => {
    let start = 0
    let end = tokens.length
    if (!preserveWhitespace) {
      while (start < end && tokens[start]!.whitespace) start++
      while (end > start && tokens[end - 1]!.whitespace) end--
    }
    if (start < end) {
      result.push(tokens.slice(start, end).map((token) => token.text).join(''))
    }
  }

  const findWhitespace = (): number => {
    for (let index = buffer.length - 1; index >= 0; index--) {
      if (buffer[index]!.whitespace) return index
    }
    return -1
  }

  for (const segment of new GraphemeIterator(text)) {
    const width = getGraphemeWidth(segment, resolved)
    if (width > maxWidth) {
      throw new RangeError(
        `maxWidth (${maxWidth}) is smaller than an indivisible grapheme (${width})`
      )
    }
    const token: PlainToken = {
      text: segment,
      width,
      whitespace: /^\s+$/u.test(segment),
    }
    let consumedToken = false

    while (bufferWidth + token.width > maxWidth) {
      didSplit = true
      if (token.whitespace) {
        push(buffer)
        buffer = preserveWhitespace ? [token] : []
        bufferWidth = preserveWhitespace ? token.width : 0
        lastWhitespace = preserveWhitespace ? 0 : -1
        consumedToken = true
        break
      }

      if (preferSplitOnSpace && lastWhitespace >= 0) {
        push(
          buffer.slice(
            0,
            preserveWhitespace ? lastWhitespace + 1 : lastWhitespace
          )
        )
        buffer = buffer.slice(lastWhitespace + 1)
        bufferWidth = buffer.reduce((total, item) => total + item.width, 0)
        lastWhitespace = findWhitespace()
        continue
      }

      push(buffer)
      buffer = []
      bufferWidth = 0
      lastWhitespace = -1
    }

    if (consumedToken) continue
    buffer.push(token)
    bufferWidth += token.width
    if (token.whitespace) lastWhitespace = buffer.length - 1
  }

  if (!didSplit) return [text]
  push(buffer)
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

export function splitByWidth(
  text: string,
  maxWidth: number,
  options?: SplitOptions
): string[] {
  assertWidth(maxWidth, 'maxWidth', { allowZero: false })
  if (text === '') return []

  const preferSplitOnSpace =
    options?.preferSplitOnSpace ?? options?.wordBoundary ?? true
  const preserveWhitespace = options?.preserveWhitespace ?? false
  if (!hasAnsi(text)) return splitPlainTextByWidth(text, maxWidth, options)

  const source = new TokenizedText(text, options)
  if (source.width <= maxWidth) return [text]

  for (const token of source.tokens) {
    if (token.width > maxWidth) {
      throw new RangeError(
        `maxWidth (${maxWidth}) is smaller than an indivisible grapheme (${token.width})`
      )
    }
  }

  const result: string[] = []
  const pushRange = (rangeStart: number, rangeEnd: number): void => {
    const [start, end] = preserveWhitespace
      ? [rangeStart, rangeEnd]
      : trimRange(source, rangeStart, rangeEnd)
    if (start >= end) return

    if (!source.options.countAnsiEscapeCodes) {
      result.push(source.render(start, end))
      return
    }

    let cursor = start
    while (cursor < end) {
      let candidateEnd = end
      while (
        candidateEnd > cursor &&
        (source.renderWidth(cursor, candidateEnd) > maxWidth ||
          !source.tokens
            .slice(cursor, candidateEnd)
            .some((token) => !token.ansiOnly))
      ) {
        candidateEnd--
      }
      if (candidateEnd === cursor) {
        throw new RangeError(
          `maxWidth (${maxWidth}) cannot contain an ANSI-balanced grapheme`
        )
      }
      result.push(source.render(cursor, candidateEnd))
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
