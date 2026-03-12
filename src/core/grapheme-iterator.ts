/**
 * Grapheme cluster iterator
 *
 * Handles proper segmentation of Unicode text into grapheme clusters
 * per UAX #29 (Unicode Text Segmentation).
 *
 * Critical for:
 * - Emoji with variation selectors (👍 vs 👍🏻)
 * - ZWJ sequences (👨‍👩‍👧‍👦 = family emoji)
 * - Combining characters (é = e + ´)
 * - Regional indicator sequences (🇺🇸 = flag)
 *
 * @see https://www.unicode.org/reports/tr29/
 */

/**
 * Iterator for grapheme clusters
 *
 * Uses JavaScript's built-in Intl.Segmenter API which provides
 * native, optimized grapheme segmentation per Unicode standards.
 *
 * @example
 * ```typescript
 * const iterator = new GraphemeIterator('Hello 👨‍👩‍👧‍👦 World')
 * for (const grapheme of iterator) {
 *   console.log(grapheme)
 * }
 * // Outputs: 'H', 'e', 'l', 'l', 'o', ' ', '👨‍👩‍👧‍👦', ' ', 'W', 'o', 'r', 'l', 'd'
 * ```
 */
export class GraphemeIterator implements Iterable<string> {
  private segmenter: Intl.Segmenter
  private text: string

  constructor(text: string) {
    this.text = text
    // Use native segmenter for accurate, performant grapheme clustering
    this.segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
  }

  /**
   * Iterator implementation
   *
   * Yields each grapheme cluster as a string.
   */
  *[Symbol.iterator](): Iterator<string> {
    const segments = this.segmenter.segment(this.text)
    for (const segment of segments) {
      yield segment.segment
    }
  }

  /**
   * Get array of all grapheme clusters
   *
   * @returns Array of grapheme cluster strings
   *
   * @example
   * ```typescript
   * new GraphemeIterator('👨‍👩‍👧‍👦').toArray()
   * // => ['👨‍👩‍👧‍👦']
   * ```
   */
  toArray(): string[] {
    return Array.from(this)
  }

  /**
   * Get count of grapheme clusters
   *
   * This is the "true" character count that matches user perception.
   *
   * @returns Number of grapheme clusters
   *
   * @example
   * ```typescript
   * new GraphemeIterator('👨‍👩‍👧‍👦').count()  // => 1 (not 7!)
   * new GraphemeIterator('café').count()     // => 4
   * ```
   */
  count(): number {
    let count = 0
    for (const _ of this) {
      count++
    }
    return count
  }

  /**
   * Get grapheme at specific index
   *
   * @param index - Zero-based index
   * @returns Grapheme at index, or undefined
   *
   * @example
   * ```typescript
   * new GraphemeIterator('Hello').at(1)  // => 'e'
   * new GraphemeIterator('你好').at(0)    // => '你'
   * ```
   */
  at(index: number): string | undefined {
    let current = 0
    for (const grapheme of this) {
      if (current === index) {
        return grapheme
      }
      current++
    }
    return undefined
  }
}
