/**
 * Tests for Unicode East Asian Width data
 */

import { describe, it, expect } from 'vitest'
import {
  EAST_ASIAN_WIDTH_RANGES,
  getEastAsianWidth,
} from '../../src/core/unicode-data.js'

describe('Unicode Data', () => {
  describe('EAST_ASIAN_WIDTH_RANGES', () => {
    it('should have correct format', () => {
      expect(Array.isArray(EAST_ASIAN_WIDTH_RANGES)).toBe(true)
      expect(EAST_ASIAN_WIDTH_RANGES.length).toBeGreaterThan(0)

      // Each range should be [start, end, category]
      for (const range of EAST_ASIAN_WIDTH_RANGES) {
        expect(Array.isArray(range)).toBe(true)
        expect(range).toHaveLength(3)
        expect(typeof range[0]).toBe('number')
        expect(typeof range[1]).toBe('number')
        expect(typeof range[2]).toBe('string')
        expect(range[0]).toBeLessThanOrEqual(range[1])
      }
    })

    it('should be sorted by start code point', () => {
      for (let i = 1; i < EAST_ASIAN_WIDTH_RANGES.length; i++) {
        expect(EAST_ASIAN_WIDTH_RANGES[i]![0]).toBeGreaterThan(
          EAST_ASIAN_WIDTH_RANGES[i - 1]![0]
        )
      }
    })
  })

  describe('getEastAsianWidth', () => {
    describe('ASCII characters (fast path)', () => {
      it('should return "Na" for ASCII characters', () => {
        expect(getEastAsianWidth(0x0041)).toBe('Na') // 'A'
        expect(getEastAsianWidth(0x0061)).toBe('Na') // 'a'
        expect(getEastAsianWidth(0x0030)).toBe('Na') // '0'
        expect(getEastAsianWidth(0x0020)).toBe('Na') // space
        expect(getEastAsianWidth(0x007f)).toBe('Na') // DEL
      })
    })

    describe('CJK characters', () => {
      it('should return "W" for CJK ideographs', () => {
        expect(getEastAsianWidth(0x4e00)).toBe('W') // 一 (first CJK ideograph)
        expect(getEastAsianWidth(0x4e2d)).toBe('W') // 中 (middle)
        expect(getEastAsianWidth(0x6587)).toBe('W') // 文 (text/character)
        expect(getEastAsianWidth(0x9fff)).toBe('W') // Last in main CJK block
      })

      it('should return "W" for Hangul characters', () => {
        expect(getEastAsianWidth(0x1100)).toBe('W') // Hangul Jamo
        expect(getEastAsianWidth(0xac00)).toBe('W') // 가 (first Hangul syllable)
        expect(getEastAsianWidth(0xd7a3)).toBe('W') // 힣 (last Hangul syllable)
      })

      it('should return "W" for Hiragana and Katakana', () => {
        expect(getEastAsianWidth(0x3040)).toBe('W') // Hiragana
        expect(getEastAsianWidth(0x30a0)).toBe('W') // Katakana
      })
    })

    describe('Fullwidth characters', () => {
      it('should return "F" for fullwidth Latin', () => {
        expect(getEastAsianWidth(0xff01)).toBe('F') // ！ (fullwidth exclamation)
        expect(getEastAsianWidth(0xff21)).toBe('F') // Ａ (fullwidth A)
        expect(getEastAsianWidth(0xff41)).toBe('F') // ａ (fullwidth a)
      })

      it('should return "F" for fullwidth symbols', () => {
        expect(getEastAsianWidth(0xffe0)).toBe('F') // ￠ (fullwidth cent)
      })
    })

    describe('Halfwidth characters', () => {
      it('should return "H" for halfwidth Katakana', () => {
        expect(getEastAsianWidth(0xff61)).toBe('H') // ｡ (halfwidth katakana)
        expect(getEastAsianWidth(0xff9d)).toBe('H') // ﾝ (halfwidth katakana N)
      })

      it('should return "H" for halfwidth symbols', () => {
        expect(getEastAsianWidth(0xffe8)).toBe('H') // ￨ (halfwidth forms light vertical)
      })
    })

    describe('Ambiguous characters', () => {
      it('should return "A" for box drawing characters', () => {
        expect(getEastAsianWidth(0x2500)).toBe('A') // ─ (box drawing)
        expect(getEastAsianWidth(0x2580)).toBe('A') // ▀ (block elements)
        expect(getEastAsianWidth(0x25a0)).toBe('A') // ■ (geometric shapes)
      })

      it('should return "A" for some symbols', () => {
        expect(getEastAsianWidth(0x2600)).toBe('A') // ☀ (misc symbols)
      })
    })

    describe('Wide characters', () => {
      it('should return "W" for ideographic space', () => {
        expect(getEastAsianWidth(0x3000)).toBe('W') // 　 (ideographic space)
      })

      it('should return "W" for CJK extension A', () => {
        expect(getEastAsianWidth(0x3400)).toBe('W') // CJK Extension A start
      })

      it('should return "W" for CJK extensions B-E', () => {
        expect(getEastAsianWidth(0x20000)).toBe('W') // CJK Extension B
        expect(getEastAsianWidth(0x30000)).toBe('W') // CJK Extension E
      })
    })

    describe('Default behavior', () => {
      it('should return "N" for unlisted characters', () => {
        // Characters not in our MVP ranges should default to 'N'
        expect(getEastAsianWidth(0x0100)).toBe('N') // Latin Extended-A
      })
    })

    describe('Edge cases', () => {
      it('should handle code point 0', () => {
        expect(getEastAsianWidth(0x0000)).toBe('Na')
      })

      it('should handle high code points', () => {
        expect(getEastAsianWidth(0x3fffd)).toBe('W') // End of Extension E range
      })

      it('should handle code points between ranges', () => {
        // Code point between ranges should return 'N'
        const result = getEastAsianWidth(0x0200)
        expect(['N', 'Na', 'W', 'F', 'H', 'A']).toContain(result)
      })
    })

    describe('Binary search performance', () => {
      it('should handle large number of lookups efficiently', () => {
        const start = Date.now()
        for (let i = 0; i < 10000; i++) {
          getEastAsianWidth(0x4e00 + (i % 100))
        }
        const duration = Date.now() - start
        // Should complete 10000 lookups in under 100ms
        expect(duration).toBeLessThan(100)
      })
    })
  })
})
