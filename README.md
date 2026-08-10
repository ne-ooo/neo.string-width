# @lpm.dev/neo.string-width

> Unicode 16 string-width utilities with a small, auditable dependency surface

Calculate the visual width of strings for terminal/console output. Correctly handles Unicode, emoji, CJK characters, and ANSI escape codes.

---

## Why This Package?

**Measured Performance**

- Benchmarked against the real, exact-pinned `string-width` 8.2.2 package
- Comparison workloads verify equal output before timing begins
- 1.23x the batch throughput in the recorded environment; results vary by input

**✨ Feature Rich**

- Built-in helper functions: truncate, pad, slice, split by width
- Full TypeScript support with strict types
- Tree-shakeable (import only what you need)

**🎯 Small Dependency Surface**

- One pinned runtime dependency: `@lpm.dev/neo.ansi`
- Exact dependency versions and a committed LPM lockfile

**💯 Correct**

- Unicode 16 compliant
- Handles all edge cases (emoji with skin tones, ZWJ sequences, combining marks)
- Complete generated Unicode 16 property tables and 343 regression tests

---

## Installation

```bash
lpm install @lpm.dev/neo.string-width
```

---

## Quick Start

```typescript
import stringWidth from "@lpm.dev/neo.string-width";

// ASCII text
stringWidth("hello"); // => 5

// CJK characters (fullwidth)
stringWidth("你好"); // => 4 (2 chars × 2 width)

// Emoji
stringWidth("👍"); // => 2

// ANSI colored text (codes are stripped)
stringWidth("\x1b[31mRed\x1b[0m"); // => 3

// Mixed content
stringWidth("Hello 你好 👍"); // => 11
```

---

## API

### `stringWidth(text, options?)`

Calculate the visual width of a string.

**Parameters:**

- `text` (string): Text to measure
- `options` (object, optional):
  - `ambiguousIsNarrow` (boolean): Treat ambiguous-width characters as narrow (default: `true`)
  - `countAnsiEscapeCodes` (boolean): Count ANSI codes in width (default: `false`)
  - `emojiWidth` (number | 'auto'): Width for emoji (default: `2`)
  - `normalize` (boolean): Normalize text before measuring (default: `false`)

**Returns:** number - Visual width in columns

Control characters and default-ignorable code points have width 0. Tabs do not have a fixed width because their display depends on the current tab stop.

```typescript
import stringWidth from "@lpm.dev/neo.string-width";

stringWidth("hello"); // => 5
stringWidth("你好世界"); // => 8
stringWidth("👍👎"); // => 4
```

---

## Helper Functions

### `truncateToWidth(text, width, options?)`

Truncate text to fit within a specified width.

```typescript
import { truncateToWidth } from "@lpm.dev/neo.string-width";

// End truncation (default)
truncateToWidth("Hello World", 8);
// => 'Hello W…'

// Start truncation
truncateToWidth("Hello World", 8, { position: "start" });
// => '…o World'

// Middle truncation
truncateToWidth("Hello World", 8, { position: "middle" });
// => 'Hel…orld'

// Custom ellipsis
truncateToWidth("Hello World", 8, { ellipsis: "..." });
// => 'Hello...'

// Word boundary preference
truncateToWidth("Hello World Test", 10, { wordBoundary: true });
// => 'Hello…'
```

**Options:**

- `position`: 'end' | 'start' | 'middle' (default: 'end')
- `ellipsis`: string (default: '…')
- `wordBoundary`: boolean (default: false)

---

### `padToWidth(text, width, options?)`

Pad text to reach a specified width.

```typescript
import { padToWidth } from "@lpm.dev/neo.string-width";

// Right padding (default)
padToWidth("Hello", 10);
// => 'Hello     '

// Left padding
padToWidth("Hello", 10, { align: "right" });
// => '     Hello'

// Center padding
padToWidth("Hello", 10, { align: "center" });
// => '  Hello   '

// Custom pad character
padToWidth("Hello", 10, { padChar: "." });
// => 'Hello.....'

// Works with CJK
padToWidth("你好", 10);
// => '你好      '
```

**Options:**

- `align`: 'left' | 'right' | 'center' (default: 'left')
- `padChar`: string (default: ' ')

---

### `sliceByWidth(text, start, end?)`

Slice text by visual width (like String.slice but width-aware).

