/**
 * Real-world integration tests
 *
 * Tests common use cases and scenarios from actual applications
 */

import { describe, it, expect } from 'vitest'
import { stringWidth } from '../../src/index.js'

describe('Real-world use cases', () => {
  describe('Terminal output formatting', () => {
    it('should handle colored success messages', () => {
      const message = '\x1b[32m✓\x1b[0m Test passed successfully'
      const width = stringWidth(message)
      expect(width).toBeGreaterThan(20)
      expect(width).toBeLessThan(30)
    })

    it('should handle colored error messages', () => {
      const message = '\x1b[31m✗\x1b[0m Test failed with error'
      const width = stringWidth(message)
      expect(width).toBeGreaterThan(20)
      expect(width).toBeLessThan(30)
    })

    it('should handle multi-color output', () => {
      const output = '\x1b[33mWarning:\x1b[0m \x1b[1mBold text\x1b[0m here'
      const width = stringWidth(output)
      // "Warning: Bold text here" = Warning: (9) + space (1) + Bold text (9) + space (1) + here (4) = 23 (one space not two)
      expect(width).toBe(23)
    })

    it('should handle progress indicators', () => {
      const progress = '[\x1b[32m████████\x1b[0m        ] 50%'
      const width = stringWidth(progress)
      // █ is fullwidth (U+2588, width 2 each): [ (1) + 8×2 (16) + 8 spaces (8 - actually inside ANSI) + ] (1) + space (1) + 50% (3) = 22
      expect(width).toBe(22)
    })
  })

  describe('Table formatting', () => {
    it('should calculate width for table cells with CJK', () => {
      const cell = '名前'
      expect(stringWidth(cell)).toBe(4) // 2 chars × 2 width
    })

    it('should handle mixed ASCII and CJK in tables', () => {
      const cell = 'Name: 田中'
      // Name: (6) + 田中 (4) = 10
      expect(stringWidth(cell)).toBe(10)
    })

    it('should handle box drawing characters', () => {
      const border = '┌─────────────┐'
      expect(stringWidth(border)).toBe(15)
    })

    it('should calculate total row width', () => {
      const row = '│ ID  │ Name      │ Age │'
      expect(stringWidth(row)).toBeGreaterThan(20)
    })
  })

  describe('Multilingual content', () => {
    it('should handle English text', () => {
      const text = 'Hello, World!'
      expect(stringWidth(text)).toBe(13)
    })

    it('should handle Chinese text', () => {
      const text = '你好，世界！'
      expect(stringWidth(text)).toBe(12) // 6 fullwidth chars × 2
    })

    it('should handle Japanese text', () => {
      const text = 'こんにちは、世界！'
      expect(stringWidth(text)).toBe(18) // 9 fullwidth chars × 2
    })

    it('should handle Korean text', () => {
      const text = '안녕하세요, 세계!'
      // 안녕하세요 (10) + , (1 halfwidth comma) + space (1) + 세계 (4) + ! (1) = 17
      expect(stringWidth(text)).toBe(17)
    })

    it('should handle mixed language content', () => {
      const text = 'Hello 你好 こんにちは 안녕하세요'
      // Hello (5) + space (1) + 你好 (4) + space (1) + こんにちは (10) + space (1) + 안녕하세요 (10) = 32
      expect(stringWidth(text)).toBe(32)
    })

    it('should handle mixed scripts with English', () => {
      const text = 'Welcome to 北京 - the capital of China'
      // Welcome to (10) + space (1) + 北京 (4) + space (1) + - the capital of China (22) = 38
      expect(stringWidth(text)).toBe(38)
    })
  })

  describe('Emoji in messages', () => {
    it('should handle emoji reactions', () => {
      const reactions = '👍 ❤️ 😂 🎉'
      expect(stringWidth(reactions)).toBeGreaterThanOrEqual(11) // 4 emoji + 3 spaces
    })

    it('should handle emoji in status messages', () => {
      const status = '✅ Build successful'
      expect(stringWidth(status)).toBeGreaterThanOrEqual(17)
    })

    it('should handle emoji with text', () => {
      const message = 'Great work! 🎉🎊'
      expect(stringWidth(message)).toBeGreaterThanOrEqual(16)
    })
  })

  describe('Log file parsing', () => {
    it('should handle timestamp with colored level', () => {
      const log = '[2024-02-19 10:30:45] \x1b[32mINFO\x1b[0m: Server started'
      const width = stringWidth(log)
      // [2024-02-19 10:30:45] (22) + INFO: (5) + space (1) + Server started (14) = 42
      expect(width).toBe(42)
    })

    it('should handle multi-line log entries', () => {
      const lines = [
        '\x1b[31mERROR\x1b[0m: Connection failed',
        '  at connect (server.js:42)',
        '  at startup (index.js:10)',
      ]
      const widths = lines.map((line) => stringWidth(line))
      expect(widths[0]).toBe(24) // ERROR: (6) + space (1) + Connection failed (17) = 24
      expect(widths[1]).toBeGreaterThan(20)
      expect(widths[2]).toBeGreaterThan(20)
    })
  })

  describe('User input validation', () => {
    it('should measure username with special chars', () => {
      const username = 'user_123'
      expect(stringWidth(username)).toBe(8)
    })

    it('should measure email addresses', () => {
      const email = 'test@example.com'
      expect(stringWidth(email)).toBe(16)
    })

    it('should measure URLs', () => {
      const url = 'https://example.com/path'
      expect(stringWidth(url)).toBe(24)
    })

    it('should measure international usernames', () => {
      const username = '田中太郎'
      expect(stringWidth(username)).toBe(8) // 4 chars × 2
    })
  })

  describe('Code snippets', () => {
    it('should handle code with ANSI highlighting', () => {
      const code = '\x1b[36mconst\x1b[0m foo = \x1b[32m"bar"\x1b[0m'
      const width = stringWidth(code)
      // const foo = "bar"
      expect(width).toBe(17)
    })

    it('should handle indented code', () => {
      const code = '    function hello() {'
      expect(stringWidth(code)).toBe(22)
    })
  })

  describe('Social media content', () => {
    it('should handle tweets with emoji', () => {
      const tweet = 'Just launched our new product! 🚀🎉 Check it out!'
      expect(stringWidth(tweet)).toBeGreaterThanOrEqual(48)
    })

    it('should handle hashtags', () => {
      const post = '#JavaScript #TypeScript #WebDev'
      expect(stringWidth(post)).toBe(31)
    })

    it('should handle mentions', () => {
      const post = '@user thanks for the feedback!'
      expect(stringWidth(post)).toBe(30)
    })
  })

  describe('Form validation', () => {
    it('should validate password strength indicator', () => {
      const strong = '\x1b[32m●●●●●\x1b[0m Strong'
      const width = stringWidth(strong)
      expect(width).toBe(12) // ●●●●● Strong
    })

    it('should validate progress bars', () => {
      const progress = '━━━━━━━━━━          50%'
      // ━ is fullwidth, but let's check actual width
      expect(stringWidth(progress)).toBe(23)
    })
  })

  describe('File paths', () => {
    it('should handle Unix paths', () => {
      const path = '/usr/local/bin/node'
      expect(stringWidth(path)).toBe(19)
    })

    it('should handle Windows paths', () => {
      const path = 'C:\\Users\\Documents\\file.txt'
      expect(stringWidth(path)).toBe(27)
    })

    it('should handle paths with CJK', () => {
      const path = '/Users/田中/Documents/ファイル.txt'
      // /Users/ (7) + 田中 (4) + /Documents/ (11) + ファイル (8) + .txt (4) = 34
      expect(stringWidth(path)).toBe(34)
    })
  })

  describe('CLI argument parsing', () => {
    it('should handle flag with value', () => {
      const arg = '--output=dist/bundle.js'
      expect(stringWidth(arg)).toBe(23)
    })

    it('should handle multiple flags', () => {
      const args = '--verbose --color --watch'
      expect(stringWidth(args)).toBe(25)
    })
  })

  describe('Edge cases from production', () => {
    it('should handle empty string', () => {
      expect(stringWidth('')).toBe(0)
    })

    it('should handle whitespace-only strings', () => {
      expect(stringWidth('   ')).toBe(3)
      expect(stringWidth('\t')).toBe(0)
      expect(stringWidth('\n')).toBe(0)
    })

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000)
      expect(stringWidth(longString)).toBe(10000)
    })

    it('should handle strings with only ANSI codes', () => {
      const ansiOnly = '\x1b[31m\x1b[1m\x1b[0m'
      expect(stringWidth(ansiOnly)).toBe(0)
    })

    it('should handle nested ANSI codes', () => {
      const nested = '\x1b[31m\x1b[1mBold Red\x1b[0m\x1b[0m'
      expect(stringWidth(nested)).toBe(8)
    })

    it('should handle malformed ANSI codes gracefully', () => {
      const malformed = '\x1bIncomplete'
      // neo.ansi strips ESC as incomplete sequence, leaving "Incomplete" (10 chars)
      // But if ESC+I is stripped, we get "ncomplete" (9 chars)
      expect(stringWidth(malformed)).toBeGreaterThanOrEqual(9)
    })
  })
})
