/**
 * Generate optimized Unicode East Asian Width lookup tables
 *
 * This script generates TypeScript code with East Asian Width data
 * from Unicode Character Database.
 *
 * For MVP, we include the most common ranges. In production, this would
 * download and parse the official Unicode data files.
 *
 * @see https://www.unicode.org/Public/UCD/latest/ucd/EastAsianWidth.txt
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

type EastAsianWidth = 'F' | 'H' | 'W' | 'Na' | 'A' | 'N'

interface UnicodeRange {
  start: number
  end: number
  category: EastAsianWidth
}

/**
 * East Asian Width ranges
 *
 * This is a curated subset of the full Unicode East Asian Width data.
 * Covers the most common characters for MVP.
 *
 * Full data: https://www.unicode.org/Public/UCD/latest/ucd/EastAsianWidth.txt
 */
const EAST_ASIAN_WIDTH_RANGES: UnicodeRange[] = [
  // ASCII and Latin-1 (Narrow)
  { start: 0x0000, end: 0x00ff, category: 'Na' },

  // Halfwidth forms
  { start: 0xff61, end: 0xffdc, category: 'H' },
  { start: 0xffe8, end: 0xffee, category: 'H' },

  // CJK Symbols and Punctuation (Wide)
  { start: 0x3000, end: 0x303e, category: 'W' },

  // Hiragana (Wide)
  { start: 0x3040, end: 0x309f, category: 'W' },

  // Katakana (Wide)
  { start: 0x30a0, end: 0x30ff, category: 'W' },

  // Hangul (Wide)
  { start: 0x1100, end: 0x115f, category: 'W' },
  { start: 0x2329, end: 0x232a, category: 'W' },
  { start: 0xa960, end: 0xa97c, category: 'W' },
  { start: 0xac00, end: 0xd7a3, category: 'W' },
  { start: 0xd7b0, end: 0xd7c6, category: 'W' },
  { start: 0xd7cb, end: 0xd7fb, category: 'W' },

  // CJK Unified Ideographs (Wide)
  { start: 0x4e00, end: 0x9fff, category: 'W' },

  // CJK Extension A (Wide)
  { start: 0x3400, end: 0x4dbf, category: 'W' },

  // CJK Extension B-F (Wide)
  { start: 0x20000, end: 0x2fffd, category: 'W' },
  { start: 0x30000, end: 0x3fffd, category: 'W' },

  // Fullwidth forms
  { start: 0xff01, end: 0xff60, category: 'F' },
  { start: 0xffe0, end: 0xffe6, category: 'F' },

  // Box Drawing (Ambiguous)
  { start: 0x2500, end: 0x257f, category: 'A' },

  // Block Elements (Ambiguous)
  { start: 0x2580, end: 0x259f, category: 'A' },

  // Geometric Shapes (Ambiguous)
  { start: 0x25a0, end: 0x25ff, category: 'A' },

  // Miscellaneous Symbols (Ambiguous)
  { start: 0x2600, end: 0x26ff, category: 'A' },
]

function generateTypeScriptCode(ranges: UnicodeRange[]): string {
  // Sort ranges by start for binary search
  const sorted = [...ranges].sort((a, b) => a.start - b.start)

  const rangeLines = sorted
    .map(
      (r) =>
        `  [0x${r.start.toString(16)}, 0x${r.end.toString(16)}, '${r.category}']`
    )
    .join(',\n')

  return `/**
 * Auto-generated Unicode East Asian Width data
 * Unicode Version: 16.0.0 (subset for MVP)
 * Generated: ${new Date().toISOString()}
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
${rangeLines},
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
`
}

// Generate and write the file
const code = generateTypeScriptCode(EAST_ASIAN_WIDTH_RANGES)
const outputPath = join(__dirname, '../src/core/unicode-data.ts')

writeFileSync(outputPath, code, 'utf-8')

console.log('✅ Generated Unicode data:', outputPath)
console.log(`   ${EAST_ASIAN_WIDTH_RANGES.length} ranges`)
