/** Calculate terminal-column width using pinned Unicode 16 data. */

import { parse, strip } from '@lpm.dev/neo.ansi'
import type { StringWidthOptions } from '../types.js'
import {
  VARIATION_SELECTOR_EMOJI,
  VARIATION_SELECTOR_TEXT,
  isPrintableAsciiOnly,
  isZeroWidth,
} from './constants.js'
import { GraphemeIterator } from './grapheme-iterator.js'
import {
  getEastAsianWidth,
  isEmojiPresentation,
  isExtendedPictographic,
} from './unicode-data.js'

export type ResolvedStringWidthOptions = Required<StringWidthOptions>

export const DEFAULT_STRING_WIDTH_OPTIONS: ResolvedStringWidthOptions = {
  ambiguousIsNarrow: true,
  countAnsiEscapeCodes: false,
  emojiWidth: 2,
  normalize: false,
}

export function resolveStringWidthOptions(
  options?: StringWidthOptions
): ResolvedStringWidthOptions {
  return { ...DEFAULT_STRING_WIDTH_OPTIONS, ...options }
}

const SCAN_PRINTABLE_ASCII = 1
const SCAN_HAS_ANSI = 2
const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7e]*$/
const NATIVE_ASCII_SCAN_THRESHOLD = 128

/** Detect both fast-path ASCII and ANSI preprocessing in one input scan. */
function scanText(text: string): number {
  let result = SCAN_PRINTABLE_ASCII

  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code >= 0x20 && code <= 0x7e) continue

    result &= ~SCAN_PRINTABLE_ASCII
    if (
      code === 0x1b ||
      code === 0x90 ||
      code === 0x98 ||
      (code >= 0x9b && code <= 0x9f)
    ) {
      result |= SCAN_HAS_ANSI
    }
  }

  return result
}

export function stringWidth(
  text: string,
  options?: StringWidthOptions
): number {
  if (text === '' || text === null || text === undefined) return 0
  if (typeof text !== 'string') {
    throw new TypeError('text must be a string')
  }

  const resolved = resolveStringWidthOptions(options)
  if (
    text.length >= NATIVE_ASCII_SCAN_THRESHOLD &&
    PRINTABLE_ASCII_PATTERN.test(text)
  ) {
    return text.length
  }
  const scan = scanText(text)

  // The common path requires one scan and no allocation.
  if ((scan & SCAN_PRINTABLE_ASCII) !== 0) return text.length

  let processedText = text
  let ansiWidth = 0
  if ((scan & SCAN_HAS_ANSI) !== 0 && resolved.countAnsiEscapeCodes) {
    const parsed = parse(text)
    processedText = parsed.text
    for (const sequence of parsed.sequences) ansiWidth += sequence.raw.length
  } else if ((scan & SCAN_HAS_ANSI) !== 0) {
    processedText = strip(text)
  }

  if (resolved.normalize) processedText = processedText.normalize('NFC')
  if (
    (scan & SCAN_HAS_ANSI) !== 0 &&
    isPrintableAsciiOnly(processedText)
  ) {
    return ansiWidth + processedText.length
  }

  let width = ansiWidth
  for (const range of new GraphemeIterator(processedText).ranges()) {
    width += measureGrapheme(processedText, range.index, range.end, resolved)
  }
  return width
}

/** Internal single-grapheme width primitive shared by helper tokenization. */
export function getGraphemeWidth(
  grapheme: string,
  options: ResolvedStringWidthOptions
): number {
  if (grapheme === '') return 0

  const text = options.normalize ? grapheme.normalize('NFC') : grapheme
  return measureGrapheme(text, 0, text.length, options)
}

const COMBINING_ENCLOSING_KEYCAP = 0x20e3

function measureGrapheme(
  text: string,
  start: number,
  end: number,
  options: ResolvedStringWidthOptions
): number {
  let baseCodePoint: number | undefined
  let firstCodePoint: number | undefined
  let codePointCount = 0
  let allRegionalIndicators = true
  let hasTextVariationSelector = false
  let hasEmojiVariationSelector = false
  let hasKeycap = false
  let hasEmojiModifier = false
  let hasZeroWidthJoiner = false

  for (let index = start; index < end; ) {
    const codePoint = text.codePointAt(index)!
    firstCodePoint ??= codePoint
    codePointCount++
    allRegionalIndicators &&=
      codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff
    hasTextVariationSelector ||= codePoint === VARIATION_SELECTOR_TEXT
    hasEmojiVariationSelector ||= codePoint === VARIATION_SELECTOR_EMOJI
    hasKeycap ||= codePoint === COMBINING_ENCLOSING_KEYCAP
    hasEmojiModifier ||=
      codePoint >= 0x1f3fb && codePoint <= 0x1f3ff
    hasZeroWidthJoiner ||= codePoint === 0x200d
    if (baseCodePoint === undefined && !isZeroWidth(codePoint)) {
      baseCodePoint = codePoint
    }
    index += codePoint > 0xffff ? 2 : 1
  }
  if (baseCodePoint === undefined) return 0

  if (hasTextVariationSelector) return 1
  if (
    hasEmojiVariationSelector ||
    hasKeycap ||
    (codePointCount >= 2 && allRegionalIndicators) ||
    isEmojiPresentation(firstCodePoint!) ||
    (isExtendedPictographic(firstCodePoint!) && hasEmojiModifier) ||
    (hasZeroWidthJoiner &&
      rangeContainsExtendedPictographic(text, start, end))
  ) {
    return options.emojiWidth === 'auto' ? 2 : options.emojiWidth
  }

  const category = getEastAsianWidth(baseCodePoint)
  if (category === 'F' || category === 'W') return 2
  if (category === 'A') return options.ambiguousIsNarrow ? 1 : 2
  return 1
}

function rangeContainsExtendedPictographic(
  text: string,
  start: number,
  end: number
): boolean {
  for (let index = start; index < end; ) {
    const codePoint = text.codePointAt(index)!
    if (isExtendedPictographic(codePoint)) return true
    index += codePoint > 0xffff ? 2 : 1
  }
  return false
}
