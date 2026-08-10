import { parse, strip } from '@lpm.dev/neo.ansi'
import { describe, expect, it } from 'vitest'
import {
  padToWidth,
  sliceByWidth,
  splitByWidth,
  stringWidth,
  truncateToWidth,
} from '../../src/index.js'
import { GraphemeIterator } from '../../src/core/grapheme-iterator.js'
import {
  EAST_ASIAN_WIDTH_RANGES,
  GRAPHEME_BREAK_RANGES,
  getEastAsianWidth,
} from '../../src/core/unicode-data.js'

describe('release-blocker regressions', () => {
  describe('Unicode 16 data and segmentation', () => {
    it('ships complete generated property tables', () => {
      expect(EAST_ASIAN_WIDTH_RANGES.length).toBeGreaterThan(1000)
      expect(GRAPHEME_BREAK_RANGES.length).toBeGreaterThan(1000)
      expect(getEastAsianWidth(0x2e80)).toBe('W')
      expect(getEastAsianWidth(0x231a)).toBe('W')
      expect(getEastAsianWidth(0x00a1)).toBe('A')
    })

    it('handles previously mismeasured Unicode sequences', () => {
      expect(stringWidth('⺀')).toBe(2)
      expect(stringWidth('⌚')).toBe(2)
      expect(stringWidth('1️⃣')).toBe(2)
      expect(stringWidth('☝🏽')).toBe(2)
      expect(stringWidth('a\u05b0')).toBe(1)
      expect(stringWidth('가')).toBe(2)
      expect(stringWidth('¡', { ambiguousIsNarrow: false })).toBe(2)
    })

    it('implements extended grapheme rules without host Intl data', () => {
      expect(new GraphemeIterator('🇺🇸').toArray()).toEqual(['🇺🇸'])
      expect(new GraphemeIterator('क्\u0937').toArray()).toEqual(['क्\u0937'])
      expect(new GraphemeIterator('👩🏽‍💻').toArray()).toEqual(['👩🏽‍💻'])
    })

    it('treats controls and default-ignorables as zero width', () => {
      expect(stringWidth('a\nb\t\r')).toBe(2)
      expect(stringWidth('\ufe0f')).toBe(0)
      expect(stringWidth('\u061c')).toBe(0)
    })
  })

  describe('ANSI-safe transformations', () => {
    const colored = '\x1b[31mHello World\x1b[0m'

    it('recognizes 8-bit C1 ANSI sequences', () => {
      expect(stringWidth('\u009b31mRed\u009b0m')).toBe(3)
    })

    it('never cuts an ANSI sequence and closes truncated styles', () => {
      const result = truncateToWidth(colored, 5)
      expect(strip(result)).toBe('Hell…')
      expect(stringWidth(result)).toBe(5)
      expect(result.endsWith('…')).toBe(true)
      expect(parse(result).sequences.every((sequence) => sequence.type !== 'unknown')).toBe(true)
    })

    it('balances styles for slices and every split chunk', () => {
      const sliced = sliceByWidth(colored, 0, 5)
      expect(strip(sliced)).toBe('Hello')
      expect(sliced.endsWith('\x1b[0m')).toBe(true)

      const chunks = splitByWidth(colored, 5)
      expect(chunks.map((chunk) => strip(chunk))).toEqual(['Hello', 'World'])
      expect(chunks.every((chunk) => chunk.endsWith('\x1b[0m'))).toBe(true)
      expect(chunks.every((chunk) => stringWidth(chunk) <= 5)).toBe(true)
    })

    it('closes and reopens OSC 8 hyperlinks at boundaries', () => {
      const hyperlink =
        '\x1b]8;;https://example.com\x1b\\Hello World\x1b]8;;\x1b\\'
      const chunks = splitByWidth(hyperlink, 5)
      expect(chunks.map((chunk) => strip(chunk))).toEqual(['Hello', 'World'])
      expect(
        chunks.every((chunk) => chunk.endsWith('\x1b]8;;\x1b\\'))
      ).toBe(true)
    })
  })

  describe('option propagation and public boundaries', () => {
    it('passes emoji width options through every helper', () => {
      expect(padToWidth('👍', 3, { emojiWidth: 1 })).toBe('👍  ')
      expect(truncateToWidth('👍👍', 3, { emojiWidth: 1 })).toBe('👍👍')
      expect(sliceByWidth('👍👍', 1, 2, { emojiWidth: 1 })).toBe('👍')
      expect(splitByWidth('👍👍', 2, { emojiWidth: 1 })).toEqual(['👍👍'])
    })

    it('counts ANSI safely when helpers receive countAnsiEscapeCodes', () => {
      const options = { countAnsiEscapeCodes: true } as const
      const colored = '\x1b[31mHello World\x1b[0m'
      expect(stringWidth(truncateToWidth(colored, 10, options), options)).toBeLessThanOrEqual(10)
      expect(stringWidth(sliceByWidth(colored, 0, 10, options), options)).toBeLessThanOrEqual(10)
      expect(
        splitByWidth(colored, 14, options).every(
          (chunk) => stringWidth(chunk, options) <= 14
        )
      ).toBe(true)

      const padded = padToWidth('\x1b[31mR', 15, options)
      expect(stringWidth(padded, options)).toBe(15)
    })

    it('does not emit partial wide characters or UTF-16 surrogates', () => {
      expect(truncateToWidth('abcdef', 1, { ellipsis: '👍' })).toBe('')
      expect(truncateToWidth('abcdef', 1, { ellipsis: '。' })).toBe('')
      expect(sliceByWidth('你', 0, 1)).toBe('')
      expect(sliceByWidth('你', 0, 1, { ellipsis: '…' })).toBe('…')
    })

    it('pads multi-grapheme patterns to the requested width', () => {
      const result = padToWidth('x', 4, { padChar: 'ab' })
      expect(result).toBe('xaba')
      expect(stringWidth(result)).toBe(4)
    })

    it('rejects invalid or impossible widths', () => {
      expect(() => truncateToWidth('text', Number.NaN)).toThrow(RangeError)
      expect(() => padToWidth('text', Number.POSITIVE_INFINITY)).toThrow(RangeError)
      expect(() => sliceByWidth('text', 0.5)).toThrow(RangeError)
      expect(() => splitByWidth('text', 0)).toThrow(RangeError)
      expect(() => splitByWidth('你', 1)).toThrow(RangeError)
    })
  })

  describe('streaming helper paths', () => {
    const plainCases = [
      'Hello World Test',
      '你好世界测试',
      '👍🏻 👍🏿 👨‍👩‍👧‍👦',
      'A\u200bB\nC',
      '  mixed 你好 👍 text  ',
    ]

    it('matches the ANSI token path for equivalent visible text', () => {
      const forceTokenPath = (text: string): string => `${text}\x1b[0m`

      for (const text of plainCases) {
        for (let width = 0; width <= 12; width++) {
          for (const options of [
            {},
            { position: 'start' as const },
            { position: 'middle' as const },
            { wordBoundary: true },
            { ellipsis: '...' },
          ]) {
            expect(truncateToWidth(text, width, options)).toBe(
              strip(truncateToWidth(forceTokenPath(text), width, options))
            )
          }

          for (const end of [width, width + 3, width + 8]) {
            expect(sliceByWidth(text, width, end)).toBe(
              strip(sliceByWidth(forceTokenPath(text), width, end))
            )
          }
        }

        for (let maxWidth = 1; maxWidth <= 12; maxWidth++) {
          for (const options of [
            {},
            { preferSplitOnSpace: false },
            { preserveWhitespace: true },
          ]) {
            let plain: string[] | RangeError
            let tokenized: string[] | RangeError
            try {
              plain = splitByWidth(text, maxWidth, options)
            } catch (error) {
              plain = error as RangeError
            }
            try {
              tokenized = splitByWidth(forceTokenPath(text), maxWidth, options)
            } catch (error) {
              tokenized = error as RangeError
            }

            if (plain instanceof RangeError || tokenized instanceof RangeError) {
              expect(plain).toBeInstanceOf(RangeError)
              expect(tokenized).toBeInstanceOf(RangeError)
            } else {
              expect(plain).toEqual(tokenized.map((chunk) => strip(chunk)))
            }
          }
        }
      }
    })
  })
})
