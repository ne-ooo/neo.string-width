/**
 * Truncate strings to a specific width with ellipsis
 *
 * Handles Unicode characters, emoji, and ANSI codes correctly
 */

import { stringWidth } from '../core/width-calculator.js'
import { GraphemeIterator } from '../core/grapheme-iterator.js'
import type { TruncateOptions } from '../types.js'

/**
 * Internal options type with all required properties
 */
interface InternalTruncateOptions {
  position: 'end' | 'middle' | 'start'
  ellipsis: string
  wordBoundary: boolean
}

/**
 * Default options for truncation
 */
const DEFAULT_OPTIONS: InternalTruncateOptions = {
  position: 'end',
  ellipsis: '…',
  wordBoundary: false,
}

/**
 * Truncate a string to fit within a specified width
 *
 * @param text - String to truncate
 * @param width - Maximum width in columns
 * @param options - Truncation options
 * @returns Truncated string with ellipsis
 *
 * @example
 * ```typescript
 * truncateToWidth('Hello World', 8)
 * // => 'Hello W…'
 *
 * truncateToWidth('Hello World', 8, { position: 'middle' })
 * // => 'Hel…rld'
 *
 * truncateToWidth('Hello World', 8, { position: 'start' })
 * // => '…o World'
 *
 * truncateToWidth('Hello World', 8, { ellipsis: '...' })
 * // => 'Hello...'
 *
 * truncateToWidth('你好世界', 6)
 * // => '你好…' (CJK characters are width 2 each)
 * ```
 */
export function truncateToWidth(
  text: string,
  width: number,
  options?: TruncateOptions
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // If text already fits, return as-is
  const currentWidth = stringWidth(text)
  if (currentWidth <= width) {
    return text
  }

  // Calculate ellipsis width
  const ellipsisWidth = stringWidth(opts.ellipsis)

  // If width is too small for ellipsis, just return ellipsis
  if (width <= ellipsisWidth) {
    return opts.ellipsis.slice(0, width)
  }

  // Available width for content (excluding ellipsis)
  const availableWidth = width - ellipsisWidth

  switch (opts.position) {
    case 'start':
      return truncateStart(text, availableWidth, opts)
    case 'middle':
      return truncateMiddle(text, availableWidth, opts)
    case 'end':
    default:
      return truncateEnd(text, availableWidth, opts)
  }
}

/**
 * Truncate from the end (default)
 *
 * "Hello World" -> "Hello W…"
 */
function truncateEnd(
  text: string,
  availableWidth: number,
  opts: InternalTruncateOptions
): string {
  const graphemes = new GraphemeIterator(text).toArray()
  let width = 0
  let index = 0

  // Find where to truncate
  for (let i = 0; i < graphemes.length; i++) {
    const graphemeWidth = stringWidth(graphemes[i]!)
    if (width + graphemeWidth > availableWidth) {
      break
    }
    width += graphemeWidth
    index = i + 1
  }

  // Optionally prefer truncating on space
  if (opts.wordBoundary && index > 0) {
    const truncated = graphemes.slice(0, index)
    const lastSpaceIndex = truncated.lastIndexOf(' ')
    if (lastSpaceIndex > 0) {
      index = lastSpaceIndex
    }
  }

  return graphemes.slice(0, index).join('') + opts.ellipsis
}

/**
 * Truncate from the start
 *
 * "Hello World" -> "…o World"
 */
function truncateStart(
  text: string,
  availableWidth: number,
  opts: InternalTruncateOptions
): string {
  const graphemes = new GraphemeIterator(text).toArray()
  let width = 0
  let index = graphemes.length

  // Find where to start (from the end)
  for (let i = graphemes.length - 1; i >= 0; i--) {
    const graphemeWidth = stringWidth(graphemes[i]!)
    if (width + graphemeWidth > availableWidth) {
      break
    }
    width += graphemeWidth
    index = i
  }

  // Optionally prefer truncating on space
  if (opts.wordBoundary && index < graphemes.length) {
    const remaining = graphemes.slice(index)
    const firstSpaceIndex = remaining.indexOf(' ')
    if (firstSpaceIndex > 0) {
      index += firstSpaceIndex // Keep the space in result
    }
  }

  return opts.ellipsis + graphemes.slice(index).join('')
}

/**
 * Truncate from the middle
 *
 * "Hello World" -> "Hel…rld"
 */
function truncateMiddle(
  text: string,
  availableWidth: number,
  opts: InternalTruncateOptions
): string {
  const graphemes = new GraphemeIterator(text).toArray()

  // Calculate how much to take from start and end
  const halfWidth = Math.floor(availableWidth / 2)
  const startWidth = halfWidth
  const endWidth = availableWidth - startWidth

  // Collect graphemes from start
  let startIndex = 0
  let width = 0
  for (let i = 0; i < graphemes.length; i++) {
    const graphemeWidth = stringWidth(graphemes[i]!)
    if (width + graphemeWidth > startWidth) {
      break
    }
    width += graphemeWidth
    startIndex = i + 1
  }

  // Collect graphemes from end
  let endIndex = graphemes.length
  width = 0
  for (let i = graphemes.length - 1; i >= 0; i--) {
    const graphemeWidth = stringWidth(graphemes[i]!)
    if (width + graphemeWidth > endWidth) {
      break
    }
    width += graphemeWidth
    endIndex = i
  }

  const start = graphemes.slice(0, startIndex).join('')
  const end = graphemes.slice(endIndex).join('')

  return start + opts.ellipsis + end
}
