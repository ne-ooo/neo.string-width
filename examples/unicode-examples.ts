/**
 * Unicode, emoji, and CJK examples
 *
 * Demonstrates proper handling of various Unicode characters.
 */

import stringWidth from '@lpm.dev/neo.string-width'
import { truncateToWidth, padToWidth, splitByWidth } from '@lpm.dev/neo.string-width'

console.log('=== Unicode Support Examples ===\n')

// CJK Characters
console.log('CJK Characters:')
const cjkExamples = [
  { text: '你好世界', lang: 'Chinese (Simplified)' },
  { text: '妳好世界', lang: 'Chinese (Traditional)' },
  { text: 'こんにちは世界', lang: 'Japanese (Hiragana)' },
  { text: 'コンニチハ世界', lang: 'Japanese (Katakana)' },
  { text: '今日は世界', lang: 'Japanese (Kanji)' },
  { text: '안녕하세요', lang: 'Korean (Hangul)' },
]

for (const { text, lang } of cjkExamples) {
  const width = stringWidth(text)
  console.log(`${lang.padEnd(30)} "${text}" => width: ${width}`)
}

// Emoji variations
console.log('\nEmoji Variations:')
const emojiExamples = [
  { text: '👍', desc: 'Simple emoji' },
  { text: '👍🏻', desc: 'Emoji with skin tone (light)' },
  { text: '👍🏿', desc: 'Emoji with skin tone (dark)' },
  { text: '❤️', desc: 'Emoji with variation selector' },
  { text: '❤︎', desc: 'Text presentation' },
  { text: '👨‍👩‍👧‍👦', desc: 'ZWJ sequence (family)' },
  { text: '👨‍💻', desc: 'ZWJ sequence (man technologist)' },
  { text: '🏳️‍🌈', desc: 'Rainbow flag (ZWJ)' },
  { text: '🇺🇸', desc: 'Flag (regional indicators)' },
]

for (const { text, desc } of emojiExamples) {
  const width = stringWidth(text)
  console.log(`${desc.padEnd(35)} ${text} => width: ${width}`)
}

// Combining characters
console.log('\nCombining Characters:')
const combiningExamples = [
  { text: 'café', desc: 'Precomposed (é)' },
  { text: 'cafe\u0301', desc: 'Combining acute (e + ́)' },
  { text: 'a\u0300', desc: 'a with grave' },
  { text: 'e\u0308', desc: 'e with diaeresis (ë)' },
  { text: 'n\u0303', desc: 'n with tilde (ñ)' },
]

for (const { text, desc } of combiningExamples) {
  const width = stringWidth(text)
  const chars = [...text].length
  console.log(`${desc.padEnd(30)} "${text}" => width: ${width}, chars: ${chars}`)
}

// Zero-width characters
console.log('\nZero-Width Characters:')
const zeroWidthExamples = [
  { text: 'Hello\u200BWorld', desc: 'Zero-width space (ZWSP)' },
  { text: 'Hello\u200CWorld', desc: 'Zero-width non-joiner (ZWNJ)' },
  { text: 'Hello\u200DWorld', desc: 'Zero-width joiner (ZWJ)' },
  { text: 'Hello\uFEFFWorld', desc: 'Zero-width no-break space (BOM)' },
]

for (const { text, desc } of zeroWidthExamples) {
  const width = stringWidth(text)
  console.log(`${desc.padEnd(35)} "${text}" => width: ${width}`)
}

// Ambiguous width characters
console.log('\nAmbiguous Width Characters:')
const ambiguousExamples = [
  { text: '±', name: 'Plus-minus sign' },
  { text: '§', name: 'Section sign' },
  { text: '¶', name: 'Pilcrow' },
  { text: '°', name: 'Degree sign' },
  { text: '²', name: 'Superscript two' },
]

for (const { text, name } of ambiguousExamples) {
  const narrowWidth = stringWidth(text, { ambiguousIsNarrow: true })
  const wideWidth = stringWidth(text, { ambiguousIsNarrow: false })
  console.log(`${name.padEnd(25)} "${text}" => narrow: ${narrowWidth}, wide: ${wideWidth}`)
}

// Mixed content
console.log('\n=== Mixed Content Examples ===\n')

const mixedExamples = [
  'Hello 你好 World',
  'English + 日本語 + 한국어',
  'Text with emoji 🎉 and symbols ±',
  '中文 Chinese 👍 emoji 🏳️‍🌈 flag',
  'Café résumé naïve',
]

