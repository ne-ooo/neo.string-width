/**
 * Basic usage examples for @lpm.dev/neo.string-width
 *
 * This file demonstrates the core stringWidth() function with various inputs.
 */

import stringWidth from '@lpm.dev/neo.string-width'

console.log('=== Basic String Width Examples ===\n')

// ASCII text
console.log('ASCII text:')
console.log(`stringWidth('Hello')              =>`, stringWidth('Hello'))
console.log(`stringWidth('Hello World')        =>`, stringWidth('Hello World'))
console.log(`stringWidth('')                   =>`, stringWidth(''))

// CJK characters (fullwidth)
console.log('\nCJK characters (fullwidth):')
console.log(`stringWidth('你好')                =>`, stringWidth('你好'))
console.log(`stringWidth('世界')                =>`, stringWidth('世界'))
console.log(`stringWidth('你好世界')            =>`, stringWidth('你好世界'))
console.log(`stringWidth('こんにちは')          =>`, stringWidth('こんにちは'))
console.log(`stringWidth('안녕하세요')          =>`, stringWidth('안녕하세요'))

// Emoji
console.log('\nEmoji:')
console.log(`stringWidth('👍')                  =>`, stringWidth('👍'))
console.log(`stringWidth('😀')                  =>`, stringWidth('😀'))
console.log(`stringWidth('👍👎👌😀')            =>`, stringWidth('👍👎👌😀'))
console.log(`stringWidth('❤️')                  =>`, stringWidth('❤️'))

// Complex emoji (ZWJ sequences)
console.log('\nComplex emoji (ZWJ sequences):')
console.log(`stringWidth('👨‍👩‍👧‍👦')                =>`, stringWidth('👨‍👩‍👧‍👦'))
console.log(`stringWidth('👍🏻')                 =>`, stringWidth('👍🏻'))
console.log(`stringWidth('👨‍💻')                 =>`, stringWidth('👨‍💻'))

// ANSI colored text
console.log('\nANSI colored text (codes are stripped):')
console.log(`stringWidth('\\x1b[31mRed\\x1b[0m')    =>`, stringWidth('\x1b[31mRed\x1b[0m'))
console.log(`stringWidth('\\x1b[32mGreen\\x1b[0m')  =>`, stringWidth('\x1b[32mGreen\x1b[0m'))
console.log(`stringWidth('\\x1b[1mBold\\x1b[0m')    =>`, stringWidth('\x1b[1mBold\x1b[0m'))

// Mixed content
console.log('\nMixed content:')
console.log(`stringWidth('Hello 你好')          =>`, stringWidth('Hello 你好'))
console.log(`stringWidth('Hello 👍 World')     =>`, stringWidth('Hello 👍 World'))
console.log(`stringWidth('你好 👨‍👩‍👧‍👦 World')     =>`, stringWidth('你好 👨‍👩‍👧‍👦 World'))

// With options
console.log('\nWith options:')
console.log(`stringWidth('±', { ambiguousIsNarrow: true })   =>`, stringWidth('±', { ambiguousIsNarrow: true }))
console.log(`stringWidth('±', { ambiguousIsNarrow: false })  =>`, stringWidth('±', { ambiguousIsNarrow: false }))
console.log(`stringWidth('👍', { emojiWidth: 1 })            =>`, stringWidth('👍', { emojiWidth: 1 }))
console.log(`stringWidth('👍', { emojiWidth: 2 })            =>`, stringWidth('👍', { emojiWidth: 2 }))

// Edge cases
console.log('\nEdge cases:')
console.log(`stringWidth('\\u200B')              =>`, stringWidth('\u200B')) // Zero-width space
console.log(`stringWidth('café')                =>`, stringWidth('café')) // Combining character
console.log(`stringWidth('e\\u0301')             =>`, stringWidth('e\u0301')) // e + combining acute
