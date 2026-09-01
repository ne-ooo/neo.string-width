import { hasAnsi } from '@lpm.dev/neo.ansi'
import {
  AnsiTextView,
  TokenizedText,
  assertSafeCountedAnsiHelperInput,
  assertWidth,
  finalizeAnsiOutput,
  isWhitespaceToken,
} from '../core/ansi-text.js'
import { isPrintableAsciiOnly } from '../core/constants.js'
import { GraphemeIterator } from '../core/grapheme-iterator.js'
import {
  getGraphemeWidth,
  resolveStringWidthOptions,
  stringWidth,
} from '../core/width-calculator.js'
import type { TruncateOptions } from '../types.js'

const DEFAULT_OPTIONS = {
  position: 'end' as const,
  ellipsis: '…',
  wordBoundary: false,
}

function truncatePrintableText(
  plain: string,
  originalText: string,
  width: number,
  options: TruncateOptions &
    Required<Pick<TruncateOptions, 'position' | 'wordBoundary'>>,
  renderPrefix: (end: number) => string,
  renderSuffix: (start: number, prefixEnd: number) => string
): string {
  const ellipsis = new TokenizedText(options.ellipsis ?? '', options)
  const ellipsisTooWide = ellipsis.renderWidth() > width
  const renderedEllipsis = renderPrefixWithin(ellipsis, width)
  if (plain.length <= width) return originalText
  if (ellipsisTooWide) return renderedEllipsis.text

  const availableWidth = width - renderedEllipsis.width
  if (options.position === 'start') {
    let start = Math.max(0, plain.length - availableWidth)
    if (options.wordBoundary) {
      const whitespace = plain.indexOf(' ', start)
      if (whitespace >= 0) start = whitespace
    }
    return renderedEllipsis.text + renderSuffix(start, -1)
  }

  if (options.position === 'middle') {
    const prefixWidth = Math.floor(availableWidth / 2)
    const suffixWidth = availableWidth - prefixWidth
    let end = Math.min(prefixWidth, plain.length)
    let start = Math.max(end, plain.length - suffixWidth)
    if (options.wordBoundary) {
      const prefixWhitespace = plain.lastIndexOf(' ', end - 1)
      if (prefixWhitespace > 0) end = prefixWhitespace
      const suffixWhitespace = plain.indexOf(' ', start)
      if (suffixWhitespace >= 0) start = suffixWhitespace
    }
    return (
      renderPrefix(end) +
      renderedEllipsis.text +
      renderSuffix(start, end)
    )
  }

  let end = Math.min(availableWidth, plain.length)
  if (options.wordBoundary) {
    const whitespace = plain.lastIndexOf(' ', end - 1)
    if (whitespace > 0) end = whitespace
  }
  return renderPrefix(end) + renderedEllipsis.text
}

function prefixEnd(text: TokenizedText, width: number): number {
  let currentWidth = 0
  let end = 0
  for (const token of text.tokens) {
    if (currentWidth + token.width > width) break
    currentWidth += token.width
    end++
  }
  return end
}

function suffixStart(text: TokenizedText, width: number): number {
  let currentWidth = 0
  let start = text.tokens.length
  for (let index = text.tokens.length - 1; index >= 0; index--) {
    const token = text.tokens[index]!
    if (currentWidth + token.width > width) break
    currentWidth += token.width
    start = index
  }
  return start
}

function prefixWordBoundary(text: TokenizedText, end: number): number {
  let firstContent = 0
  while (firstContent < end && text.tokens[firstContent]!.ansiOnly) {
    firstContent++
  }
  for (let index = end - 1; index > firstContent; index--) {
    if (isWhitespaceToken(text.tokens[index]!)) return index
  }
  return end
}

function suffixWordBoundary(text: TokenizedText, start: number): number {
  for (let index = start; index < text.tokens.length; index++) {
    if (isWhitespaceToken(text.tokens[index]!)) return index
  }
  return start
}

interface RenderedPrefix {
  readonly text: string
  readonly width: number
}

function renderPrefixWithin(text: TokenizedText, width: number): RenderedPrefix {
  let end = prefixEnd(text, width)
  while (end > 0 && text.renderWidth(0, end) > width) end--
  return {
    text: text.render(0, end),
    width: text.renderWidth(0, end),
  }
}

interface PlainSuffixStart {
  readonly offset: number
  readonly tokenIndex: number
}

function findPlainSuffixStart(
  text: string,
  totalWidth: number,
  width: number,
  options: ReturnType<typeof resolveStringWidthOptions>,
  minimumTokenIndex: number,
  wordBoundary: boolean
): PlainSuffixStart {
  let remainingWidth = totalWidth
  let offset = 0
  let tokenIndex = 0

  for (const segment of new GraphemeIterator(text).segments()) {
    if (remainingWidth > width) {
      remainingWidth -= getGraphemeWidth(segment.segment, options)
      offset = segment.end
      tokenIndex++
      continue
    }
    if (tokenIndex < minimumTokenIndex) {
      offset = segment.end
      tokenIndex++
      continue
    }
    if (!wordBoundary) return { offset, tokenIndex }
    if (/^\s+$/u.test(segment.segment)) {
      return { offset: segment.index, tokenIndex }
    }
  }
  return { offset, tokenIndex }
}

