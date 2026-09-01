import { hasAnsi } from '@lpm.dev/neo.ansi'
import {
  AnsiTextView,
  TokenizedText,
  assertSafeCountedAnsiHelperInput,
  assertSafeAnsiExpansion,
  assertWidth,
  finalizeAnsiOutput,
} from '../core/ansi-text.js'
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
  if (targetWidth === 0) return ''

  let cycleWidth = 0
  let cycleLength = 0
  for (let index = 0; index < pattern.tokens.length; index++) {
    if (pattern.tokens[index]!.width <= 0) continue
    cycleWidth += pattern.renderWidth(index, index + 1)
    cycleLength += pattern.renderLength(index, index + 1)
  }
  if (cycleWidth === 0) return ''

  const completeCycles = Math.floor(targetWidth / cycleWidth)
  let outputLength = cycleLength * completeCycles
  let remainderWidth = targetWidth - cycleWidth * completeCycles
  for (let index = 0; index < pattern.tokens.length; index++) {
    if (pattern.tokens[index]!.width <= 0) continue
    const pieceWidth = pattern.renderWidth(index, index + 1)
    if (pieceWidth > remainderWidth) break
    outputLength += pattern.renderLength(index, index + 1)
    remainderWidth -= pieceWidth
  }
  assertSafeAnsiExpansion(
    pattern.sourceLength + targetWidth,
    outputLength
  )

  let cycleText = ''
  if (completeCycles > 0) {
    const cycleParts: string[] = []
    for (let index = 0; index < pattern.tokens.length; index++) {
      if (pattern.tokens[index]!.width > 0) {
        cycleParts.push(pattern.render(index, index + 1))
      }
    }
    cycleText = cycleParts.join('')
  }

  let result = cycleText.repeat(completeCycles)
  let width = cycleWidth * completeCycles
  for (let index = 0; index < pattern.tokens.length; index++) {
    if (pattern.tokens[index]!.width <= 0) continue
    const pieceWidth = pattern.renderWidth(index, index + 1)
    if (width + pieceWidth > targetWidth) break
    result += pattern.render(index, index + 1)
    width += pieceWidth
  }
  return result
}

export function padToWidth(
  text: string,
  width: number,
  options?: PadOptions
): string {
  assertWidth(width, 'width', { allowZero: true })
  const resolved = {
    ...options,
    align: options?.align ?? DEFAULT_OPTIONS.align,
    padChar: options?.padChar ?? DEFAULT_OPTIONS.padChar,
  }
  if (resolved.countAnsiEscapeCodes ?? false) {
    assertSafeCountedAnsiHelperInput(resolved.padChar)
  }

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

  const textHasAnsi = hasAnsi(text)
  const outputMayContainAnsi = textHasAnsi || hasAnsi(resolved.padChar)
  const finalize = (output: string): string =>
    outputMayContainAnsi ? finalizeAnsiOutput(output) : output

  let safeText: string
  let safeWidth: number
  if (textHasAnsi) {
    if (resolved.countAnsiEscapeCodes ?? false) {
      assertSafeCountedAnsiHelperInput(text)
    }
    const sparseSource = new AnsiTextView(text)
    if (!(resolved.countAnsiEscapeCodes ?? false)) {
      safeWidth = stringWidth(sparseSource.plainText, resolved)
      if (safeWidth >= width) return finalize(text)
      safeText = sparseSource.renderAll()
    } else {
      safeWidth = stringWidth(text, resolved)
      if (safeWidth >= width) return finalize(text)
      const source = new TokenizedText(text, resolved)
      safeText = source.render()
      safeWidth = source.renderWidth()
    }
  } else {
    safeText = text
    safeWidth = stringWidth(text, resolved)
    if (safeWidth >= width) return finalize(text)
  }

  if (safeWidth >= width) return finalize(safeText)
  const paddingWidth = width - safeWidth
  const pattern = new TokenizedText(resolved.padChar, resolved, {
    tokenWidthLimit: paddingWidth,
    skipZeroWidthPlain: true,
  })
  if (pattern.width === 0) return finalize(text)

  if (resolved.align === 'right') {
    return finalize(buildPadding(pattern, paddingWidth) + safeText)
  }
  if (resolved.align === 'center') {
    const leftWidth = Math.floor(paddingWidth / 2)
    return finalize(
      buildPadding(pattern, leftWidth) +
      safeText +
      buildPadding(pattern, paddingWidth - leftWidth)
    )
  }
  return finalize(safeText + buildPadding(pattern, paddingWidth))
}
