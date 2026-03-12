/**
 * Constants for string width calculation
 *
 * Based on Unicode standards:
 * - UAX #11: East Asian Width
 * - UAX #29: Text Segmentation
 * - Unicode Emoji specifications
 */

/**
 * Zero-width characters
 *
 * These characters have no visual width in terminal/text display.
 */
export const ZERO_WIDTH_CHARS = new Set([
  0x200b, // Zero Width Space
  0x200c, // Zero Width Non-Joiner
  0x200d, // Zero Width Joiner
  0x2060, // Word Joiner
  0xfeff, // Zero Width No-Break Space (BOM)
])

/**
 * Combining mark ranges (width = 0)
 *
 * These are diacritical marks that combine with the previous character.
 * Per Unicode, they have zero width.
 */
export const COMBINING_MARK_RANGES: readonly [number, number][] = [
  [0x0300, 0x036f], // Combining Diacritical Marks
  [0x1ab0, 0x1aff], // Combining Diacritical Marks Extended
  [0x1dc0, 0x1dff], // Combining Diacritical Marks Supplement
  [0x20d0, 0x20ff], // Combining Diacritical Marks for Symbols
  [0xfe20, 0xfe2f], // Combining Half Marks
]

/**
 * Emoji presentation ranges
 *
 * These code points typically render as emoji (width = 2).
 * Per Unicode Emoji specifications.
 */
export const EMOJI_RANGES: readonly [number, number][] = [
  [0x1f300, 0x1f5ff], // Miscellaneous Symbols and Pictographs
  [0x1f600, 0x1f64f], // Emoticons
  [0x1f680, 0x1f6ff], // Transport and Map Symbols
  [0x1f700, 0x1f77f], // Alchemical Symbols
  [0x1f780, 0x1f7ff], // Geometric Shapes Extended
  [0x1f800, 0x1f8ff], // Supplemental Arrows-C
  [0x1f900, 0x1f9ff], // Supplemental Symbols and Pictographs
  [0x1fa00, 0x1fa6f], // Chess Symbols, Emoji Extensions
  [0x1fa70, 0x1faff], // Symbols and Pictographs Extended-A
  [0x2600, 0x26ff], // Miscellaneous Symbols
  [0x2700, 0x27bf], // Dingbats
]

/**
 * Variation Selectors for emoji presentation
 *
 * These selectors control whether a character displays as text or emoji.
 */
export const VARIATION_SELECTOR_TEXT = 0xfe0e // VS15 - text presentation
export const VARIATION_SELECTOR_EMOJI = 0xfe0f // VS16 - emoji presentation

/**
 * Check if a code point is zero-width
 *
 * @param codePoint - Unicode code point to check
 * @returns true if the code point has zero width
 */
export function isZeroWidth(codePoint: number): boolean {
  // Check explicit zero-width characters
  if (ZERO_WIDTH_CHARS.has(codePoint)) {
    return true
  }

  // Check combining mark ranges
  for (const [start, end] of COMBINING_MARK_RANGES) {
    if (codePoint >= start && codePoint <= end) {
      return true
    }
  }

  return false
}

/**
 * Check if a code point is a zero-width character
 *
 * @param codePoint - Unicode code point to check
 * @returns true if code point is zero-width
 */
export function startsWithZeroWidth(codePoint: number | undefined): boolean {
  return codePoint !== undefined && isZeroWidth(codePoint)
}

/**
 * Check if a code point is in emoji range
 *
 * This is a quick heuristic check. For accurate emoji detection,
 * also check for variation selectors and ZWJ sequences.
 *
 * @param codePoint - Unicode code point to check
 * @returns true if code point is in emoji range
 */
export function isInEmojiRange(codePoint: number): boolean {
  for (const [start, end] of EMOJI_RANGES) {
    if (codePoint >= start && codePoint <= end) {
      return true
    }
  }
  return false
}

/**
 * Check if text contains emoji presentation selector
 *
 * VS16 (U+FE0F) indicates emoji presentation (width = 2).
 * VS15 (U+FE0E) indicates text presentation (width = 1).
 *
 * @param text - Text to check
 * @returns 'emoji' | 'text' | null
 */
export function getEmojiPresentation(
  text: string
): 'emoji' | 'text' | null {
  // Check last character for variation selector
  if (text.length >= 2) {
    const lastCodePoint = text.codePointAt(text.length - 1)
    if (lastCodePoint === VARIATION_SELECTOR_EMOJI) {
      return 'emoji'
    }
    if (lastCodePoint === VARIATION_SELECTOR_TEXT) {
      return 'text'
    }
  }

  // Check if in emoji range (default to emoji presentation)
  const firstCodePoint = text.codePointAt(0)
  if (firstCodePoint && isInEmojiRange(firstCodePoint)) {
    return 'emoji'
  }

  return null
}

/**
 * Fast ASCII check
 *
 * ASCII characters are always narrow (width = 1).
 *
 * @param codePoint - Unicode code point to check
 * @returns true if code point is ASCII (0-127)
 */
export function isAscii(codePoint: number): boolean {
  return codePoint < 0x80
}

/**
 * Check if entire string is ASCII-only
 *
 * This is the critical optimization for 2-3x speedup on ASCII strings.
 *
 * @param text - Text to check
 * @returns true if all characters are ASCII
 */
export function isAsciiOnly(text: string): boolean {
  // Using charCodeAt is faster than regex for this check
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) {
      return false
    }
  }
  return true
}