function truncatePlainText(
  text: string,
  width: number,
  options: TruncateOptions,
  ellipsis: RenderedPrefix,
  ellipsisTooWide: boolean
): string {
  const resolved = resolveStringWidthOptions(options)
  const availableWidth = width - ellipsis.width
  const prefixLimit =
    options.position === 'middle'
      ? Math.floor(availableWidth / 2)
      : availableWidth
  const suffixLimit =
    options.position === 'middle'
      ? availableWidth - prefixLimit
      : availableWidth
  const keepPrefix = options.position !== 'start'
  let prefixWidth = 0
  let prefixEndOffset = 0
  let prefixTokenCount = 0
  let prefixWordBoundaryOffset = -1
  let totalWidth = 0
  let prefixClosed = false
  let tokenIndex = 0

  for (const segment of new GraphemeIterator(text).segments()) {
    const tokenWidth = getGraphemeWidth(segment.segment, resolved)
    totalWidth += tokenWidth

    if (
      keepPrefix &&
      !prefixClosed &&
      prefixWidth + tokenWidth <= prefixLimit
    ) {
      prefixWidth += tokenWidth
      prefixEndOffset = segment.end
      prefixTokenCount = tokenIndex + 1
      if (tokenIndex > 0 && /^\s+$/u.test(segment.segment)) {
        prefixWordBoundaryOffset = segment.index
      }
    } else if (keepPrefix) {
      prefixClosed = true
    }
    tokenIndex++
  }

  if (totalWidth <= width) return text
  if (ellipsisTooWide) return ellipsis.text

  let effectivePrefixEnd = prefixEndOffset
  if (options.wordBoundary && prefixWordBoundaryOffset >= 0) {
    effectivePrefixEnd = prefixWordBoundaryOffset
  }

  if (options.position === 'end') {
    return text.slice(0, effectivePrefixEnd) + ellipsis.text
  }

  const suffix = findPlainSuffixStart(
    text,
    totalWidth,
    suffixLimit,
    resolved,
    options.position === 'middle' ? prefixTokenCount : 0,
    options.wordBoundary ?? false
  )
  const suffixOffset = suffix.offset

  if (options.position === 'start') {
    return ellipsis.text + text.slice(suffixOffset)
  }

  return (
    text.slice(0, effectivePrefixEnd) +
    ellipsis.text +
    text.slice(suffixOffset)
  )
}

function truncateSparseAnsi(
  source: AnsiTextView,
  originalText: string,
  width: number,
  options: TruncateOptions &
    Required<Pick<TruncateOptions, 'position' | 'wordBoundary'>>
): string {
  const ellipsis = new TokenizedText(options.ellipsis ?? '', options)
  const ellipsisTooWide = ellipsis.renderWidth() > width
  const renderedEllipsis = renderPrefixWithin(ellipsis, width)
  const availableWidth = width - renderedEllipsis.width
  const plain = source.plainText
  const widthOptions = resolveStringWidthOptions(options)
  const prefixLimit =
    options.position === 'middle'
      ? Math.floor(availableWidth / 2)
      : availableWidth
  const suffixLimit =
    options.position === 'middle'
      ? availableWidth - prefixLimit
      : availableWidth
  const keepPrefix = options.position !== 'start'
  let prefixWidth = 0
  let prefixEndOffset = 0
  let prefixTokenCount = 0
  let prefixWordBoundaryOffset = -1
  let prefixClosed = false
  let tokenIndex = 0
  let totalWidth = 0

  for (const segment of new GraphemeIterator(plain).segments()) {
    const tokenWidth = getGraphemeWidth(segment.segment, widthOptions)
    totalWidth += tokenWidth
    if (
      keepPrefix &&
      !prefixClosed &&
      prefixWidth + tokenWidth <= prefixLimit
    ) {
      prefixWidth += tokenWidth
      prefixEndOffset = segment.end
      prefixTokenCount = tokenIndex + 1
      if (tokenIndex > 0 && /^\s+$/u.test(segment.segment)) {
        prefixWordBoundaryOffset = segment.index
      }
    } else if (keepPrefix) {
      prefixClosed = true
    }
    tokenIndex++
  }

  if (totalWidth <= width) return originalText
  if (ellipsisTooWide) return renderedEllipsis.text

  let effectivePrefixEnd = prefixEndOffset
  if (options.wordBoundary && prefixWordBoundaryOffset >= 0) {
    effectivePrefixEnd = prefixWordBoundaryOffset
  }
  const inclusiveBoundaries = {
    includeStartSequences: true,
    includeEndSequences: true,
  }

  if (options.position === 'start') {
    const suffix = findPlainSuffixStart(
      plain,
      totalWidth,
      suffixLimit,
      widthOptions,
      0,
      options.wordBoundary
    )
    return (
      renderedEllipsis.text +
      source.render(suffix.offset, plain.length, inclusiveBoundaries)
    )
  }

  if (options.position === 'middle') {
    const suffix = findPlainSuffixStart(
      plain,
      totalWidth,
      suffixLimit,
      widthOptions,
      prefixTokenCount,
      options.wordBoundary
    )
    const suffixBoundaries = {
      includeStartSequences: suffix.offset !== effectivePrefixEnd,
      includeEndSequences: true,
    }
    return (
      source.render(0, effectivePrefixEnd, inclusiveBoundaries) +
      renderedEllipsis.text +
      source.render(suffix.offset, plain.length, suffixBoundaries)
    )
  }

  return (
    source.render(0, effectivePrefixEnd, inclusiveBoundaries) +
    renderedEllipsis.text
  )
}

