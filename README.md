# @lpm.dev/neo.string-width

`@lpm.dev/neo.string-width` measures and changes the terminal-column width of
Unicode 16 text and ANSI-styled strings.

## Features

- **Unicode 16:** The package includes generated width, emoji, and
  grapheme-property tables.
- **ANSI support:** Width operations recognize terminal sequences through
  `@lpm.dev/neo.ansi`.
- **Grapheme safety:** Helpers preserve emoji sequences, combining marks, and
  other grapheme clusters.
- **Width helpers:** Truncate, pad, slice, and split text by terminal columns.
- **Deterministic data:** Results do not depend on the ICU version of the host
  runtime.
- **Dependency surface:** The package has one exact-pinned runtime dependency.

## Install

Install the package with LPM:

```bash
lpm install @lpm.dev/neo.string-width
```

## Quick start

```typescript
import stringWidth from "@lpm.dev/neo.string-width";

stringWidth("hello"); // 5
stringWidth("你好"); // 4
stringWidth("👍"); // 2
stringWidth("\x1b[31mRed\x1b[0m"); // 3
stringWidth("Hello 你好 👍"); // 13
```

## API

### `stringWidth(text, options?): number`

`stringWidth()` returns the visual width of a string in terminal columns.

**Parameters**

| Name      | Type                 | Default  | Description                    |
| --------- | -------------------- | -------- | ------------------------------ |
| `text`    | `string`             | Required | The text to measure.           |
| `options` | `StringWidthOptions` | `{}`     | The width calculation options. |

**Options**

| Name                   | Type                  | Default | Description                                           |
| ---------------------- | --------------------- | ------- | ----------------------------------------------------- |
| `ambiguousIsNarrow`    | `boolean`             | `true`  | Gives East Asian ambiguous characters a width of one. |
| `countAnsiEscapeCodes` | `boolean`             | `false` | Counts ANSI escape codes in the width.                |
| `emojiWidth`           | `1`, `2`, or `"auto"` | `2`     | Selects the width of emoji graphemes.                 |
| `normalize`            | `boolean`             | `false` | Applies NFC normalization before measurement.         |

Control characters and default-ignorable code points have a width of zero. Tabs
have no fixed width because their display depends on the tab stop.

```typescript
import stringWidth from "@lpm.dev/neo.string-width";

stringWidth("hello"); // 5
stringWidth("你好世界"); // 8
stringWidth("👍👎"); // 4
```

### `truncateToWidth(text, width, options?): string`

`truncateToWidth()` shortens text to the specified visual width.

```typescript
import { truncateToWidth } from "@lpm.dev/neo.string-width";

truncateToWidth("Hello World", 8); // "Hello W…"
truncateToWidth("Hello World", 8, { position: "start" }); // "…o World"
truncateToWidth("Hello World", 8, { position: "middle" }); // "Hel…orld"
truncateToWidth("Hello World", 8, { ellipsis: "..." }); // "Hello..."
truncateToWidth("Hello World Test", 10, { wordBoundary: true }); // "Hello…"
```

**Options**

| Name           | Type                              | Default | Description                         |
| -------------- | --------------------------------- | ------- | ----------------------------------- |
| `position`     | `"end"`, `"start"`, or `"middle"` | `"end"` | Selects the truncated part.         |
| `ellipsis`     | `string`                          | `"…"`   | Marks removed content.              |
| `wordBoundary` | `boolean`                         | `false` | Prefers an available word boundary. |

### `padToWidth(text, width, options?): string`

`padToWidth()` adds a padding pattern until the string reaches the specified
width.

```typescript
import { padToWidth } from "@lpm.dev/neo.string-width";

padToWidth("Hello", 10); // "Hello     "
padToWidth("Hello", 10, { align: "right" }); // "     Hello"
padToWidth("Hello", 10, { align: "center" }); // "  Hello   "
padToWidth("Hello", 10, { padChar: "." }); // "Hello....."
padToWidth("你好", 10); // "你好      "
```

**Options**

| Name      | Type                               | Default  | Description                             |
| --------- | ---------------------------------- | -------- | --------------------------------------- |
| `align`   | `"left"`, `"right"`, or `"center"` | `"left"` | Selects the side that receives padding. |
| `padChar` | `string`                           | `" "`    | Supplies the repeated padding pattern.  |

### `sliceByWidth(text, start, end?, options?): string`

`sliceByWidth()` returns complete graphemes inside a visual-column range.

```typescript
import { sliceByWidth } from "@lpm.dev/neo.string-width";

sliceByWidth("Hello World", 0, 5); // "Hello"
sliceByWidth("Hello World", -5); // "World"
sliceByWidth("你好世界", 0, 4); // "你好"
sliceByWidth("Hello 你好", 0, 7); // "Hello "
```

Only complete graphemes in the requested range appear in the result. Set
`ellipsis` to mark a wide grapheme that crosses a boundary.

### `splitByWidth(text, maxWidth, options?): string[]`

`splitByWidth()` divides text into chunks that fit within a maximum visual
width.

