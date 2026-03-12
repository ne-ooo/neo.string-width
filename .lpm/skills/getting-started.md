---
name: getting-started
description: How to use neo.string-width — stringWidth() for visual column width, truncateToWidth/padToWidth/sliceByWidth/splitByWidth helpers, GraphemeIterator, getEastAsianWidth(), options (ambiguousIsNarrow, countAnsiEscapeCodes, emojiWidth, normalize), CJK fullwidth, emoji, ANSI stripping, fast-path ASCII optimization, TypeScript, zero-dependency
version: "1.0.0"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Getting Started with @lpm.dev/neo.string-width

## Overview

neo.string-width calculates the visual column width of strings — accounting for CJK fullwidth characters (width 2), emoji (width 2), ANSI escape codes (width 0), combining marks, ZWJ sequences, and variation selectors. 10-20% faster than `string-width`, 2-3x faster on ASCII-only strings. TypeScript-first, zero-dependency, ESM + CJS.

## Quick Start

```typescript
import { stringWidth } from '@lpm.dev/neo.string-width'

stringWidth('hello')        // 5
stringWidth('你好')          // 4 (each CJK char = width 2)
stringWidth('👋🏽')           // 2 (emoji = width 2)
stringWidth('\u001B[31mred\u001B[0m')  // 3 (ANSI codes ignored)
```

## stringWidth()

The core function — returns the visual column width of a string.

```typescript
import { stringWidth } from '@lpm.dev/neo.string-width'

// ASCII
stringWidth('hello world')  // 11

// CJK characters (fullwidth = 2 columns each)
stringWidth('こんにちは')     // 10
stringWidth('中文测试')       // 8

// Emoji
stringWidth('😀')            // 2
stringWidth('👨‍👩‍👧‍👦')        // 2 (ZWJ family emoji = single width-2 unit)
stringWidth('🏳️‍🌈')          // 2

// ANSI escape codes (stripped, width 0)
stringWidth('\u001B[1m\u001B[31mbold red\u001B[0m')  // 8

// Mixed content
stringWidth('Hello 世界!')   // 10 (5 + 4 + 1)

// Combining marks (width 0)
stringWidth('é')             // 1 (e + combining acute)
stringWidth('à̧')            // 1

// Control characters
stringWidth('\t')            // 0
stringWidth('\n')            // 0
```

### Options

```typescript
stringWidth(text, {
  ambiguousIsNarrow: true,      // East Asian Ambiguous chars = width 1 (default)
  countAnsiEscapeCodes: false,  // Don't strip ANSI codes (default: false = strip them)
  emojiWidth: 2,                // Emoji width: 1, 2, or 'auto' (default: 2)
  normalize: false,             // NFC normalize before measuring (default: false)
})
```

### ambiguousIsNarrow

East Asian Ambiguous characters (like `×`, `÷`, `α`, `β`) have context-dependent width. In CJK terminals they're typically fullwidth (2), in Western terminals they're narrow (1).

```typescript
// Default: ambiguous = narrow (width 1)
stringWidth('α')  // 1

// CJK terminal context: ambiguous = fullwidth (width 2)
stringWidth('α', { ambiguousIsNarrow: false })  // 2
```

### countAnsiEscapeCodes

By default, ANSI escape codes are stripped before measuring. Set to `true` to count their bytes.

```typescript
const colored = '\u001B[31mhello\u001B[0m'

stringWidth(colored)                                // 5 (ANSI stripped)
stringWidth(colored, { countAnsiEscapeCodes: true }) // 14 (ANSI bytes counted)
```

### emojiWidth

Control how emoji width is calculated.

```typescript
stringWidth('😀', { emojiWidth: 2 })      // 2 (default)
stringWidth('😀', { emojiWidth: 1 })      // 1
stringWidth('😀', { emojiWidth: 'auto' }) // uses Unicode East Asian Width property
```

### normalize

NFC-normalize the string before measuring. Useful when the same character might be represented as precomposed or decomposed.

```typescript
// Without normalize: decomposed é = e + ◌́ (combining acute)
stringWidth('é')                          // 1 (already works correctly)

// With normalize: ensures consistent measurement
stringWidth(someInput, { normalize: true })
```

