/**
 * Benchmarks vs string-width
 *
 * Performance comparison across different scenarios:
 * - ASCII strings (fast-path optimization target: 2-3x faster)
 * - CJK strings (target: 10-20% faster)
 * - Emoji strings (target: 10-20% faster)
 * - ANSI-colored strings (target: 10-15% faster with neo.ansi)
 * - Mixed content (target: 10-20% faster overall)
 */

import { bench, describe } from 'vitest'
import { stringWidth as neoStringWidth } from '../../src/index.js'

// Mock string-width for now (will compare when both are installed)
const stringWidthOriginal = (str: string) => {
  // Placeholder - in real benchmarks, import actual string-width
  return str.length
}

describe('Performance: ASCII strings (Fast Path)', () => {
  const asciiShort = 'Hello World'
  const asciiMedium = 'The quick brown fox jumps over the lazy dog'
  const asciiLong = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(
    10
  )

  bench('neo.string-width (short ASCII)', () => {
    neoStringWidth(asciiShort)
  })

  bench('string-width (short ASCII)', () => {
    stringWidthOriginal(asciiShort)
  })

  bench('neo.string-width (medium ASCII)', () => {
    neoStringWidth(asciiMedium)
  })

  bench('string-width (medium ASCII)', () => {
    stringWidthOriginal(asciiMedium)
  })

  bench('neo.string-width (long ASCII)', () => {
    neoStringWidth(asciiLong)
  })

  bench('string-width (long ASCII)', () => {
    stringWidthOriginal(asciiLong)
  })
})

describe('Performance: CJK strings', () => {
  const chinese = '你好，世界！这是一个测试字符串。'
  const japanese = 'こんにちは、世界！これはテストです。'
  const korean = '안녕하세요, 세계! 이것은 테스트입니다.'
  const mixed = 'Hello 你好 こんにちは 안녕하세요 World'

  bench('neo.string-width (Chinese)', () => {
    neoStringWidth(chinese)
  })

  bench('string-width (Chinese)', () => {
    stringWidthOriginal(chinese)
  })

  bench('neo.string-width (Japanese)', () => {
    neoStringWidth(japanese)
  })

  bench('string-width (Japanese)', () => {
    stringWidthOriginal(japanese)
  })

  bench('neo.string-width (Korean)', () => {
    neoStringWidth(korean)
  })

  bench('string-width (Korean)', () => {
    stringWidthOriginal(korean)
  })

  bench('neo.string-width (mixed languages)', () => {
    neoStringWidth(mixed)
  })

  bench('string-width (mixed languages)', () => {
    stringWidthOriginal(mixed)
  })
})

describe('Performance: Emoji strings', () => {
  const simpleEmoji = '👍 😀 🎉 ❤️ 🚀'
  const complexEmoji = '👨‍👩‍👧‍👦 👍🏻 🇺🇸'
  const emojiText = 'Great work! 🎉🎊 Keep it up! 💪🔥'

  bench('neo.string-width (simple emoji)', () => {
    neoStringWidth(simpleEmoji)
  })

  bench('string-width (simple emoji)', () => {
    stringWidthOriginal(simpleEmoji)
  })

  bench('neo.string-width (complex emoji)', () => {
    neoStringWidth(complexEmoji)
  })

  bench('string-width (complex emoji)', () => {
    stringWidthOriginal(complexEmoji)
  })

  bench('neo.string-width (emoji + text)', () => {
    neoStringWidth(emojiText)
  })

  bench('string-width (emoji + text)', () => {
    stringWidthOriginal(emojiText)
  })
})

describe('Performance: ANSI escape codes', () => {
  const coloredShort = '\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m \x1b[34mBlue\x1b[0m'
  const coloredMedium = '\x1b[31;1mBold Red Text\x1b[0m and \x1b[32;4mGreen Underline\x1b[0m and \x1b[33mYellow\x1b[0m'
  const coloredLong = ('\x1b[36mCyan text\x1b[0m with \x1b[1mbold\x1b[0m and \x1b[3mitalic\x1b[0m ').repeat(
    10
  )

  bench('neo.string-width (ANSI short)', () => {
    neoStringWidth(coloredShort)
  })

  bench('string-width (ANSI short)', () => {
    stringWidthOriginal(coloredShort)
  })

  bench('neo.string-width (ANSI medium)', () => {
    neoStringWidth(coloredMedium)
  })

  bench('string-width (ANSI medium)', () => {
    stringWidthOriginal(coloredMedium)
  })

  bench('neo.string-width (ANSI long)', () => {
    neoStringWidth(coloredLong)
  })

  bench('string-width (ANSI long)', () => {
    stringWidthOriginal(coloredLong)
  })
})

describe('Performance: Mixed content', () => {
  const realWorld1 = '\x1b[32m✓\x1b[0m Test passed: 你好世界'
  const realWorld2 = '[\x1b[33m████████\x1b[0m        ] 50% - こんにちは'
  const realWorld3 = '\x1b[31mError:\x1b[0m Failed to connect to 数据库 💥'
  const complex =
    'Hello \x1b[31m你好\x1b[0m World 👍 \x1b[32mSuccess\x1b[0m 🎉'

  bench('neo.string-width (real-world 1)', () => {
    neoStringWidth(realWorld1)
  })

  bench('string-width (real-world 1)', () => {
    stringWidthOriginal(realWorld1)
  })

  bench('neo.string-width (real-world 2)', () => {
    neoStringWidth(realWorld2)
  })

  bench('string-width (real-world 2)', () => {
    stringWidthOriginal(realWorld2)
  })

  bench('neo.string-width (real-world 3)', () => {
    neoStringWidth(realWorld3)
  })

  bench('string-width (real-world 3)', () => {
    stringWidthOriginal(realWorld3)
  })

  bench('neo.string-width (complex mixed)', () => {
    neoStringWidth(complex)
  })

  bench('string-width (complex mixed)', () => {
    stringWidthOriginal(complex)
  })
})

describe('Performance: Edge cases', () => {
  const empty = ''
  const whitespace = '                    '
  const veryLong = 'a'.repeat(100000)
  const ansiOnly = '\x1b[31m\x1b[32m\x1b[33m\x1b[0m'

  bench('neo.string-width (empty)', () => {
    neoStringWidth(empty)
  })

  bench('string-width (empty)', () => {
    stringWidthOriginal(empty)
  })

  bench('neo.string-width (whitespace)', () => {
    neoStringWidth(whitespace)
  })

  bench('string-width (whitespace)', () => {
    stringWidthOriginal(whitespace)
  })

  bench('neo.string-width (very long)', () => {
    neoStringWidth(veryLong)
  })

  bench('string-width (very long)', () => {
    stringWidthOriginal(veryLong)
  })

  bench('neo.string-width (ANSI only)', () => {
    neoStringWidth(ansiOnly)
  })

  bench('string-width (ANSI only)', () => {
    stringWidthOriginal(ansiOnly)
  })
})

describe('Performance: Batch processing', () => {
  const testCases = [
    'Hello',
    '你好',
    '👍',
    '\x1b[31mRed\x1b[0m',
    'Mixed 文字 🎉',
  ]

  bench('neo.string-width (batch 100)', () => {
    for (let i = 0; i < 100; i++) {
      for (const test of testCases) {
        neoStringWidth(test)
      }
    }
  })

  bench('string-width (batch 100)', () => {
    for (let i = 0; i < 100; i++) {
      for (const test of testCases) {
        stringWidthOriginal(test)
      }
    }
  })
})
