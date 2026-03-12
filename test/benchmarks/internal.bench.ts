/**
 * Internal performance benchmarks
 *
 * Benchmarks for individual functions and optimizations
 */

import { bench, describe } from 'vitest'
import { stringWidth } from '../../src/index.js'
import { getEastAsianWidth } from '../../src/core/unicode-data.js'
import { GraphemeIterator } from '../../src/core/grapheme-iterator.js'
import { isAsciiOnly, isZeroWidth } from '../../src/core/constants.js'

describe('Internal: Fast-path optimization', () => {
  const ascii = 'Hello World'
  const unicode = 'Hello 世界'

  bench('isAsciiOnly (ASCII)', () => {
    isAsciiOnly(ascii)
  })

  bench('isAsciiOnly (Unicode)', () => {
    isAsciiOnly(unicode)
  })

  bench('stringWidth (ASCII - fast path)', () => {
    stringWidth(ascii)
  })

  bench('stringWidth (Unicode - slow path)', () => {
    stringWidth(unicode)
  })
})

describe('Internal: East Asian Width lookup', () => {
  const testCodePoints = [
    0x0041, // 'A' (ASCII)
    0x4e00, // '一' (CJK)
    0x3000, // Ideographic space
    0xff01, // Fullwidth !
    0x1f600, // 😀 emoji
  ]

  for (const codePoint of testCodePoints) {
    bench(`getEastAsianWidth(0x${codePoint.toString(16)})`, () => {
      getEastAsianWidth(codePoint)
    })
  }

  bench('getEastAsianWidth (batch 1000 CJK)', () => {
    for (let i = 0; i < 1000; i++) {
      getEastAsianWidth(0x4e00 + (i % 100))
    }
  })
})

describe('Internal: Grapheme iteration', () => {
  const ascii = 'Hello World'
  const cjk = '你好世界'
  const emoji = '👍👎👌'
  const complex = '👨‍👩‍👧‍👦'

  bench('GraphemeIterator (ASCII)', () => {
    const iterator = new GraphemeIterator(ascii)
    for (const _ of iterator) {
      // iterate
    }
  })

  bench('GraphemeIterator (CJK)', () => {
    const iterator = new GraphemeIterator(cjk)
    for (const _ of iterator) {
      // iterate
    }
  })

  bench('GraphemeIterator (emoji)', () => {
    const iterator = new GraphemeIterator(emoji)
    for (const _ of iterator) {
      // iterate
    }
  })

  bench('GraphemeIterator (complex emoji)', () => {
    const iterator = new GraphemeIterator(complex)
    for (const _ of iterator) {
      // iterate
    }
  })
})

describe('Internal: Zero-width detection', () => {
  const zeroWidthChars = [
    0x200b, // ZWSP
    0x200c, // ZWNJ
    0x200d, // ZWJ
    0xfeff, // BOM
    0x0300, // Combining grave
  ]

  const regularChars = [0x0041, 0x4e00, 0x1f600]

  for (const codePoint of zeroWidthChars) {
    bench(`isZeroWidth(0x${codePoint.toString(16)}) - zero-width`, () => {
      isZeroWidth(codePoint)
    })
  }

  for (const codePoint of regularChars) {
    bench(`isZeroWidth(0x${codePoint.toString(16)}) - regular`, () => {
      isZeroWidth(codePoint)
    })
  }
})

describe('Internal: Full pipeline', () => {
  const testStrings = {
    'Empty': '',
    'Short ASCII': 'Test',
    'Medium ASCII': 'The quick brown fox',
    'Long ASCII': 'a'.repeat(1000),
    'Short CJK': '你好',
    'Medium CJK': '你好，世界！这是测试。',
    'Short emoji': '👍👎',
    'ANSI colored': '\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m',
    'Mixed': 'Hello 世界 👍 \x1b[31mRed\x1b[0m',
  }

  for (const [name, str] of Object.entries(testStrings)) {
    bench(`Full pipeline: ${name}`, () => {
      stringWidth(str)
    })
  }
})

describe('Internal: Memory efficiency', () => {
  const shortString = 'Test'
  const longString = 'a'.repeat(10000)

  bench('Memory: short string (repeated 1000x)', () => {
    for (let i = 0; i < 1000; i++) {
      stringWidth(shortString)
    }
  })

  bench('Memory: long string (repeated 100x)', () => {
    for (let i = 0; i < 100; i++) {
      stringWidth(longString)
    }
  })
})