for (const text of mixedExamples) {
  const width = stringWidth(text)
  console.log(`"${text}"`)
  console.log(`  Width: ${width}, Length: ${text.length}, Chars: ${[...text].length}`)
  console.log()
}

// Table with mixed content
console.log('=== Mixed Content Table ===\n')

interface Person {
  name: string
  greeting: string
  flag: string
}

const people: Person[] = [
  { name: 'John', greeting: 'Hello', flag: '🇺🇸' },
  { name: '李明', greeting: '你好', flag: '🇨🇳' },
  { name: '山田', greeting: 'こんにちは', flag: '🇯🇵' },
  { name: '김철수', greeting: '안녕하세요', flag: '🇰🇷' },
  { name: 'María', greeting: 'Hola', flag: '🇪🇸' },
]

const nameWidth = 15
const greetingWidth = 20
const flagWidth = 4

console.log('┌' + '─'.repeat(nameWidth + 2) + '┬' + '─'.repeat(greetingWidth + 2) + '┬' + '─'.repeat(flagWidth + 2) + '┐')
console.log('│ ' + padToWidth('Name', nameWidth) + ' │ ' + padToWidth('Greeting', greetingWidth) + ' │ ' + padToWidth('Flag', flagWidth) + ' │')
console.log('├' + '─'.repeat(nameWidth + 2) + '┼' + '─'.repeat(greetingWidth + 2) + '┼' + '─'.repeat(flagWidth + 2) + '┤')

for (const person of people) {
  const name = padToWidth(person.name, nameWidth)
  const greeting = padToWidth(person.greeting, greetingWidth)
  const flag = padToWidth(person.flag, flagWidth)
  console.log(`│ ${name} │ ${greeting} │ ${flag} │`)
}

console.log('└' + '─'.repeat(nameWidth + 2) + '┴' + '─'.repeat(greetingWidth + 2) + '┴' + '─'.repeat(flagWidth + 2) + '┘')

// Text wrapping with Unicode
console.log('\n=== Unicode Text Wrapping ===\n')

const unicodeText = '这是一段包含中文、English、日本語、한국어、emoji 🎉 和各种符号 ±§¶ 的混合文本。它应该能够正确地按照视觉宽度进行换行处理。'

console.log('Original text:')
console.log(unicodeText)
console.log()

console.log('Wrapped at 40 columns:')
const wrapped = splitByWidth(unicodeText, 40)
for (const line of wrapped) {
  console.log(`│ ${line}`)
}

// Emoji width options
console.log('\n=== Emoji Width Options ===\n')

const emojiText = '👍👎👌😀🎉'

console.log(`Text: ${emojiText}`)
console.log(`Default (width=2): ${stringWidth(emojiText)}`)
console.log(`width=1: ${stringWidth(emojiText, { emojiWidth: 1 })}`)
console.log(`width='auto': ${stringWidth(emojiText, { emojiWidth: 'auto' })}`)
console.log()

console.log('Truncated to width 6:')
console.log(`Default: "${truncateToWidth(emojiText, 6)}"`)
console.log(`emojiWidth=1: "${truncateToWidth(emojiText, 6, { emojiWidth: 1 })}"`)

// Normalization examples
console.log('\n=== Unicode Normalization ===\n')

const normalizeExamples = [
  { text: 'café', desc: 'Precomposed (NFC)' },
  { text: 'cafe\u0301', desc: 'Decomposed (NFD)' },
]

for (const { text, desc } of normalizeExamples) {
  const widthWithout = stringWidth(text, { normalize: false })
  const widthWith = stringWidth(text, { normalize: true })
  console.log(`${desc}:`)
  console.log(`  Text: "${text}"`)
  console.log(`  Width (normalize=false): ${widthWithout}`)
  console.log(`  Width (normalize=true): ${widthWith}`)
  console.log()
}

// RTL text (note: width calculation only, not bidirectional rendering)
console.log('=== Right-to-Left Text (Width Only) ===\n')

const rtlExamples = [
  { text: 'مرحبا', lang: 'Arabic' },
  { text: 'שלום', lang: 'Hebrew' },
  { text: 'مرحبا Hello שלום', lang: 'Mixed RTL + LTR' },
]

for (const { text, lang } of rtlExamples) {
  const width = stringWidth(text)
  console.log(`${lang.padEnd(20)} "${text}" => width: ${width}`)
}

console.log('\nNote: This library calculates visual width only.')
console.log('For proper bidirectional rendering, use additional libraries.')
