import { hasAnsi } from '@lpm.dev/neo.ansi'
import { TokenizedText, assertWidth } from '../core/ansi-text.js'
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
  const groups: string[] = []
  const pendingZeroWidth: string[] = []
  let currentWidth = 0
  let firstStart = end
  let lastEnd = start
  let startWasPartial = false
  let endWasPartial = false

  for (const segment of new GraphemeIterator(text)) {
    const width = getGraphemeWidth(segment, resolved)
    const tokenStart = currentWidth
    const tokenEnd = currentWidth + width

    if (width === 0) {
      if (groups.length > 0) pendingZeroWidth.push(segment)
      continue
    }

    if (tokenStart >= end) break
    currentWidth = tokenEnd
    if (tokenStart < start && tokenEnd > start) startWasPartial = true
    if (tokenStart < end && tokenEnd > end) endWasPartial = true

    if (tokenStart >= start && tokenEnd <= end) {
      if (groups.length === 0) firstStart = tokenStart
      groups.push(pendingZeroWidth.join('') + segment)
      pendingZeroWidth.length = 0
      lastEnd = tokenEnd
    }
  }

  const ellipsis = new TokenizedText(options?.ellipsis ?? '', options)
  const selectedWidth = end - start
  const startGap = groups.length === 0 ? selectedWidth : firstStart - start
  const endGap = groups.length === 0 ? selectedWidth : end - lastEnd
  const prefix = startWasPartial
    ? renderFittingPrefix(ellipsis, startGap)
    : { text: '', width: 0 }
  const suffix = endWasPartial
    ? renderFittingPrefix(ellipsis, endGap)
    : { text: '', width: 0 }

  let content = groups.join('')
  let result = prefix.text + content + suffix.text
  if (prefix.text === '' && suffix.text === '') return result

  let resultWidth = stringWidth(result, resolved)
  while (groups.length > 0 && resultWidth > selectedWidth) {
    groups.pop()
    content = groups.join('')
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

  if (
    startWidth >= 0 &&
    (endWidth === undefined || endWidth >= 0) &&
    !hasAnsi(text)
  ) {
    return slicePlainTextByWidth(
      text,
      startWidth,
      endWidth ?? Number.POSITIVE_INFINITY,
      options
    )
  }

  const source = new TokenizedText(text, options)
  const totalWidth = source.width
  const start = startWidth < 0 ? Math.max(0, totalWidth + startWidth) : startWidth
  const requestedEnd = endWidth ?? totalWidth
  const end = Math.min(
    totalWidth,
    requestedEnd < 0 ? Math.max(0, totalWidth + requestedEnd) : requestedEnd
  )
  if (start >= end || start >= totalWidth) return ''

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
  let content = firstIndex < 0 ? '' : source.render(firstIndex, contentEnd)
  const suffix = endWasPartial
    ? renderFittingPrefix(ellipsis, endGap)
    : { text: '', width: 0 }

  let result = prefix.text + content + suffix.text
  if (
    prefix.text === '' &&
    suffix.text === '' &&
    !source.options.countAnsiEscapeCodes
  ) {
    return result
  }

  let resultWidth = stringWidth(result, source.options)
  while (
    firstIndex >= 0 &&
    contentEnd > firstIndex &&
    resultWidth > end - start
  ) {
    contentEnd--
    content = source.render(firstIndex, contentEnd)
    result = prefix.text + content + suffix.text
    resultWidth = stringWidth(result, source.options)
  }
  return resultWidth <= end - start ? result : ''
}