## Helper Functions

### truncateToWidth

Truncate a string to fit within a maximum visual width, with optional suffix.

```typescript
import { truncateToWidth } from '@lpm.dev/neo.string-width'

truncateToWidth('Hello World', 8)         // 'Hello Wo'
truncateToWidth('Hello World', 8, '…')    // 'Hello W…'
truncateToWidth('你好世界', 5)              // '你好' (won't split a wide char)
truncateToWidth('你好世界', 5, '…')         // '你好…'
```

### padToWidth

Pad a string to a target visual width.

```typescript
import { padToWidth } from '@lpm.dev/neo.string-width'

padToWidth('hello', 10)            // 'hello     '
padToWidth('hello', 10, ' ', 'left')   // '     hello'
padToWidth('hello', 10, ' ', 'center') // '  hello   '
padToWidth('你好', 10)              // '你好      '
padToWidth('hi', 10, '-')          // 'hi--------'
```

### sliceByWidth

Slice a string by visual width positions (like String.slice but width-aware).

```typescript
import { sliceByWidth } from '@lpm.dev/neo.string-width'

sliceByWidth('Hello World', 0, 5)   // 'Hello'
sliceByWidth('你好世界', 0, 4)        // '你好'
sliceByWidth('你好世界', 2, 6)        // '好世'
```

### splitByWidth

Split a string into chunks of a maximum visual width.

```typescript
import { splitByWidth } from '@lpm.dev/neo.string-width'

splitByWidth('Hello World', 5)    // ['Hello', ' Worl', 'd']
splitByWidth('你好世界测试', 4)      // ['你好', '世界', '测试']
```

## GraphemeIterator

Iterate over grapheme clusters with their widths.

```typescript
import { GraphemeIterator } from '@lpm.dev/neo.string-width'

const iter = new GraphemeIterator('Hello 你好 👋')
for (const { grapheme, width } of iter) {
  console.log(`"${grapheme}" → width ${width}`)
}
// "H" → width 1
// "e" → width 1
// "l" → width 1
// "l" → width 1
// "o" → width 1
// " " → width 1
// "你" → width 2
// "好" → width 2
// " " → width 1
// "👋" → width 2
```

## getEastAsianWidth

Get the East Asian Width category of a Unicode code point.

```typescript
import { getEastAsianWidth } from '@lpm.dev/neo.string-width'

getEastAsianWidth(0x4E00)  // 'W' (CJK Unified Ideograph — Wide)
getEastAsianWidth(0x41)    // 'Na' (Latin A — Narrow)
getEastAsianWidth(0xFF01)  // 'F' (Fullwidth exclamation — Fullwidth)
getEastAsianWidth(0x00B1)  // 'A' (Plus-minus — Ambiguous)

// Categories: 'F' (Fullwidth), 'H' (Halfwidth), 'W' (Wide),
//             'Na' (Narrow), 'A' (Ambiguous), 'N' (Neutral)
```

## Constants

```typescript
import {
  EMOJI_WIDTH,       // Default emoji width (2)
  FULLWIDTH,         // Fullwidth character width (2)
  HALFWIDTH,         // Halfwidth character width (1)
  CONTROL_WIDTH,     // Control character width (0)
} from '@lpm.dev/neo.string-width'
```

## Performance

The library uses a tiered processing strategy:

1. **ASCII fast-path**: Pure ASCII strings use `text.length` directly — 2-3x faster
2. **CJK path**: Strings with CJK but no complex graphemes use codepoint iteration
3. **Complex path**: Strings with emoji/ZWJ/combining marks use `Intl.Segmenter`

```typescript
// All return correct results, but performance varies:
stringWidth('hello world')          // Fast path (ASCII)
stringWidth('你好世界')              // CJK path
stringWidth('Hello 👨‍👩‍👧‍👦 World')  // Complex path (ZWJ emoji)
```

## TypeScript Types

```typescript
import type {
  StringWidthOptions,
  EastAsianWidthCategory,
  GraphemeInfo,
} from '@lpm.dev/neo.string-width'
```
