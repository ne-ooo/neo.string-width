/**
 * Tests for sliceByWidth function
 */

import { describe, it, expect } from 'vitest'
import { sliceByWidth } from '../../../src/helpers/slice.js'

describe('sliceByWidth', () => {
  describe('Basic slicing', () => {
    it('should slice from start to end', () => {
      expect(sliceByWidth('Hello World', 0, 5)).toBe('Hello')
      expect(sliceByWidth('Hello World', 6, 11)).toBe('World')
    })

    it('should slice from start with no end (to end of string)', () => {
      expect(sliceByWidth('Hello World', 6)).toBe('World')
      expect(sliceByWidth('Hello World', 0)).toBe('Hello World')
    })

    it('should handle exact character boundaries', () => {
      expect(sliceByWidth('Test', 0, 2)).toBe('Te')
      expect(sliceByWidth('Test', 2, 4)).toBe('st')
    })

    it('should return empty for start >= end', () => {
      expect(sliceByWidth('Hello', 5, 5)).toBe('')
      expect(sliceByWidth('Hello', 3, 2)).toBe('')
    })
  })

  describe('CJK characters', () => {
    it('should slice CJK text by width', () => {
      expect(sliceByWidth('你好世界', 0, 4)).toBe('你好')
      expect(sliceByWidth('你好世界', 4, 8)).toBe('世界')
    })

    it('should handle partial CJK character positions', () => {
      expect(sliceByWidth('你好世界', 2, 6)).toBe('好世')
      expect(sliceByWidth('你好世界', 1, 5)).toBe('好世')
    })

    it('should handle mixed ASCII and CJK', () => {
      expect(sliceByWidth('Hello你好', 0, 5)).toBe('Hello')
      expect(sliceByWidth('Hello你好', 5, 9)).toBe('你好')
    })
  })

  describe('Emoji', () => {
    it('should slice emoji by width', () => {
      expect(sliceByWidth('👍👎👌', 0, 2)).toBe('👍')
      expect(sliceByWidth('👍👎👌', 2, 4)).toBe('👎')
      expect(sliceByWidth('👍👎👌', 4, 6)).toBe('👌')
    })

    it('should handle mixed text and emoji', () => {
      expect(sliceByWidth('Hello👍World', 0, 5)).toBe('Hello')
      expect(sliceByWidth('Hello👍World', 5, 7)).toBe('👍')
      expect(sliceByWidth('Hello👍World', 7, 12)).toBe('World')
    })
  })

  describe('Negative indices', () => {
    it('should support negative start index', () => {
      expect(sliceByWidth('Hello World', -5)).toBe('World')
      expect(sliceByWidth('Hello World', -11)).toBe('Hello World')
    })

    it('should support negative end index', () => {
      expect(sliceByWidth('Hello World', 0, -6)).toBe('Hello')
      expect(sliceByWidth('Hello World', 0, -1)).toBe('Hello Worl')
    })

    it('should support both negative indices', () => {
      expect(sliceByWidth('Hello World', -11, -6)).toBe('Hello')
      expect(sliceByWidth('Hello World', -5, -1)).toBe('Worl')
    })

    it('should handle negative indices with CJK', () => {
      expect(sliceByWidth('你好世界', -4)).toBe('世界')
      expect(sliceByWidth('你好世界', -6, -2)).toBe('好世')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(sliceByWidth('', 0, 5)).toBe('')
      expect(sliceByWidth('', 0)).toBe('')
    })

    it('should handle start beyond string length', () => {
      expect(sliceByWidth('Hello', 10, 15)).toBe('')
      expect(sliceByWidth('Hello', 10)).toBe('')
    })

    it('should handle end beyond string length', () => {
      expect(sliceByWidth('Hello', 0, 100)).toBe('Hello')
      expect(sliceByWidth('Hello', 2, 100)).toBe('llo')
    })

    it('should handle very large negative index', () => {
      expect(sliceByWidth('Hello', -100, 3)).toBe('Hel')
    })

    it('should handle width of 0', () => {
      expect(sliceByWidth('Hello', 0, 0)).toBe('')
    })

    it('should handle strings with whitespace', () => {
      expect(sliceByWidth('  Hello  ', 2, 7)).toBe('Hello')
      expect(sliceByWidth('  Hello  ', 0, 2)).toBe('  ')
    })
  })

  describe('ANSI codes', () => {
    it('should handle text with ANSI codes', () => {
      // Note: ANSI codes are stripped by stringWidth, so slicing works on plain text
      const text = '\x1b[31mHello World\x1b[0m'
      const result = sliceByWidth(text, 0, 5)
      // ANSI codes may appear in output, but slicing is based on visual width
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain('\x1b')
    })

    it('should handle ANSI codes in middle of text', () => {
      const text = 'Hello \x1b[32mWorld\x1b[0m Test'
      const result = sliceByWidth(text, 6, 11)
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain('\x1b')
    })
  })

  describe('Mixed content', () => {
    it('should handle ASCII + CJK + emoji', () => {
      const text = 'Hi 你好 👍 World'
      expect(sliceByWidth(text, 0, 2)).toBe('Hi')
      expect(sliceByWidth(text, 3, 7)).toBe('你好')
      expect(sliceByWidth(text, 8, 10)).toBe('👍')
    })

    it('should handle complex Unicode', () => {
      const text = 'Hello 世界 👨‍👩‍👧‍👦 Test'
      const result = sliceByWidth(text, 0, 11)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Real-world use cases', () => {
    it('should extract filenames from paths', () => {
      const path = '/usr/local/bin/node'
      expect(sliceByWidth(path, 15)).toBe('node')
    })

    it('should extract substrings for display', () => {
      const longText = 'This is a very long string that needs to be truncated'
      const preview = sliceByWidth(longText, 0, 20)
      expect(preview).toBe('This is a very long ')
    })

    it('should work like substring for pagination', () => {
      const text = 'Page 1 content. Page 2 content. Page 3 content.'
      expect(sliceByWidth(text, 0, 15)).toBe('Page 1 content.')
      expect(sliceByWidth(text, 16, 31)).toBe('Page 2 content.')
    })
  })

  describe('Performance', () => {
    it('should handle long strings efficiently', () => {
      const longString = 'a'.repeat(10000)
      const start = Date.now()
      sliceByWidth(longString, 0, 100)
      const duration = Date.now() - start
      expect(duration).toBeLessThan(50)
    })

    it('should handle many iterations efficiently', () => {
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        sliceByWidth('Hello World Test', 0, 5)
      }
      const duration = Date.now() - start
      expect(duration).toBeLessThan(400)
    })
  })

  describe('Comparison with String.slice()', () => {
    it('should behave similarly for ASCII', () => {
      const text = 'Hello World'
      expect(sliceByWidth(text, 0, 5)).toBe(text.slice(0, 5))
      expect(sliceByWidth(text, 6)).toBe(text.slice(6))
    })

    it('should differ for fullwidth characters', () => {
      const text = '你好世界'
      // slice() returns by character count
      expect(text.slice(0, 2)).toBe('你好')
      // sliceByWidth() by visual width
      expect(sliceByWidth(text, 0, 4)).toBe('你好')
    })
  })
})
