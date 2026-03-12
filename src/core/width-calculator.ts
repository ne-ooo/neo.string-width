/**
 * Calculate visual width of strings
 *
 * This is the core algorithm implementing:
 * 1. ANSI stripping (using @lpm.dev/neo.ansi)
 * 2. Fast-path for ASCII-only strings (2-3x speedup!)
 * 3. Grapheme cluster iteration
 * 4. East Asian Width lookup
 * 5. Emoji detection and sizing
 * 6. Zero-width character handling
 *
 * Performance targets:
 * - ASCII: 2-3x faster than string-width
 * - Unicode: 10-20% faster than string-width
 * - ANSI: 10-15% faster (neo.ansi advantage)
 */

import { strip } from '@lpm.dev/neo.ansi'
import type { StringWidthOptions } from '../types.js'
import { getEastAsianWidth } from './unicode-data.js'
import { GraphemeIterator } from './grapheme-iterator.js'
import {
  isAsciiOnly,
  startsWithZeroWidth,
  getEmojiPresentation,
} from './constants.js'

/**
 * Default options for width calculation
 */
const DEFAULT_OPTIONS: Required<StringWidthOptions> = {
  ambiguousIsNarrow: true,
  countAnsiEscapeCodes: false,
  emojiWidth: 2,
  normalize: false,
}

/**
 * Calculate the visual width of a string
 *
 * This is the main function that determines how many columns a string
 * will occupy when displayed in a terminal or fixed-width context.
 *
 * @param text - String to measure
 * @param options - Optional configuration
 * @returns Visual width in columns
 *
 * @example
 * ```typescript
 * stringWidth('Hello')              // => 5
 * stringWidth('你好')                // => 4 (2 chars × 2 width)
 * stringWidth('\x1b[31mRed\x1b[0m') // => 3 (ANSI codes stripped)
 * stringWidth('👍')                  // => 2 (emoji)
 * stringWidth('café')                // => 4 (é = 1 grapheme)
 * ```
 */
export function stringWidth(
  text: string,
  options?: StringWidthOptions
): number {
  // Early exit for empty string
  if (!text) return 0

  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Strip ANSI codes unless explicitly counting them
  let processedText = text
  if (!opts.countAnsiEscapeCodes) {
    // Fast path: check for ESC before calling strip
    // This saves a function call when no ANSI codes present
    if (text.includes('\x1b')) {
      processedText = strip(text)
    }
  }

  // Fast path: ASCII-only strings
  // This is the CRITICAL optimization for 2-3x speedup
  // ASCII characters are always 1 column wide
  if (isAsciiOnly(processedText)) {
    return processedText.length
  }

  // Normalize if requested
  // NFC normalization ensures consistent width for composed/decomposed chars
  if (opts.normalize) {
    processedText = processedText.normalize('NFC')
  }

  // Fast path for simple Unicode (no combining marks, no ZWJ sequences)
  // This avoids the expensive Intl.Segmenter for common cases
  // Most CJK text falls into this category (20x+ speedup!)
  if (!needsGraphemeSegmentation(processedText)) {
    let width = 0
    // Iterate by code points (not grapheme clusters)
    for (let i = 0; i < processedText.length; ) {
      const codePoint = processedText.codePointAt(i)!
      // Extract character for emoji detection (handles surrogate pairs)
      const charLength = codePoint > 0xFFFF ? 2 : 1
      const char = processedText.slice(i, i + charLength)
      const charWidth = getCodePointWidth(codePoint, char, opts)
      width += charWidth

      // Move to next code point
      i += charLength
    }
    return width
  }

  // Slow path: Use GraphemeIterator for complex cases
  // (emoji with ZWJ, combining marks, etc.)
  let width = 0
  const iterator = new GraphemeIterator(processedText)

  for (const grapheme of iterator) {
    width += getGraphemeWidth(grapheme, opts)
  }

  return width
}

/**
 * Check if text needs expensive grapheme segmentation
 *
 * Returns true only for text with:
 * - ZWJ (Zero Width Joiner) sequences (e.g., family emojis)
 * - Combining marks (e.g., é = e + combining acute)
 * - Emoji skin tone modifiers (U+1F3FB-U+1F3FF)
 * - Variation selectors (U+FE00-U+FE0F)
 * - Other complex grapheme clusters
 *
 * Most text (including simple CJK and simple emoji) doesn't need this!
 *
 * @param text - Text to check
 * @returns true if grapheme segmentation needed
 */
