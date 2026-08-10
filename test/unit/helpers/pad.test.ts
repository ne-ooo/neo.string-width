/**
 * Tests for padToWidth function
 */

import { describe, it, expect } from 'vitest'
import { padToWidth } from '../../../src/helpers/pad.js'

describe('padToWidth', () => {
  describe('Left alignment (default)', () => {
    it('should pad on the right by default', () => {
      expect(padToWidth('Hello', 10)).toBe('Hello     ')
      expect(padToWidth('Test', 8)).toBe('Test    ')
    })

    it('should return original if already at target width', () => {
      expect(padToWidth('Hello', 5)).toBe('Hello')
    })

    it('should return original if exceeds target width', () => {
      expect(padToWidth('Hello World', 5)).toBe('Hello World')
    })

    it('should handle CJK characters', () => {
      expect(padToWidth('你好', 10)).toBe('你好      ')
      expect(padToWidth('你好', 6)).toBe('你好  ')
    })

    it('should handle emoji', () => {
      expect(padToWidth('👍', 5)).toBe('👍   ')
      expect(padToWidth('👍👎', 8)).toBe('👍👎    ')
    })

    it('should handle ANSI codes', () => {
      expect(padToWidth('\x1b[31mRed\x1b[0m', 10)).toBe('\x1b[31mRed\x1b[0m       ')
    })
  })

  describe('Right alignment', () => {
    it('should pad on the left', () => {
      expect(padToWidth('Hello', 10, { align: 'right' })).toBe('     Hello')
      expect(padToWidth('Test', 8, { align: 'right' })).toBe('    Test')
    })

    it('should handle CJK characters', () => {
      expect(padToWidth('你好', 10, { align: 'right' })).toBe('      你好')
    })

    it('should handle emoji', () => {
      expect(padToWidth('👍', 5, { align: 'right' })).toBe('   👍')
    })

    it('should return original if fits exactly', () => {
      expect(padToWidth('Hello', 5, { align: 'right' })).toBe('Hello')
    })
  })

  describe('Center alignment', () => {
    it('should pad on both sides', () => {
      expect(padToWidth('Hello', 11, { align: 'center' })).toBe('   Hello   ')
      expect(padToWidth('Test', 10, { align: 'center' })).toBe('   Test   ')
    })

    it('should handle odd padding (extra on right)', () => {
      expect(padToWidth('Hello', 10, { align: 'center' })).toBe('  Hello   ')
      expect(padToWidth('Hi', 7, { align: 'center' })).toBe('  Hi   ')
    })

    it('should handle CJK characters', () => {
      expect(padToWidth('你好', 10, { align: 'center' })).toBe('   你好   ')
    })

    it('should handle emoji', () => {
      expect(padToWidth('👍', 6, { align: 'center' })).toBe('  👍  ')
    })
  })

  describe('Custom pad character', () => {
    it('should use custom pad character', () => {
      expect(padToWidth('Hello', 10, { padChar: '.' })).toBe('Hello.....')
      expect(padToWidth('Hello', 10, { padChar: '-' })).toBe('Hello-----')
    })

    it('should work with right alignment', () => {
      expect(padToWidth('Hello', 10, { align: 'right', padChar: '.' })).toBe('.....Hello')
    })

    it('should work with center alignment', () => {
      expect(padToWidth('Hi', 8, { align: 'center', padChar: '*' })).toBe('***Hi***')
    })

    it('should handle fullwidth pad character', () => {
      expect(padToWidth('Hi', 8, { padChar: '。' })).toBe('Hi。。。')
    })

    it('should handle emoji as pad character', () => {
      expect(padToWidth('Hi', 8, { padChar: '·' })).toBe('Hi······')
    })

    it('should handle multi-character pad string', () => {
      expect(padToWidth('Hi', 8, { padChar: '+-' })).toBe('Hi+-+-+-')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(padToWidth('', 5)).toBe('     ')
      expect(padToWidth('', 10, { padChar: '.' })).toBe('..........')
    })

    it('should handle width of 0', () => {
      expect(padToWidth('Hello', 0)).toBe('Hello')
    })

    it('should handle negative width', () => {
      expect(() => padToWidth('Hello', -5)).toThrow(RangeError)
    })

    it('should handle very large width', () => {
      const result = padToWidth('Hi', 100)
      expect(result.length).toBe(100)
      expect(result.startsWith('Hi')).toBe(true)
    })

    it('should handle strings with whitespace', () => {
      expect(padToWidth('  Hello  ', 15)).toBe('  Hello        ')
    })

    it('should handle zero-width pad character', () => {
      // If pad char is zero-width, can't pad properly
      expect(padToWidth('Hello', 10, { padChar: '\u200b' })).toBe('Hello')
    })
  })

  describe('Mixed content', () => {
    it('should handle ASCII + CJK', () => {
      // Hello (5) + space (1) + 你好 (4) = 10, pad to 15 = 5 spaces
      expect(padToWidth('Hello 你好', 15)).toBe('Hello 你好     ')
    })

    it('should handle CJK + emoji', () => {
      // 你好 (4) + 👍 (2) = 6, pad to 10 = 4 spaces
      expect(padToWidth('你好👍', 10)).toBe('你好👍    ')
    })

    it('should handle ANSI + CJK', () => {
      expect(padToWidth('\x1b[31m你好\x1b[0m', 10)).toBe('\x1b[31m你好\x1b[0m      ')
    })

    it('should handle everything mixed', () => {
      const text = '\x1b[32mHi\x1b[0m 你 👍'
      const result = padToWidth(text, 15)
      expect(result.length).toBeGreaterThan(text.length)
    })
  })

  describe('Real-world use cases', () => {
    it('should create table columns', () => {
      expect(padToWidth('Name', 20)).toBe('Name                ')
      expect(padToWidth('Age', 10, { align: 'right' })).toBe('       Age')
    })

    it('should align numbers', () => {
      expect(padToWidth('123', 10, { align: 'right' })).toBe('       123')
      expect(padToWidth('45', 10, { align: 'right' })).toBe('        45')
    })

    it('should create headers with decoration', () => {
      expect(padToWidth('TITLE', 20, { align: 'center', padChar: '=' })).toBe('=======TITLE========')
    })

    it('should format progress bars', () => {
      expect(padToWidth('[###', 10, { padChar: ' ' })).toBe('[###      ')
    })
  })

  describe('Performance', () => {
    it('should handle many iterations efficiently', () => {
      const start = Date.now()
      for (let i = 0; i < 10000; i++) {
        padToWidth('Test', 20)
      }
      const duration = Date.now() - start
      expect(duration).toBeLessThan(100) // Should complete in under 100ms
    })
  })
})
