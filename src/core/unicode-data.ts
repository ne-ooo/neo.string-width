/**
 * Auto-generated Unicode East Asian Width data
 * Unicode Version: 16.0.0 (subset for MVP)
 * Generated: 2026-02-19T20:33:02.389Z
 *
 * DO NOT EDIT MANUALLY
 * Run: npm run generate-unicode-data
 *
 * @see https://www.unicode.org/reports/tr11/
 */

import type { EastAsianWidth } from '../types.js'

/**
 * Compressed East Asian Width ranges
 *
 * Format: [startCodePoint, endCodePoint, category]
 * Sorted by startCodePoint for binary search O(log n) lookup.
 *
 * This is a curated subset covering the most common characters.
 * Full Unicode data would be ~500 ranges.
 */
export const EAST_ASIAN_WIDTH_RANGES: readonly [
  number,
  number,
  EastAsianWidth
][] = [
  [0x0, 0xff, 'Na'],
  [0x1100, 0x115f, 'W'],
  [0x2329, 0x232a, 'W'],
  [0x2500, 0x257f, 'A'],
  [0x2580, 0x259f, 'A'],
  [0x25a0, 0x25ff, 'A'],
  [0x2600, 0x26ff, 'A'],
  [0x3000, 0x303e, 'W'],
  [0x3040, 0x309f, 'W'],
  [0x30a0, 0x30ff, 'W'],
  [0x3400, 0x4dbf, 'W'],
  [0x4e00, 0x9fff, 'W'],
  [0xa960, 0xa97c, 'W'],
  [0xac00, 0xd7a3, 'W'],
  [0xd7b0, 0xd7c6, 'W'],
  [0xd7cb, 0xd7fb, 'W'],
  [0xff01, 0xff60, 'F'],
  [0xff61, 0xffdc, 'H'],
  [0xffe0, 0xffe6, 'F'],
  [0xffe8, 0xffee, 'H'],
  [0x20000, 0x2fffd, 'W'],
  [0x30000, 0x3fffd, 'W'],
] as const

/**
 * Get East Asian Width category for a code point
 *
 * Uses binary search for O(log n) performance.
 *
 * @param codePoint - Unicode code point
 * @returns East Asian Width category
 *
 * @example
 * getEastAsianWidth(0x0041)  // 'Na' (Latin A)
 * getEastAsianWidth(0x4e00)  // 'W'  (CJK Ideograph)
 * getEastAsianWidth(0x3000)  // 'W'  (Ideographic Space)
 */
export function getEastAsianWidth(codePoint: number): EastAsianWidth {
  // Fast path: ASCII is always Narrow
  if (codePoint < 0x80) return 'Na'

  // Binary search in ranges
  let low = 0
  let high = EAST_ASIAN_WIDTH_RANGES.length - 1

  while (low <= high) {
    const mid = (low + high) >>> 1
    const range = EAST_ASIAN_WIDTH_RANGES[mid]!

    if (codePoint < range[0]) {
      high = mid - 1
    } else if (codePoint > range[1]) {
      low = mid + 1
    } else {
      return range[2]
    }
  }

  // Default to Neutral if not found
  return 'N'
}
