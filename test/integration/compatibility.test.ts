/**
 * Compatibility tests vs string-width
 *
 * Ensures neo.string-width behaves consistently with string-width
 * for common use cases (where behavior should match)
 */

import { describe, it, expect } from 'vitest'
import { stringWidth } from '../../src/index.js'

describe('Compatibility with string-width', () => {
  describe('Basic ASCII strings', () => {
    it('should match string-width for simple ASCII', () => {
      expect(stringWidth('test')).toBe(4)
      expect(stringWidth('hello world')).toBe(11)
      expect(stringWidth('1234567890')).toBe(10)
    })

    it('should match for empty string', () => {
      expect(stringWidth('')).toBe(0)
    })

    it('should match for whitespace', () => {
      expect(stringWidth(' ')).toBe(1)
      expect(stringWidth('  ')).toBe(2)
      expect(stringWidth('\t')).toBe(0)
    })
  })

  describe('ANSI escape codes', () => {
    it('should strip ANSI color codes', () => {
      expect(stringWidth('\x1b[31mred\x1b[0m')).toBe(3)
      expect(stringWidth('\x1b[32mgreen\x1b[0m')).toBe(5)
      expect(stringWidth('\x1b[34mblue\x1b[0m')).toBe(4)
    })

    it('should strip ANSI style codes', () => {
      expect(stringWidth('\x1b[1mbold\x1b[0m')).toBe(4)
      expect(stringWidth('\x1b[3mitalic\x1b[0m')).toBe(6)
      expect(stringWidth('\x1b[4munderline\x1b[0m')).toBe(9)
    })

    it('should handle combined ANSI codes', () => {
      expect(stringWidth('\x1b[31;1mBold Red\x1b[0m')).toBe(8)
      expect(stringWidth('\x1b[32;4mGreen Underline\x1b[0m')).toBe(15)
    })

    it('should handle text with multiple ANSI sequences', () => {
      const text = '\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m \x1b[34mBlue\x1b[0m'
      expect(stringWidth(text)).toBe(14) // Red (3) + space (1) + Green (5) + space (1) + Blue (4) = 14
    })
  })

  describe('CJK characters', () => {
    it('should count Chinese characters as width 2', () => {
      expect(stringWidth('你好')).toBe(4)
      expect(stringWidth('中文')).toBe(4)
      expect(stringWidth('汉字')).toBe(4)
    })

    it('should count Japanese Hiragana as width 2', () => {
      expect(stringWidth('ひらがな')).toBe(8)
      expect(stringWidth('こんにちは')).toBe(10)
    })

    it('should count Japanese Katakana as width 2', () => {
      expect(stringWidth('カタカナ')).toBe(8)
    })

    it('should count Korean as width 2', () => {
      expect(stringWidth('한글')).toBe(4)
      expect(stringWidth('안녕하세요')).toBe(10)
    })

    it('should handle mixed ASCII and CJK', () => {
      expect(stringWidth('hello世界')).toBe(9) // 5 + 4
      expect(stringWidth('你好world')).toBe(9) // 4 + 5
    })
  })

  describe('Fullwidth characters', () => {
    it('should count fullwidth Latin as width 2', () => {
      expect(stringWidth('Ａ')).toBe(2)
      expect(stringWidth('ＡＢＣ')).toBe(6)
    })

    it('should count fullwidth numbers as width 2', () => {
      expect(stringWidth('１２３')).toBe(6)
    })

    it('should count fullwidth punctuation as width 2', () => {
      expect(stringWidth('！＠＃')).toBe(6)
    })
  })

  describe('Emoji', () => {
    it('should count simple emoji as width 2', () => {
      expect(stringWidth('👍')).toBe(2)
      expect(stringWidth('😀')).toBe(2)
      expect(stringWidth('🎉')).toBe(2)
    })

    it('should count emoji with skin tone as single unit', () => {
      expect(stringWidth('👍🏻')).toBe(2)
      expect(stringWidth('👍🏿')).toBe(2)
    })

    it('should handle ZWJ emoji sequences', () => {
      expect(stringWidth('👨‍👩‍👧‍👦')).toBe(2)
      expect(stringWidth('👨‍💻')).toBe(2)
    })
  })

  describe('Zero-width characters', () => {
    it('should not count zero-width space', () => {
      expect(stringWidth('a\u200bb')).toBe(2)
      expect(stringWidth('\u200b')).toBe(0)
    })

    it('should not count zero-width joiner', () => {
      expect(stringWidth('a\u200db')).toBe(2)
    })

    it('should not count zero-width non-joiner', () => {
      expect(stringWidth('a\u200cb')).toBe(2)
    })
  })

  describe('Combining characters', () => {
    it('should handle combining marks correctly', () => {
      // é composed vs decomposed
      expect(stringWidth('café')).toBe(4)
      expect(stringWidth('cafe\u0301')).toBe(4) // e + combining acute
    })
  })

  describe('Complex real-world cases', () => {
    it('should handle colored CJK text', () => {
      const text = '\x1b[31m你好\x1b[0m'
      expect(stringWidth(text)).toBe(4)
    })

    it('should handle colored emoji', () => {
      const text = '\x1b[32m✓\x1b[0m Test'
      expect(stringWidth(text)).toBeGreaterThanOrEqual(5)
    })

    it('should handle mixed everything', () => {
      const text = '\x1b[31mHello\x1b[0m 世界 👍'
      // Hello (5) + space (1) + 世界 (4) + space (1) + 👍 (2) = 13
      expect(stringWidth(text)).toBe(13)
    })
  })

  describe('Edge cases', () => {
    it('should handle undefined/null as empty string', () => {
      expect(stringWidth(null as any)).toBe(0)
      expect(stringWidth(undefined as any)).toBe(0)
    })

    it('should handle newlines', () => {
      expect(stringWidth('a\nb')).toBe(2) // Controls have no fixed column width
    })

    it('should handle tabs', () => {
      expect(stringWidth('a\tb')).toBe(2)
    })

    it('should handle carriage returns', () => {
      expect(stringWidth('a\rb')).toBe(2)
    })
  })

  describe('Known differences from string-width', () => {
    it('should NOT coerce strings in isNumeric by default', () => {
      // Note: string-width uses is-fullwidth-code-point
      // neo.string-width is more TypeScript-aligned
      // Both should give same results for actual width calculation
      expect(stringWidth('42')).toBe(2) // Both return 2
    })

    it('should handle ambiguous width consistently', () => {
      // Box drawing character (ambiguous)
      // Default to narrow (width 1) like string-width
      expect(stringWidth('─')).toBe(1)
    })
  })
})
