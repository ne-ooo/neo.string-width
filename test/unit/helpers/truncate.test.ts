/**
 * Tests for truncateToWidth function
 */

import { describe, it, expect } from 'vitest'
import { truncateToWidth } from '../../../src/helpers/truncate.js'

describe('truncateToWidth', () => {
  describe('End truncation (default)', () => {
    it('should truncate from the end by default', () => {
      expect(truncateToWidth('Hello World', 8)).toBe('Hello W…')
      expect(truncateToWidth('Hello World', 5)).toBe('Hell…')
    })

    it('should return original string if it fits', () => {
      expect(truncateToWidth('Hello', 10)).toBe('Hello')
      expect(truncateToWidth('Hello', 5)).toBe('Hello')
    })

    it('should handle exact fit', () => {
      expect(truncateToWidth('Hello', 5)).toBe('Hello')
      expect(truncateToWidth('Test', 4)).toBe('Test')
    })

    it('should handle CJK characters', () => {
      expect(truncateToWidth('你好世界', 6)).toBe('你好…')
      expect(truncateToWidth('你好世界', 4)).toBe('你…')
    })

    it('should handle emoji', () => {
      expect(truncateToWidth('👍👎👌', 4)).toBe('👍…')
      expect(truncateToWidth('Hello 👍', 7)).toBe('Hello …') // Preserves space
    })

    it('should handle ANSI codes', () => {
      // Note: ANSI codes are stripped by stringWidth, so they appear in output but may be truncated
      const result = truncateToWidth('\x1b[31mHello World\x1b[0m', 8)
      expect(result).toContain('…')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle mixed content', () => {
      expect(truncateToWidth('Hello 你好 World', 10)).toBe('Hello 你…')
    })
  })

  describe('Start truncation', () => {
    it('should truncate from the start', () => {
      expect(truncateToWidth('Hello World', 8, { position: 'start' })).toBe('…o World')
      expect(truncateToWidth('Hello World', 5, { position: 'start' })).toBe('…orld')
    })

    it('should handle CJK characters', () => {
      expect(truncateToWidth('你好世界', 6, { position: 'start' })).toBe('…世界')
      expect(truncateToWidth('你好世界', 4, { position: 'start' })).toBe('…界')
    })

    it('should handle emoji', () => {
      expect(truncateToWidth('👍👎👌', 4, { position: 'start' })).toBe('…👌')
    })

    it('should return original if fits', () => {
      expect(truncateToWidth('Hello', 10, { position: 'start' })).toBe('Hello')
    })
  })

  describe('Middle truncation', () => {
    it('should truncate from the middle', () => {
      expect(truncateToWidth('Hello World', 8, { position: 'middle' })).toBe('Hel…orld')
      expect(truncateToWidth('Hello World', 6, { position: 'middle' })).toBe('He…rld')
    })

    it('should handle CJK characters', () => {
      expect(truncateToWidth('你好世界测试', 8, { position: 'middle' })).toBe('你…测试')
    })

    it('should handle emoji', () => {
      expect(truncateToWidth('👍👎👌😀', 6, { position: 'middle' })).toBe('👍…😀')
    })

    it('should return original if fits', () => {
      expect(truncateToWidth('Hello', 10, { position: 'middle' })).toBe('Hello')
    })

    it('should handle odd vs even widths', () => {
      expect(truncateToWidth('HelloWorld', 7, { position: 'middle' })).toBe('Hel…rld')
      expect(truncateToWidth('HelloWorld', 6, { position: 'middle' })).toBe('He…rld')
    })
  })

  describe('Custom ellipsis', () => {
    it('should use custom ellipsis string', () => {
      expect(truncateToWidth('Hello World', 8, { ellipsis: '...' })).toBe('Hello...')
      expect(truncateToWidth('Hello World', 8, { ellipsis: '>>' })).toBe('Hello >>')
    })

    it('should handle empty ellipsis', () => {
      expect(truncateToWidth('Hello World', 8, { ellipsis: '' })).toBe('Hello Wo')
    })

    it('should handle fullwidth ellipsis', () => {
      expect(truncateToWidth('Hello World', 8, { ellipsis: '。' })).toBe('Hello 。')
    })

    it('should handle ellipsis wider than available width', () => {
      expect(truncateToWidth('Hello', 2, { ellipsis: '...' })).toBe('..')
      expect(truncateToWidth('Hello', 1, { ellipsis: '…' })).toBe('…')
    })
  })

  describe('Word boundary preference', () => {
    it('should prefer truncating on space when enabled', () => {
      expect(
        truncateToWidth('Hello World Test', 10, { wordBoundary: true })
      ).toBe('Hello…')
      expect(
        truncateToWidth('Hello World Test', 15, { wordBoundary: true })
      ).toBe('Hello World…')
    })

    it('should not prefer space when disabled', () => {
      expect(
        truncateToWidth('Hello World Test', 10, { wordBoundary: false })
      ).toBe('Hello Wor…')
    })

    it('should fall back to character truncation if no space found', () => {
      expect(
        truncateToWidth('HelloWorldTest', 10, { wordBoundary: true })
      ).toBe('HelloWorl…')
    })

    it('should work with start position', () => {
      expect(
        truncateToWidth('Hello World Test', 10, {
          position: 'start',
          wordBoundary: true,
        })
      ).toBe('… Test') // Should prefer splitting on space
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(truncateToWidth('', 10)).toBe('')
    })

    it('should handle width of 0', () => {
      expect(truncateToWidth('Hello', 0)).toBe('')
    })

    it('should handle width of 1', () => {
      expect(truncateToWidth('Hello', 1)).toBe('…')
    })

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000)
      const result = truncateToWidth(longString, 10)
      expect(result.length).toBeLessThanOrEqual(11) // 10 chars + ellipsis
    })

    it('should handle strings with only whitespace', () => {
      expect(truncateToWidth('     ', 3)).toBe('  …')
      expect(truncateToWidth('     ', 2)).toBe(' …')
    })

    it('should handle newlines and tabs', () => {
      expect(truncateToWidth('Hello\nWorld', 8)).toBe('Hello\nWo…')
      expect(truncateToWidth('Hello\tWorld', 8)).toBe('Hello\tWo…')
    })
  })

  describe('Combined scenarios', () => {
    it('should handle all options together', () => {
      const result = truncateToWidth('Hello World Test', 10, {
        position: 'middle',
        ellipsis: '---',
        wordBoundary: false,
      })
      expect(result).toBe('Hel---Test')
    })

    it('should handle CJK with emoji', () => {
      expect(truncateToWidth('你好👍世界', 8)).toBe('你好👍…')
    })

    it('should handle ANSI with CJK', () => {
      // ANSI codes are stripped, so output won't preserve them fully
      const result = truncateToWidth('\x1b[31m你好世界\x1b[0m', 6)
      expect(result).toContain('…')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle mixed everything', () => {
      const text = '\x1b[32mHello\x1b[0m 你好 👍 World'
      const result = truncateToWidth(text, 12)
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
