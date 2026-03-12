/**
 * Slice strings by visual width
 *
 * Handles Unicode characters, emoji, and ANSI codes correctly
 */

import { stringWidth } from '../core/width-calculator.js'
import { GraphemeIterator } from '../core/grapheme-iterator.js'
import type { SliceOptions } from '../types.js'

/**
 * Slice a string by visual width (similar to String.prototype.slice but width-aware)
 *
 * @param text - String to slice
 * @param startWidth - Starting width position (can be negative)
 * @param endWidth - Ending width position (optional, can be negative)
 * @param options - Slice options
 * @returns Sliced string
 *
 * @example
 * ```typescript
 * sliceByWidth('Hello World', 0, 5)
 * // => 'Hello'
 *
 * sliceByWidth('Hello World', 6)
 * // => 'World'
 *
 * sliceByWidth('Hello World', -5)
 * // => 'World'
 *
 * sliceByWidth('你好世界', 0, 4)
 * // => '你好' (CJK characters are width 2 each)
 *
 * sliceByWidth('你好世界', 2, 6)
 * // => '好世' (slices in the middle)
 * ```
 */
export function sliceByWidth(
  text: string,
  startWidth: number,
  endWidth?: number,
  options?: SliceOptions
): string {
  // Handle empty string
  if (!text) return ''

  const graphemes = new GraphemeIterator(text).toArray()
  const totalWidth = stringWidth(text)

  // Normalize negative indices
  const normalizedStart = startWidth < 0 ? Math.max(0, totalWidth + startWidth) : startWidth
  const normalizedEnd = endWidth === undefined
    ? totalWidth
    : endWidth < 0
    ? Math.max(0, totalWidth + endWidth)
    : endWidth

  // If start >= end, return empty string
  if (normalizedStart >= normalizedEnd) {
    return ''
  }

  // Find grapheme indices corresponding to width positions
  let currentWidth = 0
  let startIndex = 0
  let endIndex = graphemes.length
  let foundStart = false

  for (let i = 0; i < graphemes.length; i++) {
    const grapheme = graphemes[i]!
    const graphemeWidth = stringWidth(grapheme)

    // Find start index
    if (!foundStart && currentWidth >= normalizedStart) {
      startIndex = i
      foundStart = true
    }

    // Find end index
    if (currentWidth >= normalizedEnd) {
      endIndex = i
      break
    }

    currentWidth += graphemeWidth
  }

  // Handle case where start is beyond text length
  if (!foundStart) {
    return ''
  }

  return graphemes.slice(startIndex, endIndex).join('')
}
