/**
 * Split strings by visual width
 *
 * Handles Unicode characters, emoji, and ANSI codes correctly
 */

import { stringWidth } from '../core/width-calculator.js'
import { GraphemeIterator } from '../core/grapheme-iterator.js'
import type { SplitOptions } from '../types.js'

/**
 * Default options for splitting
 */
const DEFAULT_OPTIONS = {
  preferSplitOnSpace: true,
  preserveWhitespace: false,
}

/**
 * Split a string into chunks that fit within a specified width
 *
 * @param text - String to split
 * @param maxWidth - Maximum width per chunk
 * @param options - Split options
 * @returns Array of strings, each fitting within maxWidth
 *
 * @example
 * ```typescript
 * splitByWidth('Hello World', 5)
 * // => ['Hello', 'World']
 *
 * splitByWidth('Hello World', 7)
 * // => ['Hello', 'World']
 *
 * splitByWidth('Hello World', 8)
 * // => ['Hello', 'World']
 *
 * splitByWidth('Hello World', 20)
 * // => ['Hello World']
 *
 * splitByWidth('你好世界测试', 8)
 * // => ['你好世界', '测试'] (CJK characters are width 2 each)
 *
 * splitByWidth('HelloWorld', 5, { preferSplitOnSpace: false })
 * // => ['Hello', 'World']
 * ```
 */
export function splitByWidth(
  text: string,
  maxWidth: number,
  options?: SplitOptions
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Handle empty string or invalid width
  if (!text || maxWidth <= 0) {
    return text ? [text] : []
  }

  // If text fits within maxWidth, return as single chunk
  if (stringWidth(text) <= maxWidth) {
    return [text]
  }

  const result: string[] = []
  const graphemes = new GraphemeIterator(text).toArray()
  let currentChunk: string[] = []
  let currentWidth = 0

  for (let i = 0; i < graphemes.length; i++) {
    const grapheme = graphemes[i]!
    const graphemeWidth = stringWidth(grapheme)

    // Check if adding this grapheme would exceed maxWidth
    if (currentWidth + graphemeWidth > maxWidth && currentChunk.length > 0) {
      // If the grapheme causing overflow is a space, push current chunk
      if (grapheme === ' ') {
        const chunk = opts.preserveWhitespace ? currentChunk.join('') : currentChunk.join('').trim()
        if (chunk.length > 0) {
          result.push(chunk)
        }
        // If preserving whitespace, start new chunk with the space; otherwise skip it
        if (opts.preserveWhitespace) {
          currentChunk = [grapheme]
          currentWidth = graphemeWidth
        } else {
          currentChunk = []
          currentWidth = 0
        }
        continue
      }

      // Try to split on space if preferred
      if (opts.preferSplitOnSpace) {
        const lastSpaceIndex = currentChunk.lastIndexOf(' ')

        if (lastSpaceIndex >= 0) {
          // Split at last space
          const beforeSpace = currentChunk.slice(0, lastSpaceIndex)
          const afterSpace = currentChunk.slice(lastSpaceIndex + 1)

          // Add chunk before space (trimmed if not preserving whitespace)
          const beforeChunk = beforeSpace.join('')
          const trimmedBefore = opts.preserveWhitespace ? beforeChunk : beforeChunk.trim()
          if (trimmedBefore.length > 0) {
            result.push(trimmedBefore)
          }

          // Start new chunk with content after space plus current grapheme
          currentChunk = [...afterSpace, grapheme]
          currentWidth = stringWidth(currentChunk.join(''))
          continue
        }
      }

      // No space found or not preferring space split, just split here
      const chunk = opts.preserveWhitespace ? currentChunk.join('') : currentChunk.join('').trim()
      if (chunk.length > 0) {
        result.push(chunk)
      }

      currentChunk = [grapheme]
      currentWidth = graphemeWidth
    } else {
      // Add grapheme to current chunk
      currentChunk.push(grapheme)
      currentWidth += graphemeWidth
    }
  }

  // Add remaining chunk
  if (currentChunk.length > 0) {
    const chunk = opts.preserveWhitespace ? currentChunk.join('') : currentChunk.join('').trim()
    if (chunk.length > 0) {
      result.push(chunk)
    }
  }

  return result
}
