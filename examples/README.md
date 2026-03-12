# Examples

This directory contains practical examples demonstrating how to use `@lpm.dev/neo.string-width` in real-world scenarios.

## Running the Examples

```bash
# Install dependencies first
cd ..
npm install

# Build the package
npm run build

# Run an example using tsx (installed as dev dependency)
npx tsx examples/basic-usage.ts
npx tsx examples/table-formatting.ts
npx tsx examples/progress-bar.ts
npx tsx examples/text-wrapping.ts
npx tsx examples/truncate-paths.ts
npx tsx examples/unicode-examples.ts
```

## Available Examples

### 1. [basic-usage.ts](./basic-usage.ts)

Basic examples of the `stringWidth()` function:
- ASCII text
- CJK characters (Chinese, Japanese, Korean)
- Emoji (simple and complex)
- ANSI colored text
- Mixed content
- Options (ambiguousIsNarrow, emojiWidth)
- Edge cases

**Run:**
```bash
npx tsx examples/basic-usage.ts
```

### 2. [table-formatting.ts](./table-formatting.ts)

Terminal table formatting with Unicode support:
- Creating aligned tables with borders
- Truncating long content with `truncateToWidth()`
- Padding columns with `padToWidth()`
- Handling CJK and emoji in tables
- Simple aligned output
- Key-value pairs with dots

**Run:**
```bash
npx tsx examples/table-formatting.ts
```

### 3. [progress-bar.ts](./progress-bar.ts)

Progress bar implementations:
- Simple progress bars
- Progress bars with labels
- CJK labels support
- Animated progress simulation
- Spinner animations
- Multi-step progress indicators

**Run:**
```bash
npx tsx examples/progress-bar.ts
```

### 4. [text-wrapping.ts](./text-wrapping.ts)

Text wrapping for terminal display:
- Basic text wrapping with `splitByWidth()`
- CJK text wrapping
- Mixed content (English + CJK + emoji)
- Whitespace handling options
- Character-based vs word-based splitting
- Paragraph formatting
- Markdown-style formatting
- Code block wrapping

**Run:**
```bash
npx tsx examples/text-wrapping.ts
```

### 5. [truncate-paths.ts](./truncate-paths.ts)

File path truncation:
- Truncating at end, start, or middle
- Custom ellipsis characters
- File list display
- Breadcrumb navigation
- Git status display
- Command output truncation

**Run:**
```bash
npx tsx examples/truncate-paths.ts
```

### 6. [unicode-examples.ts](./unicode-examples.ts)

Comprehensive Unicode support:
- CJK characters (Chinese, Japanese, Korean)
- Emoji variations (skin tones, ZWJ sequences, flags)
- Combining characters (diacritics)
- Zero-width characters
- Ambiguous width characters
- Mixed content tables
- Emoji width options
- Unicode normalization
- RTL text (width calculation only)

**Run:**
```bash
npx tsx examples/unicode-examples.ts
```

## Example Output Samples

### Table Formatting

```
┌────────────────────────────────────────────────────────────────────────┐
│ Name                 │  Age  │ Status       │ Location        │
├────────────────────────────────────────────────────────────────────────┤
│ John Doe             │  28   │ ✅ Active    │ New York        │
│ 李明                 │  32   │ ⏸️  Paused   │ 北京            │
│ María García         │  24   │ ✅ Active    │ Madrid          │
│ 山田太郎             │  45   │ ❌ Inactive  │ 東京            │
│ Very Long Name Th…   │  19   │ ✅ Active    │ London          │
└────────────────────────────────────────────────────────────────────────┘
```

### Progress Bar

```
Download              [████████████░░░░░░░░░░░░░░░░░░]   40%
Install               [████████████████████████░░░░░░]   80%
Complete              [██████████████████████████████]  100%
```

### Text Wrapping

```
│ This is a long line of text that needs
│ to be wrapped for terminal display. It
│ contains multiple words and should
│ break at word boundaries when possible.
```

## Tips

1. **TypeScript**: All examples are written in TypeScript and can be run with `tsx`.

2. **Building First**: Make sure to build the package (`npm run build`) before running examples.

3. **Terminal Width**: Some examples look best in terminals with at least 80 columns width.

4. **Colors**: Examples using ANSI colors will display colors in your terminal.

5. **Unicode Support**: Make sure your terminal supports Unicode characters for best results.

## Creating Your Own Examples

Feel free to create your own examples based on these templates. The general structure is:

```typescript
import stringWidth, { truncateToWidth, padToWidth, /* ... */ } from '@lpm.dev/neo.string-width'

// Your code here
console.log(stringWidth('Hello World'))
```

## Learn More

- [Main README](../README.md) - Full API documentation
- [Migration Guide](../MIGRATION.md) - Migrating from string-width
- [Benchmarks](../BENCHMARKS.md) - Performance details