```typescript
import { sliceByWidth } from "@lpm.dev/neo.string-width";

// Basic slicing
sliceByWidth("Hello World", 0, 5);
// => 'Hello'

// Negative indices
sliceByWidth("Hello World", -5);
// => 'World'

// Works with CJK (width-based, not character-based)
sliceByWidth("你好世界", 0, 4);
// => '你好' (2 chars, width 4)

// Mixed content
sliceByWidth("Hello 你好", 0, 7);
// => 'Hello 你'
```

Only graphemes fully contained in the requested column range are returned. Set `ellipsis` in the options to mark a wide grapheme that crosses a boundary.

---

### `splitByWidth(text, maxWidth, options?)`

Split text into chunks that fit within a maximum width.

```typescript
import { splitByWidth } from "@lpm.dev/neo.string-width";

// Basic splitting
splitByWidth("Hello World", 5);
// => ['Hello', 'World']

// CJK text
splitByWidth("你好世界测试", 8);
// => ['你好世界', '测试']

// Word boundary preference
splitByWidth("Hello World Test", 10, { preferSplitOnSpace: true });
// => ['Hello', 'World Test']

// Preserve whitespace
splitByWidth("  Hello  ", 10, { preserveWhitespace: true });
// => ['  Hello  ']
```

**Options:**

- `preferSplitOnSpace`: boolean (default: true)
- `preserveWhitespace`: boolean (default: false)

Width arguments must be finite safe integers. Padding and truncation accept zero; `splitByWidth` requires `maxWidth > 0` and throws when one indivisible grapheme is wider than the requested line.

---

## Unicode Support

### East Asian Width Categories

Correctly handles all UAX #11 categories:

| Category          | Width | Examples       |
| ----------------- | ----- | -------------- |
| **Fullwidth (F)** | 2     | ，、。！       |
| **Wide (W)**      | 2     | 你好世界 (CJK) |
| **Halfwidth (H)** | 1     | ｱｲｳｴｵ          |
| **Narrow (Na)**   | 1     | hello          |
| **Ambiguous (A)** | 1\*   | ±§¶            |
| **Neutral (N)**   | 1     | hello          |

\* Configurable via `ambiguousIsNarrow` option

### Emoji Support

- ✅ Simple emoji: 👍 (width 2)
- ✅ Emoji with skin tones: 👍🏻 (width 2, single grapheme)
- ✅ ZWJ sequences: 👨‍👩‍👧‍👦 (width 2, single grapheme)
- ✅ Variation selectors: ❤️ vs ❤︎
- ✅ Emoji presentation: automatic detection

### Special Characters

- ✅ Zero-width characters (ZWSP, ZWNJ, ZWJ, etc.)
- ✅ Combining marks (é = e + combining acute)
- ✅ ANSI escape codes (automatically stripped)
- ✅ Grapheme clusters (proper Unicode segmentation)

---

## Performance

### Benchmarks vs string-width 8.2.2

| Test Case | neo.string-width | string-width | Relative result |
| --------- | ---------------: | -----------: | --------------: |
| Short ASCII | 20.83M ops/sec | 10.38M ops/sec | 2.01x |
| Chinese | 318.85k ops/sec | 215.49k ops/sec | 1.48x |
| Simple emoji | 540.80k ops/sec | 393.33k ops/sec | 1.37x |
| Short ANSI | 3.29M ops/sec | 4.04M ops/sec | 0.81x |
| Mixed batch | 4.25k ops/sec | 3.46k ops/sec | 1.23x |

Results were recorded on Node.js 26.5.0 and an Apple M5 Pro. ANSI-heavy
workloads remain slower. See [BENCHMARKS.md](./BENCHMARKS.md) for the complete
environment, workloads, limitations, and reproduction commands.

---

## Dependency Surface

The package has one exact-pinned runtime dependency, `@lpm.dev/neo.ansi`, for
complete ANSI recognition. It publishes ESM and CJS builds and declares
`sideEffects: false` for tree-shaking.

```typescript
// Import the core function and selected helpers
import stringWidth, {
  truncateToWidth,
  padToWidth,
} from "@lpm.dev/neo.string-width";

// Import only stringWidth
import stringWidth from "@lpm.dev/neo.string-width";

// Import only helpers you need
import { truncateToWidth } from "@lpm.dev/neo.string-width";
```

