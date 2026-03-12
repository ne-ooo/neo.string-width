/**
 * TypeScript type definitions for @lpm.dev/neo.string-width
 *
 * Modern, zero-dependency string width calculator
 */

/**
 * East Asian Width categories per UAX #11
 *
 * @see https://www.unicode.org/reports/tr11/
 */
export type EastAsianWidth =
  | 'F' // Fullwidth
  | 'H' // Halfwidth
  | 'W' // Wide
  | 'Na' // Narrow
  | 'A' // Ambiguous
  | 'N' // Neutral

/**
 * Options for string width calculation
 */
export interface StringWidthOptions {
  /**
   * Treat ambiguous characters as narrow (default: true)
   *
   * Per UAX #11, ambiguous characters can be 1 or 2 columns
   * depending on context. Default assumes narrow context (Western).
   *
   * @default true
   */
  ambiguousIsNarrow?: boolean

  /**
   * Count ANSI escape codes in width (default: false)
   *
   * When false, ANSI codes are stripped before measuring.
   *
   * @default false
   */
  countAnsiEscapeCodes?: boolean

  /**
   * Width of emoji characters
   *
   * - 1: Treat as single width
   * - 2: Treat as double width (default)
   * - 'auto': Detect based on emoji presentation (variation selectors)
   *
   * @default 2
   */
  emojiWidth?: 1 | 2 | 'auto'

  /**
   * Normalize Unicode before measuring (default: false)
   *
   * When true, applies NFC normalization to handle
   * composed vs decomposed characters consistently.
   *
   * @default false
   */
  normalize?: boolean
}

/**
 * Options for truncating strings to width
 */
export interface TruncateOptions extends StringWidthOptions {
  /**
   * Truncation indicator
   *
   * @default '...'
   */
  ellipsis?: string

  /**
   * Position to truncate
   *
   * - 'end': Truncate at end (default)
   * - 'middle': Truncate in middle
   * - 'start': Truncate at start
   *
   * @default 'end'
   */
  position?: 'end' | 'middle' | 'start'

  /**
   * Prefer word boundaries when truncating (default: false)
   *
   * When true, tries to break at word boundaries instead of
   * mid-word. Falls back to character truncation if needed.
   *
   * @default false
   */
  wordBoundary?: boolean
}

/**
 * Options for padding strings to width
 */
export interface PadOptions extends StringWidthOptions {
  /**
   * Alignment for padding
   *
   * - 'left': Pad on the left
   * - 'right': Pad on the right (default)
   * - 'center': Pad on both sides
   *
   * @default 'right'
   */
  align?: 'left' | 'right' | 'center'

  /**
   * Character to use for padding
   *
   * Must be a single-width character (width = 1).
   *
   * @default ' '
   */
  padChar?: string
}

/**
 * Options for slicing strings by width
 */
export interface SliceOptions extends StringWidthOptions {
  /**
   * Truncation indicator for partial wide characters
   *
   * @default ''
   */
  ellipsis?: string
}

/**
 * Options for splitting strings by width
 */
export interface SplitOptions extends StringWidthOptions {
  /**
   * Prefer word boundaries when splitting (default: false)
   *
   * When true, tries to break at word boundaries instead of
   * mid-word. Falls back to character splitting if needed.
   *
   * @default false
   */
  wordBoundary?: boolean

  /**
   * Preserve trailing whitespace (default: false)
   *
   * When true, keeps whitespace at end of lines.
   *
   * @default false
   */
  preserveWhitespace?: boolean
}

/**
 * Grapheme cluster with metadata
 *
 * Used internally for width calculation and iteration.
 */
export interface Grapheme {
  /** The grapheme cluster string */
  text: string
  /** Visual width (0, 1, or 2) */
  width: number
  /** Start position in original string */
  start: number
  /** End position in original string */
  end: number
  /** East Asian Width category */
  category: EastAsianWidth
}