export function truncateToWidth(
  text: string,
  width: number,
  options?: TruncateOptions
): string {
  assertWidth(width, 'width', { allowZero: true })
  const resolved = {
    ...options,
    position: options?.position ?? DEFAULT_OPTIONS.position,
    ellipsis: options?.ellipsis ?? DEFAULT_OPTIONS.ellipsis,
    wordBoundary: options?.wordBoundary ?? DEFAULT_OPTIONS.wordBoundary,
  }
  const textHasAnsi = hasAnsi(text)
  const outputMayContainAnsi = textHasAnsi || hasAnsi(resolved.ellipsis)
  const finalize = (output: string): string =>
    outputMayContainAnsi ? finalizeAnsiOutput(output) : output
  if (resolved.countAnsiEscapeCodes ?? false) {
    assertSafeCountedAnsiHelperInput(resolved.ellipsis)
  }
  if (!textHasAnsi) {
    if (isPrintableAsciiOnly(text)) {
      return finalize(truncatePrintableText(
        text,
        text,
        width,
        resolved,
        (end) => text.slice(0, end),
        (start) => text.slice(start)
      ))
    }
    const ellipsis = new TokenizedText(resolved.ellipsis, resolved)
    const ellipsisTooWide = ellipsis.renderWidth() > width
    return finalize(truncatePlainText(
      text,
      width,
      resolved,
      renderPrefixWithin(ellipsis, width),
      ellipsisTooWide
    ))
  }

  if (resolved.countAnsiEscapeCodes ?? false) {
    assertSafeCountedAnsiHelperInput(text)
  }

  if (!(resolved.countAnsiEscapeCodes ?? false)) {
    const sparseSource = new AnsiTextView(text)
    if (isPrintableAsciiOnly(sparseSource.plainText)) {
      const inclusiveBoundaries = {
        includeStartSequences: true,
        includeEndSequences: true,
      }
      return finalize(truncatePrintableText(
        sparseSource.plainText,
        text,
        width,
        resolved,
        (end) => sparseSource.render(0, end, inclusiveBoundaries),
        (start, prefixEnd) =>
          sparseSource.render(start, sparseSource.plainText.length, {
            includeStartSequences: start !== prefixEnd,
            includeEndSequences: true,
          })
      ))
    }
    return finalize(truncateSparseAnsi(sparseSource, text, width, resolved))
  }

  if (stringWidth(text, resolved) <= width) return finalize(text)
  const source = new TokenizedText(
    text,
    resolved,
    resolved.position === 'end' ? { tokenWidthLimit: width } : undefined
  )

  const ellipsis = new TokenizedText(resolved.ellipsis, resolved)
  if (ellipsis.renderWidth() > width) {
    return finalize(renderPrefixWithin(ellipsis, width).text)
  }
  const renderedEllipsis = renderPrefixWithin(ellipsis, width)

  const availableWidth = width - renderedEllipsis.width
  if (resolved.position === 'start') {
    let start = suffixStart(source, availableWidth)
    if (resolved.wordBoundary) {
      start = suffixWordBoundary(source, start)
    }
    while (
      start < source.tokens.length &&
      renderedEllipsis.width + source.renderWidth(start) > width
    ) {
      start++
    }
    return finalize(renderedEllipsis.text + source.render(start))
  }

  if (resolved.position === 'middle') {
    const startWidth = Math.floor(availableWidth / 2)
    const endWidth = availableWidth - startWidth
    let end = prefixEnd(source, startWidth)
    let start = Math.max(end, suffixStart(source, endWidth))
    if (resolved.wordBoundary) {
      end = prefixWordBoundary(source, end)
      start = suffixWordBoundary(source, start)
    }
    while (
      source.renderWidth(0, end) +
        renderedEllipsis.width +
        source.renderWidth(start) >
        width &&
      (end > 0 || start < source.tokens.length)
    ) {
      if (end > 0) end--
      else start++
    }
    return finalize(
      source.render(0, end) + renderedEllipsis.text + source.render(start)
    )
  }

  let end = prefixEnd(source, availableWidth)
  if (resolved.wordBoundary) end = prefixWordBoundary(source, end)
  while (
    end > 0 &&
    source.renderWidth(0, end) + renderedEllipsis.width > width
  ) {
    end--
  }
  return finalize(source.render(0, end) + renderedEllipsis.text)
}
