/**
 * Pad strings to a specific width
 *
 * Handles Unicode characters, emoji, and ANSI codes correctly
 */

import { stringWidth } from '../core/width-calculator.js'
import type { PadOptions } from '../types.js'

/**
 * Default options for padding
 */
const DEFAULT_OPTIONS = {
  align: 'left' as const,
  padChar: ' ',
}

/**
 * Pad a string to fit a specified width
 *
 * @param text - String to pad
 * @param width - Target width in columns
 * @param options - Padding options
 * @returns Padded string
 *
 * @example
 * ```typescript
 * padToWidth('Hello', 10)
 * // => 'Hello     ' (left-aligned, default)
 *
 * padToWidth('Hello', 10, { align: 'right' })
 * // => '     Hello'
 *
 * padToWidth('Hello', 10, { align: 'center' })
 * // => '  Hello   '
 *
 * padToWidth('Hello', 10, { padChar: '.' })
 * // => 'Hello.....'
 *
 * padToWidth('你好', 10)
 * // => '你好      ' (CJK characters are width 2 each)
 * ```
 */
export function padToWidth(
  text: string,
  width: number,
  options?: PadOptions
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Get current width
  const currentWidth = stringWidth(text)

  // If already at or exceeds target width, return as-is
  if (currentWidth >= width) {
    return text
  }

  // Calculate padding needed
  const padWidth = width - currentWidth
  const padCharWidth = stringWidth(opts.padChar)

  // If padChar is wider than available space, can't pad properly
  if (padCharWidth === 0 || padWidth < padCharWidth) {
    return text
  }

  // Calculate number of pad characters needed
  const padCount = Math.floor(padWidth / padCharWidth)
  const padding = opts.padChar.repeat(padCount)

  switch (opts.align) {
    case 'right':
      return padding + text

    case 'center': {
      const leftPadCount = Math.floor(padCount / 2)
      const rightPadCount = padCount - leftPadCount
      const leftPad = opts.padChar.repeat(leftPadCount)
      const rightPad = opts.padChar.repeat(rightPadCount)
      return leftPad + text + rightPad
    }

    case 'left':
    default:
      return text + padding
  }
}
