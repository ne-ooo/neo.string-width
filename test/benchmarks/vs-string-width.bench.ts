/**
 * Reproducible comparison with the real, pinned string-width package.
 *
 * Every workload is checked for equal output before benchmarks are registered.
 * A semantic mismatch therefore fails the benchmark suite instead of timing
 * two different operations.
 */

import assert from 'node:assert/strict'
import stringWidthOriginal from 'string-width'
import { bench, describe } from 'vitest'
import { stringWidth as neoStringWidth } from '../../src/index.js'

interface BenchmarkCase {
  readonly group: string
  readonly name: string
  readonly text: string
}

const CASES: readonly BenchmarkCase[] = [
  {
    group: 'ASCII',
    name: 'short',
    text: 'Hello World',
  },
  {
    group: 'ASCII',
    name: 'medium',
    text: 'The quick brown fox jumps over the lazy dog',
  },
  {
    group: 'ASCII',
    name: 'long',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10),
  },
  {
    group: 'CJK',
    name: 'Chinese',
    text: '你好，世界！这是一个测试字符串。',
  },
  {
    group: 'CJK',
    name: 'Japanese',
    text: 'こんにちは、世界！これはテストです。',
  },
  {
    group: 'CJK',
    name: 'Korean',
    text: '안녕하세요, 세계! 이것은 테스트입니다.',
  },
  {
    group: 'Emoji',
    name: 'simple',
    text: '👍 😀 🎉 ❤️ 🚀',
  },
  {
    group: 'Emoji',
    name: 'complex graphemes',
    text: '👨‍👩‍👧‍👦 👍🏻 🇺🇸',
  },
  {
    group: 'ANSI',
    name: 'short',
    text: '\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m \x1b[34mBlue\x1b[0m',
  },
  {
    group: 'ANSI',
    name: 'long',
    text: ('\x1b[36mCyan text\x1b[0m with \x1b[1mbold\x1b[0m ').repeat(10),
  },
  {
    group: 'Mixed',
    name: 'terminal line',
    text: '\x1b[32m✓\x1b[0m Test passed: 你好世界 👍',
  },
]

for (const testCase of CASES) {
  assert.equal(
    neoStringWidth(testCase.text),
    stringWidthOriginal(testCase.text),
    `width mismatch for ${testCase.group}/${testCase.name}`
  )
}

for (const group of new Set(CASES.map((testCase) => testCase.group))) {
  describe(`Comparison: ${group}`, () => {
    for (const testCase of CASES.filter((candidate) => candidate.group === group)) {
      bench(`neo.string-width: ${testCase.name}`, () => {
        neoStringWidth(testCase.text)
      })

      bench(`string-width 8.2.2: ${testCase.name}`, () => {
        stringWidthOriginal(testCase.text)
      })
    }
  })
}

const BATCH_CASES = CASES.map((testCase) => testCase.text)
const neoBatchWidth = BATCH_CASES.reduce(
  (total, text) => total + neoStringWidth(text),
  0
)
const originalBatchWidth = BATCH_CASES.reduce(
  (total, text) => total + stringWidthOriginal(text),
  0
)
assert.equal(neoBatchWidth, originalBatchWidth, 'batch widths must match')

describe('Comparison: batch', () => {
  bench('neo.string-width: all cases x10', () => {
    for (let iteration = 0; iteration < 10; iteration++) {
      for (const text of BATCH_CASES) neoStringWidth(text)
    }
  })

  bench('string-width 8.2.2: all cases x10', () => {
    for (let iteration = 0; iteration < 10; iteration++) {
      for (const text of BATCH_CASES) stringWidthOriginal(text)
    }
  })
})
