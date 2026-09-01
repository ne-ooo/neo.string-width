import { parse, strip } from '@lpm.dev/neo.ansi'
import { describe, expect, it } from 'vitest'
import {
  COMBINING_MARK_RANGES,
  EMOJI_RANGES,
  ZERO_WIDTH_CHARS,
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

    it('measures every visible component of a grapheme cluster', () => {
      expect(stringWidth('का')).toBe(2)
      expect(stringWidth('ｶﾞ')).toBe(2)
      expect(stringWidth('ᄀ가')).toBe(4)
      expect(stringWidth('가ᅡ')).toBe(stringWidth('가ᅡ'))
      expect(stringWidth('각ᆨ')).toBe(stringWidth('각ᆨ'))
      expect(stringWidth('\u093e')).toBe(1)
      expect(stringWidth('\u0600')).toBe(0)
    })

    it('only promotes structurally valid emoji sequences', () => {
      expect(stringWidth('A\ufe0f')).toBe(1)
      expect(stringWidth('A\u20e3')).toBe(1)
      expect(stringWidth('©\u{1f3fb}')).toBe(1)
      expect(stringWidth('©\u200d')).toBe(1)
      expect(stringWidth('⌚\ufe0e')).toBe(2)
      expect(stringWidth('🇬')).toBe(1)
      expect(stringWidth('🇬🇧')).toBe(2)
      expect(stringWidth('👍ﾞ')).toBe(3)
      expect(stringWidth('1\u20e3\ufe0f')).toBe(1)
      expect(stringWidth('\u2388\ufe0f')).toBe(1)
      expect(stringWidth('\u2605\ufe0f')).toBe(1)
      expect(stringWidth('👍\u0301', { emojiWidth: 1 })).toBe(1)
      expect(stringWidth('👍ﾞ', { emojiWidth: 1 })).toBe(2)
      expect(stringWidth('👍\u200d', { emojiWidth: 1 })).toBe(1)
      expect(stringWidth('👩‍💻ﾞ')).toBe(3)
      expect(stringWidth('👩‍💻ﾞ', { emojiWidth: 1 })).toBe(2)
      for (const emoji of ['☺️', '🖐🏻', '1️⃣', '🇬🇧']) {
        expect(stringWidth(`${emoji}ﾞ`)).toBe(3)
        expect(stringWidth(`${emoji}ﾞ`, { emojiWidth: 1 })).toBe(2)
      }
      expect(stringWidth('☺️ﾞ\u0301')).toBe(3)
      expect(stringWidth('🖐🏻ﾞ\u0301')).toBe(3)
      expect(stringWidth('☺️ﾞ\ufe0e')).toBe(3)
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

    it('keeps balanced helper output within the global ANSI ceiling', () => {
      const hyperlink = '\x1b]8;;https://example.com\x1b\\'
      const composableState = hyperlink + '\x1b[31m'.repeat(125)
      const composable = `${composableState}ab`
      const outputs = [
        truncateToWidth(composable, 1, { ellipsis: '' }),
        sliceByWidth(composable, 0, 1),
        splitByWidth(composable, 1, { preserveWhitespace: true })[0]!,
        padToWidth(`${composableState}a`, 2),
      ]

      expect(outputs.map((output) => stringWidth(output))).toEqual([1, 1, 1, 2])
      expect(
        outputs.every((output) => parse(output).sequences.length <= 128)
      ).toBe(true)

      const excessiveState = hyperlink + '\x1b[31m'.repeat(126)
      const excessive = `${excessiveState}ab`
      expect(stringWidth(excessive)).toBe(2)
      expect(() =>
        truncateToWidth(excessive, 1, { ellipsis: '' })
      ).toThrow('input contains too many ANSI sequence introducers')
      expect(stringWidth(sliceByWidth(excessive, 0, 1))).toBe(1)
      expect(() =>
        splitByWidth(excessive, 1, { preserveWhitespace: true })
      ).toThrow(RangeError)
      expect(() => padToWidth(`${excessiveState}a`, 2)).toThrow(RangeError)
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

    it('keeps ANSI state replay proportional to the input', () => {
      const repetitions = 100
      const styled = '\x1b[31m'.repeat(repetitions) + 'a'.repeat(repetitions)
      const chunks = splitByWidth(styled, 1)
      const outputLength = chunks.reduce((total, chunk) => total + chunk.length, 0)

      expect(chunks.map((chunk) => strip(chunk)).join('')).toBe(
        'a'.repeat(repetitions)
      )
      expect(outputLength).toBeLessThan(styled.length * 5)
    })

    it('bounds sparse ANSI split range metadata', () => {
      const oversized = '\x1b[0m' + 'a'.repeat(1_048_577)
      expect(() =>
        splitByWidth(oversized, 1, { preferSplitOnSpace: false })
      ).toThrow('ANSI split output contains too many chunks')
    })

    it('snapshots split options before ANSI range preflight', () => {
      let preserveWhitespaceReads = 0
      const statefulOptions = {
        get preserveWhitespace(): boolean {
          preserveWhitespaceReads++
          return preserveWhitespaceReads >= 2
        },
      }
      const input = `a ${'\x1b[31m'.repeat(128)}b`
      const chunks = splitByWidth(input, 1, statefulOptions)

      expect(preserveWhitespaceReads).toBe(1)
      expect(chunks.map((chunk) => strip(chunk))).toEqual(['a', 'b'])
      expect(chunks.every((chunk) => stringWidth(chunk) === 1)).toBe(true)
    })

    it('rejects coercible emoji widths before measuring text', () => {
      let coercions = 0
      const statefulWidth = {
        valueOf(): number {
          coercions++
          return coercions < 10 ? 1 : 2
        },
      }

      expect(() =>
        splitByWidth('\x1b[31m' + '😀'.repeat(20_000), 2, {
          emojiWidth: statefulWidth as unknown as 1,
        })
      ).toThrow(TypeError)
      expect(coercions).toBe(0)
    })

    it('canonicalizes overridden and selectively reset SGR state', () => {
      const styled = '\x1b[1;31mA\x1b[34mB\x1b[39mC'
      const blueBold = sliceByWidth(styled, 1, 2)
      const defaultBold = sliceByWidth(styled, 2, 3)

      expect(strip(blueBold)).toBe('B')
      expect(blueBold.startsWith('\x1b[1;34m')).toBe(true)
      expect(strip(defaultBold)).toBe('C')
      expect(defaultBold.startsWith('\x1b[1m')).toBe(true)
    })

    it('bounds replay of oversized SGR and hyperlink state', () => {
      const repetitions = 1_000
      const longValue = '1'.repeat(3_000)
      const longSgr =
        `\x1b[38:${longValue}m` + 'a'.repeat(repetitions)
      const longLink =
        `\x1b]8;;https://${longValue}\x1b\\` +
        'a'.repeat(repetitions) +
        '\x1b]8;;\x1b\\'

      for (const input of [longSgr, longLink]) {
        const outputLength = splitByWidth(input, 1).reduce(
          (total, chunk) => total + chunk.length,
          0
        )
        expect(outputLength).toBeLessThan(input.length * 5)
      }
    })

    it('rejects excessive aggregate ANSI state replay', () => {
      const link =
        `\x1b]8;;https://${'x'.repeat(2_000)}\x1b\\` +
        'a'.repeat(1_000) +
        '\x1b]8;;\x1b\\'

      expect(() => splitByWidth(link, 1)).toThrow(
        'ANSI-balanced output exceeds the safe expansion limit'
      )
    })

    it('rejects ANSI-only counted ranges without quadratic scanning', () => {
      const ansiOnly = '\x1b[31m'.repeat(2_000)
      expect(() =>
        splitByWidth(ansiOnly, ansiOnly.length - 5, {
          countAnsiEscapeCodes: true,
          preserveWhitespace: true,
        })
      ).toThrow(RangeError)
    })

    it('rejects excessive CSI parameter and sequence complexity pre-parse', () => {
      expect(() => splitByWidth(`\x1b[${';'.repeat(5_000)}mAA`, 1)).toThrow(
        'ANSI CSI parameters exceed the safe limit'
      )
      expect(() =>
        stringWidth('\x1b[31m'.repeat(8_193), {
          countAnsiEscapeCodes: true,
        })
      ).toThrow('input contains too many ANSI sequence introducers')

      const parameterHeavyUnit = `\x1b[${';'.repeat(256)}m\0`
      expect(() =>
        splitByWidth(parameterHeavyUnit.repeat(17), 1)
      ).toThrow('ANSI CSI parameters exceed the safe limit')

      expect(() =>
        splitByWidth('\x1b[31m\0'.repeat(129) + 'aa', 1)
      ).toThrow('input contains too many ANSI sequence introducers')
    })

    it('keeps zero-width text following an ANSI truncation boundary', () => {
      for (const zeroWidth of ['\0', '\t', '\u200b', '\u061c']) {
        const input = `\x1b[31ma${zeroWidth}b\x1b[0m`
        expect(strip(truncateToWidth(input, 1, { ellipsis: '' }))).toBe(
          `a${zeroWidth}`
        )
      }
    })

    it('preserves non-state ANSI sequences owned by retained boundaries', () => {
      expect(
        truncateToWidth('\x1b[2Jabcdef', 3, { ellipsis: '' })
      ).toBe('\x1b[2Jabc')
      expect(
        splitByWidth('\x1b[2Jabcdef', 3, { preserveWhitespace: true })
      ).toEqual(['\x1b[2Jabc', 'def'])
      expect(splitByWidth('\x1b[2Jabcdef', 3)).toEqual([
        '\x1b[2Jabc',
        'def',
      ])
      expect(
        splitByWidth('abc\x1b[2Jdef\x1b[1K', 3, {
          preserveWhitespace: true,
        })
      ).toEqual(['abc\x1b[2J', 'def\x1b[1K'])
      expect(splitByWidth('abc\x1b[2Jdef\x1b[1K', 3)).toEqual([
        'abc\x1b[2J',
        'def\x1b[1K',
      ])
    })

    it('keeps zero-width whitespace word boundaries consistent with plain text', () => {
      for (const options of [
        { width: 1, ellipsis: '…' },
        { width: 0, ellipsis: '' },
      ]) {
        const truncateOptions = {
          wordBoundary: true,
          ellipsis: options.ellipsis,
        }
        expect(
          strip(
            truncateToWidth(
              '\t\n\x1b[31mab\x1b[0m',
              options.width,
              truncateOptions
            )
          )
        ).toBe(truncateToWidth('\t\nab', options.width, truncateOptions))
      }

      expect(
        truncateToWidth('\t\nab\x1b[0m', 0, {
          wordBoundary: true,
          ellipsis: '',
          countAnsiEscapeCodes: true,
        })
      ).toBe('\t')
    })

    it('rejects canceled or interrupted ANSI control strings', () => {
      for (const introducer of ['\x1b]0;x', '\x9d0;x', '\x1bP1;', '\x901;']) {
        for (const cancellation of ['\x18', '\x1a', '\x1b[31m']) {
          const input = introducer + cancellation + 'visible'
          expect(() => stringWidth(input)).toThrow(
            'ANSI control string contains an unsafe cancellation sequence'
          )
          expect(() => truncateToWidth(input, 1)).toThrow(RangeError)
          expect(() => splitByWidth(input, 1)).toThrow(RangeError)
        }
      }
    })

    it('does not count zero-width Hangul fillers in Hangul clusters', () => {
      expect(stringWidth('\u115f\u1160')).toBe(0)
      expect(stringWidth('\u115f\u1191')).toBe(1)
      expect(stringWidth('\u1160\u11a8')).toBe(1)
      expect(stringWidth('\u115f\u1160\u11a8')).toBe(1)
    })
  })

  describe('option propagation and public boundaries', () => {
    it('passes emoji width options through every helper', () => {
      expect(padToWidth('👍', 3, { emojiWidth: 1 })).toBe('👍  ')
      expect(truncateToWidth('👍👍', 3, { emojiWidth: 1 })).toBe('👍👍')
      expect(sliceByWidth('👍👍', 1, 2, { emojiWidth: 1 })).toBe('👍')
      expect(splitByWidth('👍👍', 2, { emojiWidth: 1 })).toEqual(['👍👍'])
    })

    it('uses defaults when optional properties are explicitly undefined', () => {
      expect(stringWidth('👍', { emojiWidth: undefined })).toBe(2)
      expect(stringWidth('─', { ambiguousIsNarrow: undefined })).toBe(1)
      expect(padToWidth('x', 3, { padChar: undefined })).toBe('x  ')
      expect(truncateToWidth('abcdef', 3, { ellipsis: undefined })).toBe('ab…')
    })

    it('clamps plain slice endpoints to the source width', () => {
      expect(sliceByWidth('你', 1, undefined, { ellipsis: '..' })).toBe('.')
      expect(sliceByWidth('你', 1, 10, { ellipsis: '。' })).toBe('')
    })

    it('keeps word-boundary behavior independent of ANSI', () => {
      const options = { wordBoundary: true, ellipsis: '' }
      expect(truncateToWidth(' Hello', 1, options)).toBe(' ')
      expect(
        strip(truncateToWidth('\x1b[31m Hello\x1b[0m', 1, options))
      ).toBe(' ')
    })

    it('honors word boundaries for middle truncation', () => {
      const options = {
        position: 'middle' as const,
        wordBoundary: true,
      }
      const plain = truncateToWidth('Hello wonderful World', 15, options)
      const styled = truncateToWidth(
        '\x1b[31mHello wonderful World\x1b[0m',
        15,
        options
      )

      expect(plain).toBe('Hello… World')
      expect(strip(styled)).toBe(plain)
    })

    it('does not expose mutable internal Unicode tables', () => {
      const mutableCombiningRanges = COMBINING_MARK_RANGES as unknown as {
        length: number
      }
      const mutableEmojiRange = EMOJI_RANGES[0] as unknown as [number, number]
      const mutableZeroWidth = ZERO_WIDTH_CHARS as Set<number>

      expect(Object.isFrozen(COMBINING_MARK_RANGES)).toBe(true)
      expect(Object.isFrozen(COMBINING_MARK_RANGES[0])).toBe(true)
      expect(Object.isFrozen(EMOJI_RANGES)).toBe(true)
      expect(Object.isFrozen(EMOJI_RANGES[0])).toBe(true)
      expect(Object.isFrozen(ZERO_WIDTH_CHARS)).toBe(true)
      expect(() => {
        mutableCombiningRanges.length = 0
      }).toThrow(TypeError)
      expect(() => {
        mutableEmojiRange[0] = 0
      }).toThrow(TypeError)
      expect(() => mutableZeroWidth.clear()).toThrow(TypeError)
      expect(ZERO_WIDTH_CHARS.has(0x200b)).toBe(true)

      const originalHas = Set.prototype.has
      try {
        Set.prototype.has = function poisonedHas(value): boolean {
          Set.prototype.clear.call(this)
          return originalHas.call(this, value)
        }
        expect(ZERO_WIDTH_CHARS.has(0x200b)).toBe(true)
        expect(ZERO_WIDTH_CHARS.size).toBe(5)
      } finally {
        Set.prototype.has = originalHas
      }
      expect(stringWidth('\u0301')).toBe(0)
      expect(stringWidth('😀', { emojiWidth: 1 })).toBe(1)
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

      const oversized = '\x1b[31m' + 'a'.repeat(4_096)
      expect(stringWidth(oversized, options)).toBe(4_101)
      expect(() => truncateToWidth(oversized, 10, options)).toThrow(
        'counted ANSI helper input exceeds the safe length limit'
      )
      expect(() => sliceByWidth(oversized, 0, 10, options)).toThrow(RangeError)
      expect(() => splitByWidth(oversized, 10, options)).toThrow(RangeError)
      expect(() => padToWidth(oversized, 70_000, options)).toThrow(RangeError)

      const denseState = '\u009b1m'.repeat(129)
      expect(() => truncateToWidth(denseState + 'aa', 1, options)).toThrow(
        RangeError
      )
      expect(() => splitByWidth(denseState + 'aa', 1, options)).toThrow(
        RangeError
      )
      expect(() =>
        truncateToWidth('abcdef', 1, {
          ...options,
          ellipsis: denseState,
        })
      ).toThrow(RangeError)
      expect(() =>
        sliceByWidth('你', 0, 1, { ...options, ellipsis: denseState })
      ).toThrow(RangeError)
      expect(() =>
        padToWidth('x', 2, { ...options, padChar: denseState })
      ).toThrow(RangeError)

      const stTerminatedOsc = '\x1b]8;;x\x1b\\'.repeat(128)
      expect(() =>
        truncateToWidth(stTerminatedOsc + 'a', 1, {
          ...options,
          ellipsis: '',
        })
      ).not.toThrow()
      expect(() =>
        truncateToWidth(`${stTerminatedOsc}\x1b]8;;x\x1b\\a`, 1, {
          ...options,
          ellipsis: '',
        })
      ).toThrow(RangeError)
      expect(() =>
        sliceByWidth('', 0, 1, {
          ...options,
          ellipsis: 'x'.repeat(4_097),
        })
      ).toThrow('counted ANSI helper input exceeds the safe length limit')
    })

    it('does not emit partial wide characters or UTF-16 surrogates', () => {
      expect(truncateToWidth('abcdef', 1, { ellipsis: '👍' })).toBe('')
      expect(truncateToWidth('abcdef', 1, { ellipsis: '。' })).toBe('')
      expect(sliceByWidth('你', 0, 1)).toBe('')
      expect(sliceByWidth('你', 0, 1, { ellipsis: '…' })).toBe('…')
    })

    it('coalesces zero-width runs without changing helper output', () => {
      const zeroes = '\0'.repeat(10_000)
      expect(sliceByWidth(`${zeroes}a`, -1)).toBe('a')
      expect(
        splitByWidth(`\x1b[31m${zeroes}aa`, 1).map((chunk) => strip(chunk))
      ).toEqual([`${zeroes}a`, 'a'])
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
