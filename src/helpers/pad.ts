import { TokenizedText, assertWidth } from '../core/ansi-text.js'
import { isPrintableAsciiOnly } from '../core/constants.js'
import { stringWidth } from '../core/width-calculator.js'
import type { PadOptions } from '../types.js'

const DEFAULT_OPTIONS = {
  align: 'left' as const,
  padChar: ' ',
}

function buildAsciiPadding(pattern: string, width: number): string {
  return pattern.repeat(Math.ceil(width / pattern.length)).slice(0, width)
}

function buildPadding(
  pattern: TokenizedText,
  targetWidth: number
): string {
  const visibleIndices = pattern.tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token }) => token.width > 0)

  if (visibleIndices.length === 0 || targetWidth === 0) return ''

  const result: string[] = []
  let width = 0
  let cursor = 0
  while (width < targetWidth) {
    const { index } = visibleIndices[cursor]!
    const rendered = pattern.render(index, index + 1)
    const renderedWidth = stringWidth(rendered, pattern.options)
    if (width + renderedWidth > targetWidth) break
    result.push(rendered)
    width += renderedWidth
    cursor = (cursor + 1) % visibleIndices.length
  }
  return result.join('')
}

export function padToWidth(
  text: string,
  width: number,
  options?: PadOptions
): string {
  assertWidth(width, 'width', { allowZero: true })
  const resolved = { ...DEFAULT_OPTIONS, ...options }

  if (
    isPrintableAsciiOnly(text) &&
    resolved.padChar.length > 0 &&
    isPrintableAsciiOnly(resolved.padChar)
  ) {
    if (text.length >= width) return text
    const paddingWidth = width - text.length
    if (resolved.align === 'right') {
      return buildAsciiPadding(resolved.padChar, paddingWidth) + text
    }
    if (resolved.align === 'center') {
      const leftWidth = Math.floor(paddingWidth / 2)
      return (
        buildAsciiPadding(resolved.padChar, leftWidth) +
        text +
        buildAsciiPadding(resolved.padChar, paddingWidth - leftWidth)
      )
    }
    return text + buildAsciiPadding(resolved.padChar, paddingWidth)
  }

  const source = new TokenizedText(text, resolved)
  if (source.width >= width) return text

  const pattern = new TokenizedText(resolved.padChar, resolved)
  if (pattern.width === 0) return text

  const safeText = source.render()
  const safeWidth = stringWidth(safeText, resolved)
  if (safeWidth >= width) return safeText
  const paddingWidth = width - safeWidth

  if (resolved.align === 'right') {
    return buildPadding(pattern, paddingWidth) + safeText
  }
  if (resolved.align === 'center') {
    const leftWidth = Math.floor(paddingWidth / 2)
    return (
      buildPadding(pattern, leftWidth) +
      safeText +
      buildPadding(pattern, paddingWidth - leftWidth)
    )
  }
  return safeText + buildPadding(pattern, paddingWidth)
}
