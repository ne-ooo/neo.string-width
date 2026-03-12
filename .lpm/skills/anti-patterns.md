---
name: anti-patterns
description: Common mistakes when using neo.string-width — text.length !== visual width for CJK/emoji, truncating mid-wide-char leaves gap, pad char must be width-1, ANSI codes stripped by default (countAnsiEscapeCodes), ambiguousIsNarrow context-dependent, emojiWidth default is 2 not auto, CJK punctuation is fullwidth width 2, sliceByWidth won't split wide characters
version: "1.0.0"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Anti-Patterns for @lpm.dev/neo.string-width

### [CRITICAL] `text.length` !== visual width for CJK, emoji, or ANSI strings

Wrong:

```typescript
// AI uses .length instead of stringWidth
function formatColumn(text: string, width: number) {
  return text.padEnd(width)  // Uses .length, not visual width!
}

formatColumn('hello', 10)  // 'hello     ' — OK
formatColumn('你好', 10)    // '你好        ' — WRONG! 你好 is length 2 but width 4
formatColumn('👋', 10)      // '👋         ' — WRONG! 👋 is length 2 but width 2
```

Correct:

```typescript
import { stringWidth, padToWidth } from '@lpm.dev/neo.string-width'

// Use padToWidth for width-aware padding
padToWidth('hello', 10)  // 'hello     '
padToWidth('你好', 10)    // '你好      ' (correctly accounts for width 4)
padToWidth('👋', 10)      // '👋        ' (correctly accounts for width 2)

// Or calculate padding manually
function formatColumn(text: string, width: number) {
  const padding = width - stringWidth(text)
  return text + ' '.repeat(Math.max(0, padding))
}
```

JavaScript's `.length` counts UTF-16 code units, not visual columns. CJK characters are width 2 but length 1. Emoji can be length 2+ but width 2. ANSI codes have length but zero visual width. Always use `stringWidth()` for column calculations.

### [HIGH] Truncating can't split a wide character — you may get less width than requested

Wrong:

```typescript
// AI expects exact width after truncation
import { truncateToWidth } from '@lpm.dev/neo.string-width'

const result = truncateToWidth('你好世界', 3)
// Expected: exactly 3 columns
// Actual: '你' (width 2) — can't fit half of '好' in remaining 1 column!

// Building a fixed-width table with CJK
const col = truncateToWidth('中文数据', 5)
// Returns '中文' (width 4), NOT 5 — the next char '数' needs 2 columns
```

Correct:

```typescript
import { truncateToWidth, stringWidth } from '@lpm.dev/neo.string-width'

// Truncation respects character boundaries — result may be narrower than requested
const result = truncateToWidth('你好世界', 3)
// '你' (width 2) — correct, can't split '好'

// For fixed-width columns, pad after truncating
const col = truncateToWidth('中文数据', 5)
const padded = col + ' '.repeat(5 - stringWidth(col))
// '中文 ' (width 5) — padded to fill

// Or use padToWidth after truncation
import { padToWidth } from '@lpm.dev/neo.string-width'
padToWidth(truncateToWidth('中文数据', 5), 5)
// '中文 '
```

Wide characters (CJK, emoji) occupy 2 columns and cannot be split. If the remaining space is 1 column and the next character needs 2, it's skipped entirely. Always account for this gap.

### [HIGH] ANSI escape codes are stripped by default — raw width needs `countAnsiEscapeCodes: true`

Wrong:

```typescript
// AI wants to measure the raw byte length including ANSI
import { stringWidth } from '@lpm.dev/neo.string-width'

const colored = '\u001B[31mError\u001B[0m'
const raw = stringWidth(colored)
// Expected: 14 (including ANSI bytes)
// Actual: 5 (ANSI stripped, only "Error" measured)

// Allocating buffer space based on stringWidth
const buffer = Buffer.alloc(stringWidth(colored))
buffer.write(colored)  // Buffer too small — doesn't fit ANSI codes!
```

Correct:

```typescript
import { stringWidth } from '@lpm.dev/neo.string-width'

const colored = '\u001B[31mError\u001B[0m'

// Default: ANSI stripped (visual width for terminal columns)
stringWidth(colored)  // 5

// Count ANSI bytes when you need raw width
stringWidth(colored, { countAnsiEscapeCodes: true })  // 14

// For terminal column alignment, use the default (ANSI stripped)
// For buffer allocation, use countAnsiEscapeCodes: true
```

The default behavior (stripping ANSI) is correct for terminal column alignment, which is the most common use case. Only set `countAnsiEscapeCodes: true` when you need the raw string width including escape sequences.

### [HIGH] `ambiguousIsNarrow` depends on the rendering context — wrong setting misaligns output

