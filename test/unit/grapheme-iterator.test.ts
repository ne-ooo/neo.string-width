/**
 * Tests for GraphemeIterator
 */

import { describe, it, expect } from 'vitest'
import { GraphemeIterator } from '../../src/core/grapheme-iterator.js'

describe('GraphemeIterator', () => {
  describe('Basic iteration', () => {
    it('should iterate over ASCII characters', () => {
      const iterator = new GraphemeIterator('Hello')
      const graphemes = Array.from(iterator)
      expect(graphemes).toEqual(['H', 'e', 'l', 'l', 'o'])
    })

    it('should iterate over empty string', () => {
      const iterator = new GraphemeIterator('')
      const graphemes = Array.from(iterator)
      expect(graphemes).toEqual([])
    })

    it('should handle single character', () => {
      const iterator = new GraphemeIterator('A')
      const graphemes = Array.from(iterator)
      expect(graphemes).toEqual(['A'])
    })
  })

  describe('CJK characters', () => {
    it('should iterate over Chinese characters', () => {
      const iterator = new GraphemeIterator('你好')
      const graphemes = Array.from(iterator)
      expect(graphemes).toEqual(['你', '好'])
    })

    it('should iterate over Japanese characters', () => {
      const iterator = new GraphemeIterator('こんにちは')
      const graphemes = Array.from(iterator)
      expect(graphemes).toEqual(['こ', 'ん', 'に', 'ち', 'は'])
    })

    it('should iterate over Korean characters', () => {
      const iterator = new GraphemeIterator('안녕')
      const graphemes = Array.from(iterator)
      expect(graphemes).toEqual(['안', '녕'])
    })
  })

  describe('Combining characters', () => {
    it('should keep combining marks with base character', () => {
      const iterator = new GraphemeIterator('café') // e + combining acute
      const graphemes = Array.from(iterator)
      expect(graphemes).toHaveLength(4)
      expect(graphemes[0]).toBe('c')
      expect(graphemes[1]).toBe('a')
      expect(graphemes[2]).toBe('f')
      // graphemes[3] should be 'e' + combining mark as one grapheme
    })

    it('should handle multiple combining marks', () => {
      const text = 'e\u0301\u0300' // e + acute + grave
      const iterator = new GraphemeIterator(text)
      const graphemes = Array.from(iterator)
      expect(graphemes).toHaveLength(1)
    })
  })

  describe('Emoji', () => {
    it('should treat single emoji as one grapheme', () => {
      const iterator = new GraphemeIterator('👍')
      const graphemes = Array.from(iterator)
      expect(graphemes).toHaveLength(1)
      expect(graphemes[0]).toBe('👍')
    })

    it('should treat emoji with skin tone as one grapheme', () => {
      const iterator = new GraphemeIterator('👍🏻') // thumbs up + light skin tone
      const graphemes = Array.from(iterator)
      expect(graphemes).toHaveLength(1)
    })

    it('should treat ZWJ sequences as one grapheme', () => {
      const iterator = new GraphemeIterator('👨‍👩‍👧‍👦') // family emoji
      const graphemes = Array.from(iterator)
      expect(graphemes).toHaveLength(1)
    })

    it('should handle multiple emoji', () => {
      const iterator = new GraphemeIterator('👍👎')
      const graphemes = Array.from(iterator)
      expect(graphemes).toHaveLength(2)
      expect(graphemes[0]).toBe('👍')
      expect(graphemes[1]).toBe('👎')
    })
  })

  describe('Regional indicators (flags)', () => {
    it('should treat flag emoji as one grapheme', () => {
      const iterator = new GraphemeIterator('🇺🇸') // US flag
      const graphemes = Array.from(iterator)
      expect(graphemes).toHaveLength(1)
      expect(graphemes[0]).toBe('🇺🇸')
    })

    it('should handle multiple flags', () => {
      const iterator = new GraphemeIterator('🇺🇸🇬🇧') // US + UK flags
      const graphemes = Array.from(iterator)
      expect(graphemes).toHaveLength(2)
    })
  })

  describe('Mixed content', () => {
    it('should handle ASCII and emoji mix', () => {
      const iterator = new GraphemeIterator('Hello 👍 World')
      const graphemes = Array.from(iterator)
      expect(graphemes).toContain('👍')
      expect(graphemes).toContain('H')
      expect(graphemes).toContain(' ')
    })

    it('should handle CJK and emoji mix', () => {
      const iterator = new GraphemeIterator('你好👍')
      const graphemes = Array.from(iterator)
      expect(graphemes).toHaveLength(3)
      expect(graphemes[0]).toBe('你')
      expect(graphemes[1]).toBe('好')
      expect(graphemes[2]).toBe('👍')
    })
  })

  describe('toArray()', () => {
    it('should return array of graphemes', () => {
      const iterator = new GraphemeIterator('Hello')
      const graphemes = iterator.toArray()
      expect(Array.isArray(graphemes)).toBe(true)
      expect(graphemes).toEqual(['H', 'e', 'l', 'l', 'o'])
    })

    it('should work with emoji', () => {
      const iterator = new GraphemeIterator('👨‍👩‍👧‍👦')
      const graphemes = iterator.toArray()
      expect(graphemes).toHaveLength(1)
    })
  })

  describe('count()', () => {
    it('should return correct count for ASCII', () => {
      const iterator = new GraphemeIterator('Hello')
      expect(iterator.count()).toBe(5)
    })

    it('should return correct count for CJK', () => {
      const iterator = new GraphemeIterator('你好')
      expect(iterator.count()).toBe(2)
    })

    it('should return correct count for emoji', () => {
      const iterator = new GraphemeIterator('👍👎')
      expect(iterator.count()).toBe(2)
    })

    it('should return correct count for ZWJ sequence', () => {
      const iterator = new GraphemeIterator('👨‍👩‍👧‍👦')
      expect(iterator.count()).toBe(1)
    })

    it('should return 0 for empty string', () => {
      const iterator = new GraphemeIterator('')
      expect(iterator.count()).toBe(0)
    })

    it('should return correct count for combining marks', () => {
      const iterator = new GraphemeIterator('café')
      expect(iterator.count()).toBe(4)
    })
  })

  describe('at()', () => {
    it('should return grapheme at index', () => {
      const iterator = new GraphemeIterator('Hello')
      expect(iterator.at(0)).toBe('H')
      expect(iterator.at(1)).toBe('e')
      expect(iterator.at(4)).toBe('o')
    })

    it('should return undefined for out of bounds', () => {
      const iterator = new GraphemeIterator('Hello')
      expect(iterator.at(5)).toBeUndefined()
      expect(iterator.at(10)).toBeUndefined()
    })

    it('should work with emoji', () => {
      const iterator = new GraphemeIterator('👍👎👌')
      expect(iterator.at(0)).toBe('👍')
      expect(iterator.at(1)).toBe('👎')
      expect(iterator.at(2)).toBe('👌')
    })

    it('should work with ZWJ sequences', () => {
      const iterator = new GraphemeIterator('👨‍👩‍👧‍👦')
      expect(iterator.at(0)).toBe('👨‍👩‍👧‍👦')
      expect(iterator.at(1)).toBeUndefined()
    })

    it('should work with CJK', () => {
      const iterator = new GraphemeIterator('你好')
      expect(iterator.at(0)).toBe('你')
      expect(iterator.at(1)).toBe('好')
    })
  })

  describe('Reusability', () => {
    it('should allow multiple iterations', () => {
      const iterator = new GraphemeIterator('Hello')
      const first = Array.from(iterator)
      const second = Array.from(iterator)
      expect(first).toEqual(second)
      expect(first).toEqual(['H', 'e', 'l', 'l', 'o'])
    })
  })
})
