/**
 * @lpm.dev/neo.string-width - Unicode 16 string width utilities
 *
 * One pinned ANSI dependency, tree-shakeable, TypeScript-first, Unicode 16
 *
 * @example
 * ```typescript
 * import { stringWidth } from '@lpm.dev/neo.string-width'
 *
 * // Calculate visual width
 * stringWidth('Hello')                // => 5
 * stringWidth('你好')                  // => 4 (2 fullwidth chars)
 * stringWidth('\x1b[31mRed\x1b[0m')   // => 3 (ANSI stripped)
 * stringWidth('👍')                    // => 2 (emoji)
 *
 * // With options
 * stringWidth('古', { ambiguousIsNarrow: false })  // => 2
 * ```
 */

// Core function
export { stringWidth } from './core/width-calculator.js'

// Helper functions (tree-shakeable)
export { truncateToWidth } from './helpers/truncate.js'
export { padToWidth } from './helpers/pad.js'
export { sliceByWidth } from './helpers/slice.js'
export { splitByWidth } from './helpers/split.js'

// Utilities (for advanced use cases)
export { GraphemeIterator } from './core/grapheme-iterator.js'
export { getEastAsianWidth } from './core/unicode-data.js'

// Types
export type {
  StringWidthOptions,
  TruncateOptions,
  PadOptions,
  SliceOptions,
  SplitOptions,
  EastAsianWidth,
  Grapheme,
} from './types.js'

// Constants (for advanced use cases)
export {
  ZERO_WIDTH_CHARS,
  COMBINING_MARK_RANGES,
  EMOJI_RANGES,
  VARIATION_SELECTOR_TEXT,
  VARIATION_SELECTOR_EMOJI,
  isZeroWidth,
  isAsciiOnly,
} from './core/constants.js'

// Default export for backward compatibility with string-width
export { stringWidth as default } from './core/width-calculator.js'