Wrong:

```typescript
// AI uses default setting without considering the target terminal
import { stringWidth } from '@lpm.dev/neo.string-width'

// In a CJK terminal (e.g., East Asian locale)
stringWidth('α × β')  // 5 (with default ambiguousIsNarrow: true)
// But CJK terminal renders α, ×, β as fullwidth → actual display width is 9!
// Table columns will be misaligned
```

Correct:

```typescript
import { stringWidth } from '@lpm.dev/neo.string-width'

// Western terminal (default): ambiguous chars are narrow (width 1)
stringWidth('α × β')  // 5

// CJK terminal: ambiguous chars are fullwidth (width 2)
stringWidth('α × β', { ambiguousIsNarrow: false })  // 9

// Detect context if possible
const isCJKTerminal = /^(zh|ja|ko)/i.test(process.env.LANG || '')
stringWidth(text, { ambiguousIsNarrow: !isCJKTerminal })
```

East Asian Ambiguous characters (Greek letters, math symbols, some punctuation) are rendered differently depending on the terminal. Western terminals show them as width 1, CJK terminals as width 2. Match your setting to the target environment.

### [MEDIUM] Pad character must be single-width — fullwidth pad chars break alignment

Wrong:

```typescript
// AI uses a fullwidth character as padding
import { padToWidth } from '@lpm.dev/neo.string-width'

padToWidth('hello', 10, '　')  // Using fullwidth space (U+3000, width 2)
// May not pad correctly — each pad char takes 2 columns, not 1
// If remaining space is odd, can't pad to exact width
```

Correct:

```typescript
import { padToWidth } from '@lpm.dev/neo.string-width'

// Use single-width characters for padding
padToWidth('hello', 10, ' ')   // Regular space (width 1) ✓
padToWidth('hello', 10, '-')   // Hyphen (width 1) ✓
padToWidth('hello', 10, '.')   // Period (width 1) ✓

// Fullwidth pad chars can leave gaps if remaining space is odd
// 'hello' = width 5, need 5 more, but fullwidth space = 2 columns
// 5 / 2 = 2.5 → only 2 pad chars = 4 columns → total 9, not 10
```

Always use width-1 characters for padding to ensure exact width matching. Fullwidth pad characters (width 2) can't fill an odd number of remaining columns.

### [MEDIUM] CJK punctuation is fullwidth (width 2), not width 1

Wrong:

```typescript
// AI assumes punctuation is always width 1
import { stringWidth } from '@lpm.dev/neo.string-width'

stringWidth('Hello！')  // Not 7 — the ！ is fullwidth
// Expected: 7 (6 + 1)
// Actual: 8 (5 + 1 + 2) — fullwidth ！ is width 2
```

Correct:

```typescript
import { stringWidth } from '@lpm.dev/neo.string-width'

// Fullwidth punctuation (common in CJK text)
stringWidth('！')   // 2 (fullwidth exclamation U+FF01)
stringWidth('!')   // 1 (ASCII exclamation U+0021)

stringWidth('（）')  // 4 (fullwidth parens, 2 each)
stringWidth('()')  // 2 (ASCII parens, 1 each)

stringWidth('、')   // 2 (ideographic comma)
stringWidth('。')   // 2 (ideographic period)

// When building CJK-aware formatters, always measure — don't assume
```

Fullwidth punctuation marks (！？。、（）【】etc.) are width 2 like CJK ideographs. Their ASCII equivalents (!?.()) are width 1. Always use `stringWidth()` rather than assuming punctuation width.

### [MEDIUM] `sliceByWidth` won't split wide characters — result boundaries snap to character edges

Wrong:

```typescript
// AI expects byte-precise slicing
import { sliceByWidth } from '@lpm.dev/neo.string-width'

sliceByWidth('你好世界', 1, 3)
// Expected: partial of '你' + partial of '好'
// Actual: '好' — slice starts at next full character boundary
```

Correct:

```typescript
import { sliceByWidth, stringWidth } from '@lpm.dev/neo.string-width'

// Slicing respects character boundaries
sliceByWidth('你好世界', 0, 4)  // '你好' (width 4)
sliceByWidth('你好世界', 2, 6)  // '好世' (width 4, starts at char boundary)

// For ASCII, it works like regular .slice()
sliceByWidth('Hello World', 2, 7)  // 'llo W' (width 5)

// When building fixed-width windows, account for boundary snapping
const text = '你好世界测试'
const chunks = splitByWidth(text, 4)  // ['你好', '世界', '测试']
```

`sliceByWidth` operates on visual column positions but never splits a multi-column character. If a start position falls in the middle of a wide character, it moves to the next character boundary.