```typescript
import { splitByWidth } from "@lpm.dev/neo.string-width";

splitByWidth("Hello World", 5); // ["Hello", "World"]
splitByWidth("你好世界测试", 8); // ["你好世界", "测试"]
splitByWidth("Hello World Test", 10, { preferSplitOnSpace: true });
// ["Hello", "World Test"]
splitByWidth("  Hello  ", 10, { preserveWhitespace: true });
// ["  Hello  "]
```

**Options**

| Name                 | Type      | Default    | Description                          |
| -------------------- | --------- | ---------- | ------------------------------------ |
| `preferSplitOnSpace` | `boolean` | `true`     | Prefers whitespace boundaries.       |
| `wordBoundary`       | `boolean` | Deprecated | An alias for `preferSplitOnSpace`.   |
| `preserveWhitespace` | `boolean` | `false`    | Keeps trailing whitespace in chunks. |

## Behavior and limits

Width arguments must be finite safe integers. Padding and truncation accept
zero.

`splitByWidth()` requires `maxWidth` to be more than zero. If one grapheme is
too wide, the function throws.

All ANSI-aware operations reject input with more than `128` ANSI-sequence
introducers. This limit bounds parser and terminal-state metadata.

Width-changing helpers also reject generated balanced strings that exceed this
limit. Thus, every returned string remains valid package input.

ANSI-aware splitting rejects output with more than `1048576` chunks. This limit
bounds range metadata before the package allocates chunk strings.

When `countAnsiEscapeCodes` is `true`, helpers apply more limits:

- An ANSI-bearing primary input can contain at most `4096` UTF-16 code units.
- Ellipses and padding patterns have the same length limit, with or without ANSI
  codes.
- A primary or secondary string can contain at most `128` ANSI-sequence
  introducers.

These helper limits do not apply to `stringWidth()`.

The package implements all UAX #11 width categories:

| Category        |        Width | Example    |
| --------------- | -----------: | ---------- |
| Fullwidth (`F`) |            2 | `，、。！` |
| Wide (`W`)      |            2 | `你好世界` |
| Halfwidth (`H`) |            1 | `ｱｲｳｴｵ`    |
| Narrow (`Na`)   |            1 | `hello`    |
| Ambiguous (`A`) | 1 by default | `±§¶`      |
| Neutral (`N`)   |            1 | `hello`    |

The grapheme implementation supports emoji modifiers, ZWJ sequences, variation
selectors, and combining marks.

## Security

`@lpm.dev/neo.string-width` preserves ANSI state across helper output, but it
does not make terminal text trustworthy.

- The package recognizes ANSI sequences with `@lpm.dev/neo.ansi`.
- Resource limits bound parser and output metadata.
- The application remains responsible for its terminal-output policy.

Read [SECURITY.md](./SECURITY.md) before you process untrusted terminal text.

## Examples

### Format a table row

```typescript
import { padToWidth, truncateToWidth } from "@lpm.dev/neo.string-width";

function formatTableRow(name: string, value: string) {
  const nameColumn = padToWidth(truncateToWidth(name, 20), 20);
  const valueColumn = padToWidth(value, 30, { align: "right" });
  return `│ ${nameColumn} │ ${valueColumn} │`;
}

formatTableRow("User Name", "你好世界");
// "│ User Name            │                      你好世界 │"
```

### Wrap text

```typescript
import { splitByWidth } from "@lpm.dev/neo.string-width";

function wrapText(text: string, maxWidth: number): string[] {
  return splitByWidth(text, maxWidth, { preferSplitOnSpace: true });
}

wrapText("这是一段很长的中文文本需要被分割", 20);
// ["这是一段很长的中文文", "本需要被分割"]
```

## Migration from `string-width`

The default `stringWidth()` call maps directly for most inputs.

```diff
- import stringWidth from "string-width";
+ import stringWidth from "@lpm.dev/neo.string-width";
```

Run compatibility tests for Unicode, ANSI, and non-string inputs.

See the [migration guide](./.lpm/skills/migrate-from-string-width.md) for
documented differences.

## Performance

The repository compares this package with exact-pinned `string-width` 8.2.2.
Each workload compares output before it records timings.

The recorded environment used Node.js 26.5.0 on an Apple M5 Pro. ANSI-heavy
workloads were slower in that environment.

See [BENCHMARKS.md](./BENCHMARKS.md) for the environment, workloads, results,
limits, and reproduction commands.

Run the benchmark suite:

```bash
lpm run bench
```

Benchmark results depend on the runtime, computer, options, and input text.

## Runtime support

- **Node.js:** 18 or later
- **Browsers:** Chrome 87+, Firefox 90+, Safari 14.1+, and compatible later
  versions
- **Module formats:** ESM and CommonJS
- **TypeScript:** Declaration files are included
- **Unicode:** Version-pinned Unicode 16 data

The package does not require `Intl.Segmenter`.

## Development

Run the package checks:

```bash
lpm run check
```

Run the benchmark suite:

```bash
lpm run bench
```

## License

MIT. See [LICENSE](./LICENSE).
