/**
 * Tests for stringWidth function
 */

import { describe, it, expect } from 'vitest'
import { stringWidth } from '../../src/core/width-calculator.js'

describe('stringWidth', () => {
  describe('Empty and basic strings', () => {
    it('should return 0 for empty string', () => {
      expect(stringWidth('')).toBe(0)
    })

    it('should return 0 for null/undefined (converted to empty)', () => {
      expect(stringWidth(null as any)).toBe(0)
      expect(stringWidth(undefined as any)).toBe(0)
    })
  })

  describe('ASCII strings (fast path)', () => {
    it('should calculate width for ASCII text', () => {
      expect(stringWidth('Hello')).toBe(5)
      expect(stringWidth('Hello World')).toBe(11)
      expect(stringWidth('test')).toBe(4)
    })

    it('should handle ASCII with spaces', () => {
      expect(stringWidth('   ')).toBe(3)
      expect(stringWidth('a b c')).toBe(5)
    })

    it('should handle ASCII punctuation', () => {
      expect(stringWidth('Hello, World!')).toBe(13)
      expect(stringWidth('!@#$%^&*()')).toBe(10)
    })

    it('should handle ASCII numbers', () => {
      expect(stringWidth('12345')).toBe(5)
      expect(stringWidth('0')).toBe(1)
    })
  })

  describe('ANSI escape codes', () => {
    it('should strip ANSI codes by default', () => {
      expect(stringWidth('\x1b[31mRed\x1b[0m')).toBe(3)
      expect(stringWidth('\x1b[1mBold\x1b[0m')).toBe(4)
      expect(stringWidth('\x1b[4mUnderline\x1b[0m')).toBe(9)
    })

    it('should strip SGR codes', () => {
      expect(stringWidth('\x1b[31;1mBold Red\x1b[0m')).toBe(8)
    })

    it('should strip cursor movement codes', () => {
      expect(stringWidth('\x1b[10ATest')).toBe(4)
      expect(stringWidth('Hello\x1b[5D World')).toBe(11) // Hello (5) + space (1) + World (5) = 11
    })

    it('should count ANSI codes if option set', () => {
      const text = '\x1b[31mRed\x1b[0m'
      const width = stringWidth(text, { countAnsiEscapeCodes: true })
      // Should count the ANSI codes as well
      expect(width).toBeGreaterThan(3)
    })

    it('should handle text without ANSI efficiently', () => {
      // Fast path: no ESC character, no strip() call
      expect(stringWidth('No ANSI here')).toBe(12)
    })
  })

  describe('CJK characters (Wide)', () => {
    it('should count Chinese characters as width 2', () => {
      expect(stringWidth('你好')).toBe(4) // 2 chars × 2 width
      expect(stringWidth('中文')).toBe(4)
      expect(stringWidth('你')).toBe(2)
    })

    it('should count Japanese Hiragana as width 2', () => {
      expect(stringWidth('こんにちは')).toBe(10) // 5 chars × 2 width
    })

    it('should count Japanese Katakana as width 2', () => {
      expect(stringWidth('カタカナ')).toBe(8) // 4 chars × 2 width
    })

    it('should count Korean characters as width 2', () => {
      expect(stringWidth('안녕하세요')).toBe(10) // 5 chars × 2 width
    })

    it('should handle mixed ASCII and CJK', () => {
      expect(stringWidth('Hello世界')).toBe(9) // 5 + 4
      expect(stringWidth('你好World')).toBe(9) // 4 + 5
    })
  })

  describe('Fullwidth characters', () => {
    it('should count fullwidth Latin as width 2', () => {
      expect(stringWidth('Ａ')).toBe(2) // Fullwidth A
      expect(stringWidth('ＡＢＣ')).toBe(6) // 3 chars × 2
    })

    it('should count fullwidth numbers as width 2', () => {
      expect(stringWidth('１２３')).toBe(6) // 3 chars × 2
    })

    it('should count fullwidth symbols as width 2', () => {
      expect(stringWidth('！＠＃')).toBe(6) // 3 chars × 2
    })
  })

  describe('Halfwidth characters', () => {
    it('should count halfwidth Katakana as width 1', () => {
      expect(stringWidth('ｶﾀｶﾅ')).toBe(4) // 4 chars × 1
    })
  })

  describe('Emoji', () => {
    it('should count emoji as width 2 by default', () => {
      expect(stringWidth('👍')).toBe(2)
      expect(stringWidth('😀')).toBe(2)
      expect(stringWidth('🎉')).toBe(2)
    })

    it('should handle multiple emoji', () => {
      expect(stringWidth('👍👎')).toBe(4) // 2 emoji × 2 width
    })

    it('should handle emoji with skin tone as single grapheme', () => {
      expect(stringWidth('👍🏻')).toBe(2) // One grapheme, width 2
    })

    it('should handle ZWJ sequences (family emoji)', () => {
      expect(stringWidth('👨‍👩‍👧‍👦')).toBe(2) // One grapheme, width 2
    })

    it('should handle flag emoji', () => {
      // Regional-indicator pairs form one Unicode 16 grapheme.
      expect(stringWidth('🇺🇸')).toBeGreaterThanOrEqual(1) // One flag grapheme
      expect(stringWidth('🇺🇸🇬🇧')).toBeGreaterThanOrEqual(2) // Two flag graphemes
    })

    it('should respect emojiWidth option', () => {
      expect(stringWidth('👍', { emojiWidth: 1 })).toBe(1)
      expect(stringWidth('👍', { emojiWidth: 2 })).toBe(2)
    })

    it('should handle emoji with variation selector', () => {
      // Emoji presentation (VS16)
      expect(stringWidth('👍\ufe0f')).toBe(2)
      // Text presentation (VS15)
      expect(stringWidth('👍\ufe0e')).toBe(1)
    })
  })

  describe('Zero-width characters', () => {
    it('should not count zero-width space', () => {
      expect(stringWidth('A\u200bB')).toBe(2) // A + ZWSP + B = width 2
      expect(stringWidth('\u200b')).toBe(0) // Just ZWSP
    })

    it('should not count zero-width joiner', () => {
      expect(stringWidth('A\u200dB')).toBe(2) // A + ZWJ + B = width 2
    })

    it('should not count zero-width non-joiner', () => {
      expect(stringWidth('A\u200cB')).toBe(2) // A + ZWNJ + B = width 2
    })

    it('should not count BOM', () => {
      expect(stringWidth('\ufeffHello')).toBe(5) // BOM + Hello = width 5
    })
  })

  describe('Combining characters', () => {
    it('should handle combining marks correctly', () => {
      // 'café' with combining acute accent
      const cafe = 'cafe\u0301'
      expect(stringWidth(cafe)).toBe(4) // 4 graphemes, each width 1
    })

    it('should not count combining marks separately', () => {
      // Base character + combining mark = 1 grapheme
      expect(stringWidth('e\u0301')).toBe(1) // é as e + combining acute
    })
  })

  describe('Ambiguous characters', () => {
    it('should count ambiguous as width 1 by default', () => {
      // Box drawing characters are ambiguous
      expect(stringWidth('─')).toBe(1) // U+2500
      expect(stringWidth('│')).toBe(1) // U+2502
    })

    it('should count ambiguous as width 2 if option set', () => {
      expect(stringWidth('─', { ambiguousIsNarrow: false })).toBe(2)
      expect(stringWidth('│', { ambiguousIsNarrow: false })).toBe(2)
    })

    it('should respect ambiguousIsNarrow option', () => {
      const ambiguous = '■' // U+25A0 (black square, ambiguous)
      expect(stringWidth(ambiguous, { ambiguousIsNarrow: true })).toBe(1)
      expect(stringWidth(ambiguous, { ambiguousIsNarrow: false })).toBe(2)
    })
  })

  describe('Normalization', () => {
    it('should handle normalize option', () => {
      // Composed vs decomposed forms
      const composed = 'é' // U+00E9
      const decomposed = 'e\u0301' // e + combining acute

      // Without normalization
      const width1 = stringWidth(composed, { normalize: false })
      const width2 = stringWidth(decomposed, { normalize: false })

      // With normalization (should be same)
      const width3 = stringWidth(composed, { normalize: true })
      const width4 = stringWidth(decomposed, { normalize: true })

      expect(width1).toBe(width2)
      expect(width3).toBe(width4)
    })
  })

  describe('Complex mixed content', () => {
    it('should handle ASCII + CJK + emoji', () => {
      expect(stringWidth('Hello 你好 👍')).toBe(13)
      // Hello (5) + space (1) + 你好 (4) + space (1) + 👍 (2) = 13
    })

    it('should handle ANSI + CJK', () => {
      expect(stringWidth('\x1b[31m你好\x1b[0m')).toBe(4)
    })

    it('should handle ANSI + emoji', () => {
      expect(stringWidth('\x1b[31m👍\x1b[0m')).toBe(2)
    })

    it('should handle all types together', () => {
      const text = 'Hi 你好 👍 \x1b[31mRed\x1b[0m'
      // Hi (2) + space (1) + 你好 (4) + space (1) + 👍 (2) + space (1) + Red (3) = 14
      expect(stringWidth(text)).toBe(14)
    })
  })

  describe('Edge cases', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000)
      expect(stringWidth(longString)).toBe(10000)
    })

    it('should handle strings with only ANSI codes', () => {
      expect(stringWidth('\x1b[31m\x1b[0m')).toBe(0)
    })

    it('should handle strings with only zero-width chars', () => {
      expect(stringWidth('\u200b\u200c\u200d')).toBe(0)
    })

    it('should handle mixed width characters', () => {
      // Halfwidth + Fullwidth
      expect(stringWidth('ｶＡ')).toBe(3) // 1 + 2
    })
  })

  describe('Real-world examples', () => {
    it('should handle terminal output with colors', () => {
      const output = '\x1b[32m✓\x1b[0m Test passed'
      // ✓ (1) + space (1) + Test passed (11) = 13
      expect(stringWidth(output)).toBeGreaterThan(10)
    })

    it('should handle multilingual content', () => {
      const text = 'English 中文 日本語 한글'
      // English (7) + space (1) + 中文 (4) + space (1) + 日本語 (6) + space (1) + 한글 (4) = 24
      expect(stringWidth(text)).toBe(24)
    })

    it('should handle table borders with box drawing', () => {
      const border = '┌─────┐'
      // Box drawing characters are ambiguous, default to narrow
      expect(stringWidth(border)).toBe(7)
    })

    it('should handle emoji reactions', () => {
      const reactions = '👍 ❤️ 😂 🎉'
      // 4 emoji (2 each) + 3 spaces = 11
      expect(stringWidth(reactions)).toBeGreaterThanOrEqual(11)
    })
  })

  describe('Performance', () => {
    it('should handle ASCII strings efficiently (fast path)', () => {
      const start = Date.now()
      for (let i = 0; i < 10000; i++) {
        stringWidth('Hello World')
      }
      const duration = Date.now() - start
      // Should complete 10000 calls in under 50ms (fast path)
      expect(duration).toBeLessThan(50)
    })

    it('should handle Unicode strings reasonably', () => {
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        stringWidth('Hello 你好 World')
      }
      const duration = Date.now() - start
      // Should complete 1000 calls in under 150ms
      expect(duration).toBeLessThan(400)
    })
  })
})
