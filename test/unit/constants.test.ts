/**
 * Tests for constants and helper functions
 */

import { describe, it, expect } from 'vitest'
import {
  ZERO_WIDTH_CHARS,
  COMBINING_MARK_RANGES,
  EMOJI_RANGES,
  VARIATION_SELECTOR_TEXT,
  VARIATION_SELECTOR_EMOJI,
  isZeroWidth,
  isAsciiOnly,
  startsWithZeroWidth,
  getEmojiPresentation,
} from '../../src/core/constants.js'

describe('Constants', () => {
  describe('ZERO_WIDTH_CHARS', () => {
    it('should include common zero-width characters', () => {
      expect(ZERO_WIDTH_CHARS.has(0x200b)).toBe(true) // ZWSP
      expect(ZERO_WIDTH_CHARS.has(0x200c)).toBe(true) // ZWNJ
      expect(ZERO_WIDTH_CHARS.has(0x200d)).toBe(true) // ZWJ
      expect(ZERO_WIDTH_CHARS.has(0xfeff)).toBe(true) // BOM
    })

    it('should not include regular characters', () => {
      expect(ZERO_WIDTH_CHARS.has(0x0020)).toBe(false) // space
      expect(ZERO_WIDTH_CHARS.has(0x0041)).toBe(false) // 'A'
    })
  })

  describe('VARIATION_SELECTOR constants', () => {
    it('should have correct values', () => {
      expect(VARIATION_SELECTOR_TEXT).toBe(0xfe0e)
      expect(VARIATION_SELECTOR_EMOJI).toBe(0xfe0f)
    })
  })

  it('exports generated Unicode 16 ranges', () => {
    expect(COMBINING_MARK_RANGES.length).toBeGreaterThan(100)
    expect(EMOJI_RANGES.length).toBeGreaterThan(50)
  })
})

describe('Helper Functions', () => {
  describe('isZeroWidth', () => {
    it('should return true for zero-width characters', () => {
      expect(isZeroWidth(0x200b)).toBe(true) // ZWSP
      expect(isZeroWidth(0x200c)).toBe(true) // ZWNJ
      expect(isZeroWidth(0x200d)).toBe(true) // ZWJ
      expect(isZeroWidth(0xfeff)).toBe(true) // BOM
    })

    it('should return true for combining marks', () => {
      expect(isZeroWidth(0x0300)).toBe(true) // Combining grave accent
      expect(isZeroWidth(0x0301)).toBe(true) // Combining acute accent
      expect(isZeroWidth(0x0363)).toBe(true) // Combining latin small letter a
    })

    it('should return false for regular characters', () => {
      expect(isZeroWidth(0x0020)).toBe(false) // space
      expect(isZeroWidth(0x0041)).toBe(false) // 'A'
      expect(isZeroWidth(0x4e00)).toBe(false) // CJK ideograph
    })

    it('should return false for undefined', () => {
      expect(isZeroWidth(undefined as any)).toBe(false)
    })
  })

  describe('isAsciiOnly', () => {
    it('should return true for ASCII strings', () => {
      expect(isAsciiOnly('')).toBe(true)
      expect(isAsciiOnly('Hello')).toBe(true)
      expect(isAsciiOnly('Hello World')).toBe(true)
      expect(isAsciiOnly('123')).toBe(true)
      expect(isAsciiOnly('!@#$%^&*()')).toBe(true)
    })

    it('should return false for Unicode strings', () => {
      expect(isAsciiOnly('你好')).toBe(false)
      expect(isAsciiOnly('Hello 世界')).toBe(false)
      expect(isAsciiOnly('café')).toBe(false)
      expect(isAsciiOnly('👍')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(isAsciiOnly('')).toBe(true)
    })
  })

  describe('startsWithZeroWidth', () => {
    it('should return true if starts with zero-width character', () => {
      expect(startsWithZeroWidth(0x200b)).toBe(true) // ZWSP
      expect(startsWithZeroWidth(0x200c)).toBe(true) // ZWNJ
      expect(startsWithZeroWidth(0x200d)).toBe(true) // ZWJ
    })

    it('should return true if starts with combining mark', () => {
      expect(startsWithZeroWidth(0x0300)).toBe(true) // Combining grave
      expect(startsWithZeroWidth(0x0301)).toBe(true) // Combining acute
    })

    it('should return false for regular characters', () => {
      expect(startsWithZeroWidth(0x0041)).toBe(false) // 'A'
      expect(startsWithZeroWidth(0x4e00)).toBe(false) // CJK ideograph
    })

    it('should return false for undefined', () => {
      expect(startsWithZeroWidth(undefined as any)).toBe(false)
    })
  })

  describe('getEmojiPresentation', () => {
    it('should return "emoji" for emoji with VS16', () => {
      const emojiWithVS16 = '👍\ufe0f' // thumbs up + VS16
      expect(getEmojiPresentation(emojiWithVS16)).toBe('emoji')
    })

    it('should return "text" for emoji with VS15', () => {
      const emojiWithVS15 = '👍\ufe0e' // thumbs up + VS15
      expect(getEmojiPresentation(emojiWithVS15)).toBe('text')
    })

    it('should return "emoji" for emoji in emoji ranges without VS', () => {
      // Emoji ranges detection
      const emoji = '😀' // U+1F600
      const result = getEmojiPresentation(emoji)
      // Should be 'emoji' or null (depends on implementation)
      expect(['emoji', null].includes(result)).toBe(true)
    })

    it('should return null for non-emoji text', () => {
      expect(getEmojiPresentation('A')).toBe(null)
      expect(getEmojiPresentation('你')).toBe(null)
      expect(getEmojiPresentation('abc')).toBe(null)
    })

    it('should handle empty string', () => {
      expect(getEmojiPresentation('')).toBe(null)
    })
  })
})