---

## TypeScript

Fully typed with strict TypeScript support:

```typescript
import stringWidth, {
  type StringWidthOptions,
  type TruncateOptions,
  type PadOptions,
  type SliceOptions,
  type SplitOptions,
} from "@lpm.dev/neo.string-width";

// Type-safe options
const options: StringWidthOptions = {
  ambiguousIsNarrow: false,
  emojiWidth: 1,
};

stringWidth("text", options); // number
```

---

## Real-World Examples

### Terminal Table Formatting

```typescript
import { padToWidth, truncateToWidth } from "@lpm.dev/neo.string-width";

function formatTableRow(name: string, value: string) {
  const nameCol = padToWidth(truncateToWidth(name, 20), 20);
  const valueCol = padToWidth(value, 30, { align: "right" });
  return `│ ${nameCol} │ ${valueCol} │`;
}

formatTableRow("User Name", "你好世界");
// => '│ User Name            │                      你好世界 │'
```

### Progress Bar

```typescript
import { padToWidth } from "@lpm.dev/neo.string-width";

function progressBar(percent: number, width: number = 40) {
  const filled = Math.floor((width * percent) / 100);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  return `[${bar}] ${percent}%`;
}

progressBar(75, 20);
// => '[███████████████░░░░] 75%'
```

### Text Wrapping

```typescript
import { splitByWidth } from "@lpm.dev/neo.string-width";

function wrapText(text: string, maxWidth: number): string[] {
  return splitByWidth(text, maxWidth, { preferSplitOnSpace: true });
}

wrapText("这是一段很长的中文文本需要被分割", 20);
// => ['这是一段很长的中文文', '本需要被分割']
```

### Truncate File Paths

```typescript
import { truncateToWidth } from "@lpm.dev/neo.string-width";

function truncatePath(path: string, maxWidth: number) {
  return truncateToWidth(path, maxWidth, { position: "middle" });
}

truncatePath("/very/long/path/to/some/file.txt", 25);
// => '/very/long/…some/file.txt'
```

---

## Migration from string-width

Drop-in replacement in most cases:

```typescript
// Before
import stringWidth from "string-width";
const width = stringWidth("text");

// After
import stringWidth from "@lpm.dev/neo.string-width";
const width = stringWidth("text"); // Same API!
```

See [MIGRATION.md](./MIGRATION.md) for detailed migration guide.

---

## How It Works

1. **ANSI Parsing**: Recognize 7-bit ESC and 8-bit C1 sequences with `@lpm.dev/neo.ansi`
2. **ASCII Fast Path**: Return `text.length` for printable ASCII
3. **Grapheme Segmentation**: Apply UAX #29 with generated Unicode 16 properties
4. **Width Calculation**: Use complete East Asian Width and emoji-property tables
5. **Safe Helpers**: Preserve grapheme boundaries and balance ANSI styles across output chunks

The Unicode tables are version-pinned, checksum-verified, and committed to the package. Results do not depend on the host's ICU version.

---

## Browser Support

- ✅ Node.js 18+
- ✅ Modern browsers (Chrome 87+, Firefox 90+, Safari 14.1+)
- ✅ No `Intl.Segmenter` dependency

---

## Testing

```bash
lpm run test           # Run all tests
lpm run test:coverage  # Generate a coverage report
lpm run bench          # Run benchmarks
```

The suite includes Unicode, ANSI-safety, helper-boundary, and TypeScript contract tests.

---

## License

MIT

---

## FAQ

**Q: Why can this be faster than string-width?**

A: Printable ASCII uses a fast path. Unicode measurement streams pinned lookup
tables without depending on host ICU data. Performance varies by input; see the
reproducible benchmark report, including the slower ANSI cases.

**Q: Is this a drop-in replacement for string-width?**

A: Yes, in most cases! Same API for the core `stringWidth()` function. Plus bonus helper functions.

**Q: What about emoji support?**

A: Full support including skin tones (👍🏻), ZWJ sequences (👨‍👩‍👧‍👦), and variation selectors (❤️).

**Q: Does it work in browsers?**

A: Yes. Grapheme segmentation is included, so browser behavior does not depend on `Intl.Segmenter` or the host ICU version.

**Q: Why create another string-width package?**

A: To provide deterministic Unicode data, built-in helpers, a small dependency surface, and TypeScript-first design.
