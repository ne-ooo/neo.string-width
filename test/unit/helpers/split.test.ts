/**
 * Tests for splitByWidth function
 */

import { describe, it, expect } from 'vitest'
import { splitByWidth } from '../../../src/helpers/split.js'

describe('splitByWidth', () => {
  describe('Basic splitting', () => {
    it('should split text that exceeds width', () => {
      expect(splitByWidth('Hello World', 5)).toEqual(['Hello', 'World'])
      expect(splitByWidth('Test String', 6)).toEqual(['Test', 'String'])
    })

    it('should return single chunk if text fits', () => {
      expect(splitByWidth('Hello', 10)).toEqual(['Hello'])
      expect(splitByWidth('Test', 20)).toEqual(['Test'])
    })

    it('should split into multiple chunks', () => {
      expect(splitByWidth('One Two Three Four', 8)).toEqual(['One Two', 'Three', 'Four'])
    })

    it('should handle exact fit per chunk', () => {
      expect(splitByWidth('HelloWorld', 5)).toEqual(['Hello', 'World'])
    })
  })

  describe('Word boundary preference', () => {
    it('should prefer splitting on spaces by default', () => {
      expect(splitByWidth('Hello World Test', 10)).toEqual(['Hello', 'World Test'])
      expect(splitByWidth('One Two Three', 8)).toEqual(['One Two', 'Three'])
    })

    it('should split on characters when preferSplitOnSpace is false', () => {
      expect(splitByWidth('Hello World', 7, { preferSplitOnSpace: false })).toEqual([
        'Hello W',
        'orld',
      ])
    })

    it('should fall back to character split if no space found', () => {
      expect(splitByWidth('HelloWorld', 5, { preferSplitOnSpace: true })).toEqual([
        'Hello',
        'World',
      ])
    })

    it('should handle multiple spaces', () => {
      expect(splitByWidth('Hello  World  Test', 12)).toEqual(['Hello  World', 'Test'])
    })
  })

  describe('CJK characters', () => {
    it('should split CJK text by width', () => {
      expect(splitByWidth('你好世界测试', 8)).toEqual(['你好世界', '测试'])
      expect(splitByWidth('你好世界测试', 4)).toEqual(['你好', '世界', '测试'])
    })

    it('should handle mixed ASCII and CJK', () => {
      expect(splitByWidth('Hello 你好 World', 10)).toEqual(['Hello 你好', 'World'])
    })

    it('should split on CJK punctuation', () => {
      expect(splitByWidth('你好，世界！', 6)).toEqual(['你好，', '世界！'])
    })
  })

  describe('Emoji', () => {
    it('should split text with emoji', () => {
      expect(splitByWidth('👍👎👌😀', 6)).toEqual(['👍👎👌', '😀'])
      expect(splitByWidth('Hello👍World', 7)).toEqual(['Hello👍', 'World'])
    })

    it('should handle emoji with skin tones as single units', () => {
      expect(splitByWidth('👍🏻👍🏿', 4)).toEqual(['👍🏻👍🏿'])
    })

    it('should handle ZWJ sequences', () => {
      expect(splitByWidth('👨‍👩‍👧‍👦 Test', 4)).toEqual(['👨‍👩‍👧‍👦', 'Test'])
    })
  })

  describe('Whitespace handling', () => {
    it('should not preserve whitespace by default', () => {
      expect(splitByWidth('   Hello   World   ', 10)).toEqual(['Hello', 'World'])
    })

    it('should preserve whitespace when enabled', () => {
      expect(splitByWidth('   Hello   ', 10, { preserveWhitespace: true })).toEqual([
        '   Hello  ',
        ' ',
      ])
    })

    it('should handle leading whitespace', () => {
      expect(splitByWidth('  Hello World', 10)).toEqual(['Hello', 'World'])
    })

    it('should handle trailing whitespace', () => {
      expect(splitByWidth('Hello World  ', 10)).toEqual(['Hello', 'World'])
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(splitByWidth('', 10)).toEqual([])
    })

    it('should handle width of 0', () => {
      expect(splitByWidth('Hello', 0)).toEqual(['Hello'])
    })

    it('should handle negative width', () => {
      expect(splitByWidth('Hello', -5)).toEqual(['Hello'])
    })

    it('should handle width of 1', () => {
      expect(splitByWidth('Hello', 1)).toEqual(['H', 'e', 'l', 'l', 'o'])
    })

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000)
      const chunks = splitByWidth(longString, 100)
      expect(chunks.length).toBe(10)
      expect(chunks[0]!.length).toBe(100)
    })

    it('should handle strings with only whitespace', () => {
      expect(splitByWidth('     ', 3)).toEqual([])
      expect(splitByWidth('     ', 3, { preserveWhitespace: true })).toEqual(['   ', '  '])
    })
  })

  describe('ANSI codes', () => {
    it('should handle ANSI colored text', () => {
      const text = '\x1b[31mHello\x1b[0m \x1b[32mWorld\x1b[0m'
      const result = splitByWidth(text, 7)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should preserve ANSI codes in chunks', () => {
      const text = '\x1b[31mHello World Test\x1b[0m'
      const result = splitByWidth(text, 10)
      expect(result.some((chunk) => chunk.includes('\x1b['))).toBe(true)
    })
  })

  describe('Mixed content', () => {
    it('should handle ASCII + CJK + emoji', () => {
      const text = 'Hello 你好 👍 World'
      const result = splitByWidth(text, 10)
      expect(result.length).toBeGreaterThan(1)
    })

    it('should handle complex mixed content', () => {
      const text = '\x1b[32mHi\x1b[0m 你好 👍 Test'
      const result = splitByWidth(text, 8)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Real-world use cases', () => {
    it('should wrap text for terminal output', () => {
      const text = 'This is a long line of text that needs to be wrapped for terminal display'
      const chunks = splitByWidth(text, 40)
      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(40)
      })
    })

    it('should split log lines', () => {
      const log = '[2024-02-19 10:30:45] INFO: Server started on port 3000'
      const chunks = splitByWidth(log, 30)
      expect(chunks.length).toBe(2)
    })

    it('should format table cells', () => {
      const longCell = 'This is a very long cell content'
      const chunks = splitByWidth(longCell, 15)
      expect(chunks).toEqual(['This is a very', 'long cell', 'content'])
    })

    it('should wrap Chinese text', () => {
      const text = '这是一段很长的中文文本需要被分割成多个部分以便在终端显示'
      const chunks = splitByWidth(text, 20)
      expect(chunks.length).toBeGreaterThan(2)
    })
  })

  describe('Combined options', () => {
    it('should respect both options together', () => {
      const text = '  Hello  World  '
      const result = splitByWidth(text, 10, {
        preferSplitOnSpace: false,
        preserveWhitespace: true,
      })
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should handle long strings efficiently', () => {
      const longString = 'word '.repeat(1000)
      const start = Date.now()
      splitByWidth(longString, 50)
      const duration = Date.now() - start
      expect(duration).toBeLessThan(100)
    })

    it('should handle many iterations efficiently', () => {
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        splitByWidth('Hello World Test', 10)
      }
      const duration = Date.now() - start
      expect(duration).toBeLessThan(400)
    })
  })

  describe('Comparison with manual splitting', () => {
    it('should match manual word-based splitting for ASCII', () => {
      const text = 'One Two Three Four Five'
      const manual = text.split(' ')
      const widthBased = splitByWidth(text, 100) // Large enough to fit all
      expect(widthBased).toEqual([text])
    })

    it('should differ from character-based splitting for CJK', () => {
      const text = '你好世界'
      // Character-based would be 4 characters
      // Width-based at width 4 should give 2 chunks
      const result = splitByWidth(text, 4)
      expect(result).toEqual(['你好', '世界'])
    })
  })
})
