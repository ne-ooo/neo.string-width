---
name: migrate-from-string-width
description: Migration guide from string-width (sindresorhus) to neo.string-width — same stringWidth API, 10-20% faster (2-3x on ASCII), adds truncateToWidth/padToWidth/sliceByWidth/splitByWidth helpers, GraphemeIterator, getEastAsianWidth, emojiWidth option, countAnsiEscapeCodes option, normalize option, TypeScript native, ESM+CJS
version: "1.0.0"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Migrating from string-width to @lpm.dev/neo.string-width

## Why Migrate

| | string-width | neo.string-width |
|---|-------------|-----------------|
| **Performance** | Baseline | 10-20% faster (2-3x on ASCII) |
| **Dependencies** | 3 (emoji-regex, strip-ansi, eastasianwidth) | 1 (neo.ansi) |
| **TypeScript** | Built-in | Built-in |
| **ESM** | ESM only | ESM + CJS |
| **Helper functions** | None | truncate, pad, slice, split |
| **Grapheme iteration** | None | GraphemeIterator |
| **East Asian Width** | Via dep | getEastAsianWidth() exported |
| **Emoji width control** | Fixed | Configurable (1, 2, 'auto') |

## Basic Migration

### Default export → Named export

```typescript
// Before — string-width
import stringWidth from 'string-width'

stringWidth('hello')  // 5
stringWidth('你好')    // 4
stringWidth('👋')      // 2

// After — neo.string-width (named export)
import { stringWidth } from '@lpm.dev/neo.string-width'

stringWidth('hello')  // 5
stringWidth('你好')    // 4
stringWidth('👋')      // 2
```

The only API change is switching from a default export to a named export. All return values are identical.

### Options

```typescript
// Before — string-width
stringWidth('\u001B[31mhello\u001B[0m')  // 5 (ANSI always stripped)

// After — neo.string-width (same default, but configurable)
stringWidth('\u001B[31mhello\u001B[0m')  // 5 (ANSI stripped by default)
stringWidth('\u001B[31mhello\u001B[0m', { countAnsiEscapeCodes: true })  // 14
```

### Ambiguous Width

```typescript
// Before — string-width v5+
// Always treats ambiguous as narrow (width 1), not configurable

// After — neo.string-width (configurable)
stringWidth('α', { ambiguousIsNarrow: true })   // 1 (default, same as string-width)
stringWidth('α', { ambiguousIsNarrow: false })  // 2 (for CJK terminals)
```

## New Features Not in string-width

### Helper Functions

string-width only provides the width calculation. neo.string-width includes width-aware string manipulation:

```typescript
import {
  stringWidth,
  truncateToWidth,
  padToWidth,
  sliceByWidth,
  splitByWidth,
} from '@lpm.dev/neo.string-width'

// Truncate to fit within width
truncateToWidth('Hello 你好 World', 10)       // 'Hello 你好'
truncateToWidth('Hello 你好 World', 10, '…')  // 'Hello 你好…'  // Note: '…' is width 1 here

// Pad to exact width
padToWidth('你好', 10)              // '你好      '
padToWidth('你好', 10, ' ', 'left')  // '      你好'

// Slice by visual width
sliceByWidth('Hello 你好', 6, 10)   // '你好'

// Split into fixed-width chunks
splitByWidth('你好世界测试', 4)       // ['你好', '世界', '测试']
```

### GraphemeIterator

Iterate over grapheme clusters with their individual widths:

```typescript
import { GraphemeIterator } from '@lpm.dev/neo.string-width'

for (const { grapheme, width } of new GraphemeIterator('Hi 你好 👋')) {
  console.log(`"${grapheme}" → ${width}`)
}
```

### getEastAsianWidth

Direct access to Unicode East Asian Width property:

```typescript
import { getEastAsianWidth } from '@lpm.dev/neo.string-width'

getEastAsianWidth(0x4E00)  // 'W' (Wide)
getEastAsianWidth(0x41)    // 'Na' (Narrow)
getEastAsianWidth(0xFF01)  // 'F' (Fullwidth)
```

### Emoji Width Control

```typescript
// string-width: emoji always width 2
// neo.string-width: configurable
stringWidth('😀', { emojiWidth: 2 })      // 2 (default)
stringWidth('😀', { emojiWidth: 1 })      // 1
stringWidth('😀', { emojiWidth: 'auto' }) // uses Unicode property
```

### Normalize Option

```typescript
// Normalize text before measuring (handles decomposed vs precomposed)
stringWidth(userInput, { normalize: true })
```

## Migration Checklist

- [ ] Replace `import stringWidth from 'string-width'` with `import { stringWidth } from '@lpm.dev/neo.string-width'`
- [ ] Replace default import with named import in all files
- [ ] Remove `string-width`, `strip-ansi`, `emoji-regex`, `eastasianwidth` from dependencies
- [ ] Consider using helper functions (`truncateToWidth`, `padToWidth`, etc.) to replace manual width calculations
- [ ] If you were using `strip-ansi` separately, note that ANSI stripping is built into `stringWidth()`
- [ ] Optional: add `{ ambiguousIsNarrow: false }` for CJK terminal support
- [ ] Optional: add `{ normalize: true }` for user-supplied input

## Also Replaces

If you're using any of these packages alongside `string-width`, neo.string-width can replace them all:

| Package | Replacement |
|---------|-------------|
| `string-width` | `stringWidth()` |
| `cli-truncate` | `truncateToWidth()` |
| `pad-left` / `pad-right` (width-aware) | `padToWidth()` |
| `slice-ansi` (width-aware) | `sliceByWidth()` |
| `wrap-ansi` (width-aware splitting) | `splitByWidth()` |
