import { hasAnsi } from '@lpm.dev/neo.ansi'
import { TokenizedText, assertWidth, isWhitespaceToken } from '../core/ansi-text.js'
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

interface RenderedPrefix {
  readonly text: string
  readonly width: number
}

interface PlainToken {
  readonly text: string
  readonly width: number
  readonly whitespace: boolean
  readonly index: number
}

function renderPrefixWithin(text: TokenizedText, width: number): RenderedPrefix {
  let end = prefixEnd(text, width)
  while (end > 0 && text.renderWidth(0, end) > width) end--
  return {
    text: text.render(0, end),
    width: text.renderWidth(0, end),
  }
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
  const prefix: PlainToken[] = []
  const suffix: PlainToken[] = []
  let prefixWidth = 0
  let suffixWidth = 0
  let totalWidth = 0
  let prefixClosed = false
  let tokenIndex = 0

  for (const segment of new GraphemeIterator(text)) {
    const token: PlainToken = {
      text: segment,
      width: getGraphemeWidth(segment, resolved),
      whitespace: /^\s+$/u.test(segment),
      index: tokenIndex++,
    }
    totalWidth += token.width

    if (!prefixClosed && prefixWidth + token.width <= prefixLimit) {
      prefix.push(token)
      prefixWidth += token.width
    } else {
      prefixClosed = true
    }

    suffix.push(token)
    suffixWidth += token.width
    while (suffix.length > 0 && suffixWidth > suffixLimit) {
      suffixWidth -= suffix.shift()!.width
    }
  }

  if (totalWidth <= width) return text
  if (ellipsisTooWide) return ellipsis.text

  if (options.position === 'start') {
    if (options.wordBoundary) {
      const whitespace = suffix.findIndex((token) => token.whitespace)
      if (whitespace >= 0) suffix.splice(0, whitespace)
    }
    let result = ellipsis.text + suffix.map((token) => token.text).join('')
    while (suffix.length > 0 && stringWidth(result, resolved) > width) {
      suffix.shift()
      result = ellipsis.text + suffix.map((token) => token.text).join('')
    }
    return result
  }

  if (options.position === 'middle') {
    const prefixEnd = prefix.length
    while (suffix.length > 0 && suffix[0]!.index < prefixEnd) suffix.shift()
    let result =
      prefix.map((token) => token.text).join('') +
      ellipsis.text +
      suffix.map((token) => token.text).join('')
    while (
      stringWidth(result, resolved) > width &&
      (prefix.length > 0 || suffix.length > 0)
    ) {
      if (prefix.length > 0) prefix.pop()
      else suffix.shift()
      result =
        prefix.map((token) => token.text).join('') +
        ellipsis.text +
        suffix.map((token) => token.text).join('')
    }
    return result
  }

  if (options.wordBoundary) {
    for (let index = prefix.length - 1; index > 0; index--) {
      if (prefix[index]!.whitespace) {
        prefix.splice(index)
        break
      }
    }
  }
  let result = prefix.map((token) => token.text).join('') + ellipsis.text
  while (prefix.length > 0 && stringWidth(result, resolved) > width) {
    prefix.pop()
    result = prefix.map((token) => token.text).join('') + ellipsis.text
  }
  return result
}

export function truncateToWidth(
  text: string,
  width: number,
  options?: TruncateOptions
): string {
  assertWidth(width, 'width', { allowZero: true })
  const resolved = { ...DEFAULT_OPTIONS, ...options }
  if (!hasAnsi(text)) {
    const ellipsis = new TokenizedText(resolved.ellipsis, resolved)
    const ellipsisTooWide = ellipsis.renderWidth() > width
    return truncatePlainText(
      text,
      width,
      resolved,
      renderPrefixWithin(ellipsis, width),
      ellipsisTooWide
    )
  }

  const source = new TokenizedText(text, resolved)
  if (source.width <= width) return text

  const ellipsis = new TokenizedText(resolved.ellipsis, resolved)
  if (ellipsis.renderWidth() > width) {
    return renderPrefixWithin(ellipsis, width).text
  }
  const renderedEllipsis = renderPrefixWithin(ellipsis, width)

  const availableWidth = width - renderedEllipsis.width
  if (resolved.position === 'start') {
    let start = suffixStart(source, availableWidth)
    if (resolved.wordBoundary) {
      for (let index = start; index < source.tokens.length; index++) {
        if (isWhitespaceToken(source.tokens[index]!)) {
          start = index
          break
        }
      }
    }
    let result = renderedEllipsis.text + source.render(start)
    while (start < source.tokens.length && stringWidth(result, resolved) > width) {
      start++
      result = renderedEllipsis.text + source.render(start)
    }
    return result
  }

  if (resolved.position === 'middle') {
    const startWidth = Math.floor(availableWidth / 2)
    const endWidth = availableWidth - startWidth
    let end = prefixEnd(source, startWidth)
    let start = Math.max(end, suffixStart(source, endWidth))
    let result =
      source.render(0, end) + renderedEllipsis.text + source.render(start)
    while (stringWidth(result, resolved) > width && (end > 0 || start < source.tokens.length)) {
      if (end > 0) end--
      else start++
      result =
        source.render(0, end) + renderedEllipsis.text + source.render(start)
    }
    return result
  }

  let end = prefixEnd(source, availableWidth)
  if (resolved.wordBoundary) {
    for (let index = end - 1; index > 0; index--) {
      if (isWhitespaceToken(source.tokens[index]!)) {
        end = index
        break
      }
    }
  }
  let result = source.render(0, end) + renderedEllipsis.text
  while (end > 0 && stringWidth(result, resolved) > width) {
    end--
    result = source.render(0, end) + renderedEllipsis.text
  }
  return result
}
