/** Unicode 16 helpers used by width calculation. */

import {
  EMOJI_PRESENTATION_RANGES,
  MARK_RANGES,
  isControl,
  isDefaultIgnorable,
  isEmojiModifier,
  isEmojiPresentation,
  isExtendedPictographic,
  isMark,
} from './unicode-data.js'

export const ZERO_WIDTH_CHARS = new Set([
  0x200b, // Zero Width Space
  0x200c, // Zero Width Non-Joiner
  0x200d, // Zero Width Joiner
  0x2060, // Word Joiner
  0xfeff, // Zero Width No-Break Space (BOM)
])

/** Full Unicode 16 Mark ranges, retained under the original public name. */
export const COMBINING_MARK_RANGES = MARK_RANGES

/** Unicode 16 characters with default emoji presentation. */
export const EMOJI_RANGES = EMOJI_PRESENTATION_RANGES

export const VARIATION_SELECTOR_TEXT = 0xfe0e
export const VARIATION_SELECTOR_EMOJI = 0xfe0f
const COMBINING_ENCLOSING_KEYCAP = 0x20e3

export function isZeroWidth(codePoint: number): boolean {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return false
  }
  return (
    isControl(codePoint) ||
    isMark(codePoint) ||
    isDefaultIgnorable(codePoint)
  )
}

export function startsWithZeroWidth(codePoint: number | undefined): boolean {
  return codePoint !== undefined && isZeroWidth(codePoint)
}

export function isInEmojiRange(codePoint: number): boolean {
  return isEmojiPresentation(codePoint)
}

export function getEmojiPresentation(
  text: string
): 'emoji' | 'text' | null {
  let firstCodePoint: number | undefined
  let codePointCount = 0
  let allRegionalIndicators = true
  let hasTextVariationSelector = false
  let hasEmojiVariationSelector = false
  let hasKeycap = false
  let hasEmojiModifier = false
  let hasExtendedPictographic = false
  let hasZeroWidthJoiner = false

  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index)!
    firstCodePoint ??= codePoint
    codePointCount++
    allRegionalIndicators &&=
      codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff
    hasTextVariationSelector ||= codePoint === VARIATION_SELECTOR_TEXT
    hasEmojiVariationSelector ||= codePoint === VARIATION_SELECTOR_EMOJI
    hasKeycap ||= codePoint === COMBINING_ENCLOSING_KEYCAP
    hasEmojiModifier ||= isEmojiModifier(codePoint)
    hasExtendedPictographic ||= isExtendedPictographic(codePoint)
    hasZeroWidthJoiner ||= codePoint === 0x200d
    index += codePoint > 0xffff ? 2 : 1
  }

  if (firstCodePoint === undefined) return null
  if (hasTextVariationSelector) return 'text'
  if (hasEmojiVariationSelector || hasKeycap) return 'emoji'
  if (codePointCount >= 2 && allRegionalIndicators) return 'emoji'
  if (isEmojiPresentation(firstCodePoint)) return 'emoji'
  if (isExtendedPictographic(firstCodePoint) && hasEmojiModifier) return 'emoji'
  if (hasZeroWidthJoiner && hasExtendedPictographic) return 'emoji'

  return null
}

export function isAscii(codePoint: number): boolean {
  return codePoint >= 0 && codePoint < 0x80
}

export function isAsciiOnly(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    if (text.charCodeAt(index) > 0x7f) return false
  }
  return true
}

/** True only for printable ASCII; C0 controls and DEL have no fixed width. */
export function isPrintableAsciiOnly(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code < 0x20 || code > 0x7e) return false
  }
  return true
}
