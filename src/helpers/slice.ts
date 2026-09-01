import { hasAnsi } from '@lpm.dev/neo.ansi'
import {
  AnsiTextView,
  TokenizedText,
  assertSafeCountedAnsiHelperInput,
  assertWidth,
  finalizeAnsiOutput,
} from '../core/ansi-text.js'
import { isPrintableAsciiOnly } from '../core/constants.js'
import { GraphemeIterator } from '../core/grapheme-iterator.js'
import {
  getGraphemeWidth,
  resolveStringWidthOptions,
  stringWidth,
} from '../core/width-calculator.js'
import type { SliceOptions } from '../types.js'

interface RenderedPrefix {
  readonly text: string
  readonly width: number
}

function slicePlainTextByWidth(
  text: string,
  start: number,
  end: number,
  options?: SliceOptions
): string {
  if (start >= end) return ''

  const resolved = resolveStringWidthOptions(options)
  let currentWidth = 0
  let selectedStartOffset = -1
  let selectedEndOffset = -1
  let firstStart = end
  let lastEnd = start
  let startWasPartial = false
  let endWasPartial = false
  let scannedToEnd = true

  for (const segment of new GraphemeIterator(text).segments()) {
    const width = getGraphemeWidth(segment.segment, resolved)
    const tokenStart = currentWidth
    const tokenEnd = currentWidth + width

    if (width === 0) continue

    if (tokenStart >= end) {
      scannedToEnd = false
      break
    }
    currentWidth = tokenEnd
    if (tokenStart < start && tokenEnd > start) startWasPartial = true
    if (tokenStart < end && tokenEnd > end) endWasPartial = true

    if (tokenStart >= start && tokenEnd <= end) {
      if (selectedStartOffset < 0) {
        selectedStartOffset = segment.index
        firstStart = tokenStart
      }
      selectedEndOffset = segment.end
      lastEnd = tokenEnd
    }
  }

  const effectiveEnd = scannedToEnd ? Math.min(end, currentWidth) : end
  if (start >= effectiveEnd) return ''

  const ellipsis = new TokenizedText(options?.ellipsis ?? '', options)
  const selectedWidth = effectiveEnd - start
  const startGap =
    selectedStartOffset < 0 ? selectedWidth : firstStart - start
  const endGap =
    selectedStartOffset < 0 ? selectedWidth : effectiveEnd - lastEnd
  const prefix = startWasPartial
    ? renderFittingPrefix(ellipsis, startGap)
    : { text: '', width: 0 }
  const suffix = endWasPartial
    ? renderFittingPrefix(ellipsis, endGap)
    : { text: '', width: 0 }

  let content =
    selectedStartOffset < 0
      ? ''
      : text.slice(selectedStartOffset, selectedEndOffset)
  let result = prefix.text + content + suffix.text
  if (prefix.text === '' && suffix.text === '') return result

  let resultWidth = stringWidth(result, resolved)
  if (resultWidth <= selectedWidth) return result

  const fallbackGroups = new GraphemeIterator(content).toArray()
  while (fallbackGroups.length > 0 && resultWidth > selectedWidth) {
    fallbackGroups.pop()
    content = fallbackGroups.join('')
    result = prefix.text + content + suffix.text
    resultWidth = stringWidth(result, resolved)
  }
  return resultWidth <= selectedWidth ? result : ''
}

function renderFittingPrefix(text: TokenizedText, width: number): RenderedPrefix {
  let currentWidth = 0
  let end = 0
  for (const token of text.tokens) {
    if (currentWidth + token.width > width) break
    currentWidth += token.width
    end++
  }
  while (end > 0 && text.renderWidth(0, end) > width) end--
  return {
    text: text.render(0, end),
    width: text.renderWidth(0, end),
  }
}

