/**
 * Text wrapping example
 *
 * Demonstrates using splitByWidth to wrap long text for terminal display.
 */

import { splitByWidth } from '@lpm.dev/neo.string-width'

console.log('=== Text Wrapping Examples ===\n')

// Basic text wrapping
const longText = 'This is a long line of text that needs to be wrapped for terminal display. It contains multiple words and should break at word boundaries when possible.'

console.log('Original text:')
console.log(longText)
console.log(`Length: ${longText.length} chars\n`)

console.log('Wrapped at 40 columns:')
const wrapped40 = splitByWidth(longText, 40)
for (const line of wrapped40) {
  console.log(`│ ${line}`)
}

console.log('\nWrapped at 60 columns:')
const wrapped60 = splitByWidth(longText, 60)
for (const line of wrapped60) {
  console.log(`│ ${line}`)
}

// CJK text wrapping
const chineseText = '这是一段很长的中文文本，需要被分割成多个部分以便在终端中显示。中文字符通常占用两个列宽，因此需要特别处理。'

console.log('\n=== CJK Text Wrapping ===\n')
console.log('Original Chinese text:')
console.log(chineseText)

console.log('\nWrapped at 30 columns:')
const wrappedChinese = splitByWidth(chineseText, 30)
for (const line of wrappedChinese) {
  console.log(`│ ${line}`)
}

// Mixed content wrapping
const mixedText = 'Hello 你好! This is a mixed text with English and 中文 characters, as well as emoji 👍 and symbols ±§¶. It should wrap correctly at word boundaries.'

console.log('\n=== Mixed Content Wrapping ===\n')
console.log('Original mixed text:')
console.log(mixedText)

console.log('\nWrapped at 40 columns:')
const wrappedMixed = splitByWidth(mixedText, 40)
for (const line of wrappedMixed) {
  console.log(`│ ${line}`)
}

// Preserve whitespace option
const textWithSpaces = '  Hello   World  This  Has  Extra  Spaces  '

console.log('\n=== Whitespace Handling ===\n')
console.log('Original text (with extra spaces):')
console.log(`"${textWithSpaces}"`)

console.log('\nDefault (trim whitespace):')
const wrappedTrimmed = splitByWidth(textWithSpaces, 20)
for (const line of wrappedTrimmed) {
  console.log(`"${line}"`)
}

console.log('\nWith preserveWhitespace: true:')
const wrappedPreserved = splitByWidth(textWithSpaces, 20, { preserveWhitespace: true })
for (const line of wrappedPreserved) {
  console.log(`"${line}"`)
}

// Character-based splitting (no word boundaries)
const noSpaces = 'Thisisaverylongwordwithoutanyspacesorhyphenation'

console.log('\n=== Character-Based Splitting ===\n')
console.log('Text without spaces:')
console.log(noSpaces)

console.log('\nWrapped at 20 columns (splits mid-word):')
const wrappedNoSpaces = splitByWidth(noSpaces, 20, { preferSplitOnSpace: false })
for (const line of wrappedNoSpaces) {
  console.log(`│ ${line}`)
}

// Paragraph wrapping
function wrapParagraph(text: string, width: number): void {
  const lines = splitByWidth(text, width)
  for (const line of lines) {
    console.log(line)
  }
}

console.log('\n=== Paragraph Formatting ===\n')

const paragraph = `The quick brown fox jumps over the lazy dog. This is a classic pangram used for testing typography and text rendering. It contains every letter of the English alphabet at least once.`

console.log('Formatted paragraph (40 columns):')
wrapParagraph(paragraph, 40)

console.log('\nFormatted paragraph (60 columns):')
wrapParagraph(paragraph, 60)

// Markdown-like formatting
function formatMarkdown(text: string, width: number): void {
  const lines = text.split('\n')

  for (const line of lines) {
    if (line.startsWith('# ')) {
      // Header
      console.log(`\n${line}\n${'='.repeat(Math.min(line.length, width))}\n`)
    } else if (line.startsWith('- ')) {
      // List item
      const indent = '  '
      const bullet = '• '
      const content = line.slice(2)
      const wrapped = splitByWidth(content, width - indent.length - bullet.length)
      console.log(`${indent}${bullet}${wrapped[0]}`)
      for (let i = 1; i < wrapped.length; i++) {
        console.log(`${indent}  ${wrapped[i]}`)
      }
    } else if (line.trim() === '') {
      // Empty line
      console.log()
    } else {
      // Regular paragraph
      const wrapped = splitByWidth(line, width)
      for (const wrappedLine of wrapped) {
        console.log(wrappedLine)
      }
    }
  }
}

console.log('\n=== Markdown-Style Formatting ===\n')

const markdown = `# Introduction

This is a sample document with mixed content including English and 中文字符.

- First item with some very long text that should wrap properly across multiple lines
- Second item 第二项 with mixed content
- Third item with emoji 🎉 and symbols ±

Thank you for reading!`

formatMarkdown(markdown, 50)

// Code block wrapping (preserve formatting)
console.log('\n=== Code Block Wrapping ===\n')

const codeLines = [
  'function example() {',
  '  const veryLongVariableNameThatExceedsTheLineWidth = "This is a string"',
  '  return veryLongVariableNameThatExceedsTheLineWidth',
  '}',
]

console.log('Original code:')
for (const line of codeLines) {
  console.log(line)
}

console.log('\nWrapped at 40 columns (character-based):')
for (const line of codeLines) {
  if (line.length <= 40) {
    console.log(line)
  } else {
    const wrapped = splitByWidth(line, 40, { preferSplitOnSpace: false })
    for (const wrappedLine of wrapped) {
      console.log(wrappedLine)
    }
  }
}