function needsGraphemeSegmentation(text: string): boolean {
  // Check for Zero Width Joiner (ZWJ) - used in complex emoji
  if (text.includes('\u200D')) return true

  // Check for variation selectors (U+FE00-U+FE0F)
  if (text.includes('\uFE0E') || text.includes('\uFE0F')) return true

  // Scan for combining marks and emoji modifiers
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)

    // Combining marks
    if ((code >= 0x0300 && code <= 0x036F) || // Combining Diacritical Marks
        (code >= 0x1AB0 && code <= 0x1AFF) || // Combining Diacritical Marks Extended
        (code >= 0x1DC0 && code <= 0x1DFF) || // Combining Diacritical Marks Supplement
        (code >= 0x20D0 && code <= 0x20FF) || // Combining Diacritical Marks for Symbols
        (code >= 0xFE20 && code <= 0xFE2F)) { // Combining Half Marks
      return true
    }

    // Check for emoji skin tone modifiers (surrogate pairs U+1F3FB-U+1F3FF)
    // High surrogate: 0xD83C, Low surrogates: 0xDFFB-0xDFFF
    if (code === 0xD83C && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1)
      if (low >= 0xDFFB && low <= 0xDFFF) {
        return true
      }
    }
  }

  return false
}

/**
 * Calculate width of a single code point (fast path)
 *
 * Note: For simple single-codepoint emoji, we need to check presentation
 * This is still much faster than GraphemeIterator
 *
 * @param codePoint - Unicode code point
 * @param charCode - Character (needed for emoji detection)
 * @param options - Width calculation options
 * @returns Width in columns (0, 1, or 2)
 */
function getCodePointWidth(
  codePoint: number,
  charCode: string,
  options: Required<StringWidthOptions>
): number {
  // Zero-width characters
  if (startsWithZeroWidth(codePoint)) {
    return 0
  }

  // Check for emoji presentation (important for emoji!)
  const emojiPresentation = getEmojiPresentation(charCode)
  if (emojiPresentation === 'emoji') {
    return options.emojiWidth === 'auto' ? 2 : options.emojiWidth
  } else if (emojiPresentation === 'text') {
    return 1
  }

  // East Asian Width lookup
  const category = getEastAsianWidth(codePoint)

  switch (category) {
    case 'F': // Fullwidth
    case 'W': // Wide
      return 2

    case 'H': // Halfwidth
    case 'Na': // Narrow
    case 'N': // Neutral
      return 1

    case 'A': // Ambiguous
      return options.ambiguousIsNarrow ? 1 : 2

    default:
      return 1
  }
}

/**
 * Calculate width of a single grapheme cluster (slow path)
 *
 * @param text - Grapheme cluster (1 or more code points)
 * @param options - Width calculation options
 * @returns Width in columns (0, 1, or 2)
 */
function getGraphemeWidth(
  text: string,
  options: Required<StringWidthOptions>
): number {
  // Empty or zero-width characters
  if (!text || startsWithZeroWidth(text.codePointAt(0)!)) {
    return 0
  }

  // Get first code point for classification
  const codePoint = text.codePointAt(0)
  if (codePoint === undefined) return 0

  // Emoji detection with presentation support
  const emojiPresentation = getEmojiPresentation(text)
  if (emojiPresentation === 'emoji') {
    // Emoji presentation
    if (options.emojiWidth === 'auto') {
      return 2 // Default emoji width
    }
    return options.emojiWidth
  } else if (emojiPresentation === 'text') {
    // Text presentation (variation selector U+FE0E)
    return 1
  }

  // East Asian Width lookup
  const category = getEastAsianWidth(codePoint)

  switch (category) {
    case 'F': // Fullwidth
    case 'W': // Wide
      return 2

    case 'H': // Halfwidth
    case 'Na': // Narrow
    case 'N': // Neutral
      return 1

    case 'A': // Ambiguous
      // Ambiguous characters can be 1 or 2 depending on context
      // Default to narrow (Western context) per Unicode recommendations
      return options.ambiguousIsNarrow ? 1 : 2

    default:
      return 1
  }
}