function sliceSparseAnsiByWidth(
  source: AnsiTextView,
  start: number,
  end: number,
  options?: SliceOptions
): string {
  if (isPrintableAsciiOnly(source.plainText)) {
    const effectiveEnd = Math.min(end, source.plainText.length)
    return start >= effectiveEnd ? '' : source.render(start, effectiveEnd)
  }

  const resolved = resolveStringWidthOptions(options)
  let currentWidth = 0
  let selectedStartOffset = -1
  let selectedEndOffset = -1
  let firstStart = end
  let lastEnd = start
  let selectedContentWidth = 0
  let startWasPartial = false
  let endWasPartial = false
  let scannedToEnd = true

  for (const segment of new GraphemeIterator(source.plainText).segments()) {
    const width = getGraphemeWidth(segment.segment, resolved)
    const tokenStart = currentWidth
    const tokenEnd = currentWidth + width

    if (width === 0) continue
    if (tokenStart >= end) {
      scannedToEnd = false
      break
    }
    currentWidth = tokenEnd
    if (tokenStart < start && tokenEnd > start) startWasPartial = true
    if (tokenStart < end && tokenEnd > end) endWasPartial = true

    if (tokenStart >= start && tokenEnd <= end) {
      if (selectedStartOffset < 0) {
        selectedStartOffset = segment.index
        firstStart = tokenStart
      }
      selectedEndOffset = segment.end
      lastEnd = tokenEnd
      selectedContentWidth += width
    }
  }

  const effectiveEnd = scannedToEnd ? Math.min(end, currentWidth) : end
  if (start >= effectiveEnd) return ''

  const ellipsis = new TokenizedText(options?.ellipsis ?? '', options)
  const selectedWidth = effectiveEnd - start
  const startGap =
    selectedStartOffset < 0 ? selectedWidth : firstStart - start
  const endGap =
    selectedStartOffset < 0 ? selectedWidth : effectiveEnd - lastEnd
  const prefix = startWasPartial
    ? renderFittingPrefix(ellipsis, startGap)
    : { text: '', width: 0 }
  const suffix = endWasPartial
    ? renderFittingPrefix(ellipsis, endGap)
    : { text: '', width: 0 }

  if (prefix.width + selectedContentWidth + suffix.width > selectedWidth) {
    return ''
  }
  return (
    prefix.text +
    (selectedStartOffset < 0
      ? ''
      : source.render(selectedStartOffset, selectedEndOffset)) +
    suffix.text
  )
}

export function sliceByWidth(
  text: string,
  startWidth: number,
  endWidth?: number,
  options?: SliceOptions
): string {
  assertWidth(startWidth, 'startWidth', { allowZero: true, allowNegative: true })
  if (endWidth !== undefined) {
    assertWidth(endWidth, 'endWidth', { allowZero: true, allowNegative: true })
  }
  if (options?.countAnsiEscapeCodes ?? false) {
    assertSafeCountedAnsiHelperInput(options?.ellipsis ?? '')
  }
  const ellipsisHasAnsi = hasAnsi(options?.ellipsis ?? '')
  if (text === '') return ''

  if (isPrintableAsciiOnly(text)) {
    const start = startWidth < 0 ? Math.max(0, text.length + startWidth) : startWidth
    const requestedEnd = endWidth ?? text.length
    const end = Math.min(
      text.length,
      requestedEnd < 0 ? Math.max(0, text.length + requestedEnd) : requestedEnd
    )
    return start >= end ? '' : text.slice(start, end)
  }

  const containsAnsi = hasAnsi(text)
  const finalize = (output: string): string =>
    containsAnsi || ellipsisHasAnsi ? finalizeAnsiOutput(output) : output
  if (!containsAnsi) {
    if (startWidth < 0 || (endWidth !== undefined && endWidth < 0)) {
      const totalWidth = stringWidth(text, options)
      const start =
        startWidth < 0 ? Math.max(0, totalWidth + startWidth) : startWidth
      const requestedEnd = endWidth ?? totalWidth
      const end = Math.min(
        totalWidth,
        requestedEnd < 0
          ? Math.max(0, totalWidth + requestedEnd)
          : requestedEnd
      )
      return finalize(slicePlainTextByWidth(text, start, end, options))
    }
    return finalize(slicePlainTextByWidth(
      text,
      startWidth,
      endWidth ?? Number.POSITIVE_INFINITY,
      options
    ))
  }

  if (options?.countAnsiEscapeCodes ?? false) {
    assertSafeCountedAnsiHelperInput(text)
  }

  if (!(options?.countAnsiEscapeCodes ?? false)) {
    const sparseSource = new AnsiTextView(text)
    if (startWidth < 0 || (endWidth !== undefined && endWidth < 0)) {
      const totalWidth = stringWidth(sparseSource.plainText, options)
      const start =
        startWidth < 0 ? Math.max(0, totalWidth + startWidth) : startWidth
      const requestedEnd = endWidth ?? totalWidth
      const end = Math.min(
        totalWidth,
        requestedEnd < 0
          ? Math.max(0, totalWidth + requestedEnd)
          : requestedEnd
      )
      if (start >= end || start >= totalWidth) return ''
      return finalize(sliceSparseAnsiByWidth(sparseSource, start, end, options))
    }
    return finalize(sliceSparseAnsiByWidth(
      sparseSource,
      startWidth,
      endWidth ?? Number.POSITIVE_INFINITY,
      options
    ))
  }

  const totalWidth = stringWidth(text, options)
  const start = startWidth < 0 ? Math.max(0, totalWidth + startWidth) : startWidth
  const requestedEnd = endWidth ?? totalWidth
  const end = Math.min(
    totalWidth,
    requestedEnd < 0 ? Math.max(0, totalWidth + requestedEnd) : requestedEnd
  )
  if (start >= end || start >= totalWidth) return ''
  const source = new TokenizedText(text, options, { tokenWidthLimit: end })

  let currentWidth = 0
  let firstIndex = -1
  let lastIndex = -1
  let firstStart = end
  let lastEnd = start
  let startWasPartial = false
  let endWasPartial = false

  for (let index = 0; index < source.tokens.length; index++) {
    const token = source.tokens[index]!
    const tokenStart = currentWidth
    const tokenEnd = currentWidth + token.width
    currentWidth = tokenEnd

    if (token.width === 0) continue
    if (tokenStart < start && tokenEnd > start) startWasPartial = true
    if (tokenStart < end && tokenEnd > end) endWasPartial = true

    if (tokenStart >= start && tokenEnd <= end) {
      if (firstIndex < 0) {
        firstIndex = index
        firstStart = tokenStart
      }
      lastIndex = index
      lastEnd = tokenEnd
    }
  }

  const ellipsis = new TokenizedText(options?.ellipsis ?? '', options)
  const startGap = firstIndex < 0 ? end - start : firstStart - start
  const endGap = firstIndex < 0 ? end - start : end - lastEnd
  const prefix = startWasPartial
    ? renderFittingPrefix(ellipsis, startGap)
    : { text: '', width: 0 }
  let contentEnd = lastIndex + 1
  const suffix = endWasPartial
    ? renderFittingPrefix(ellipsis, endGap)
    : { text: '', width: 0 }

  if (
    prefix.text === '' &&
    suffix.text === '' &&
    !source.options.countAnsiEscapeCodes
  ) {
    return finalize(prefix.text +
      (firstIndex < 0 ? '' : source.render(firstIndex, contentEnd)) +
      suffix.text)
  }

  let resultWidth =
    prefix.width +
    (firstIndex < 0 ? 0 : source.renderWidth(firstIndex, contentEnd)) +
    suffix.width
  while (
    firstIndex >= 0 &&
    contentEnd > firstIndex &&
    resultWidth > end - start
  ) {
    contentEnd--
    resultWidth =
      prefix.width + source.renderWidth(firstIndex, contentEnd) + suffix.width
  }
  if (resultWidth > end - start) return ''
  return finalize(
    prefix.text +
    (firstIndex < 0 ? '' : source.render(firstIndex, contentEnd)) +
    suffix.text
  )
}
