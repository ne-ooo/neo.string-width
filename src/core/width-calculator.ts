/** Calculate terminal-column width using pinned Unicode 16 data. */

import { parse, strip } from '@lpm.dev/neo.ansi'
import type { StringWidthOptions } from '../types.js'
import {
  VARIATION_SELECTOR_EMOJI,
  VARIATION_SELECTOR_TEXT,
  assertSafeAnsiInput,
  isPrintableAsciiOnly,
  isZeroWidth,
} from './constants.js'
import { GraphemeIterator } from './grapheme-iterator.js'
import {
  getEastAsianWidth,
  isEmoji,
  isEmojiModifierBase,
  isEmojiPresentation,
  isDefaultIgnorable,
  isExtendedPictographic,
  isNonSpacingMark,
  isSpacingMark,
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
  const emojiWidth =
    options?.emojiWidth ?? DEFAULT_STRING_WIDTH_OPTIONS.emojiWidth
  if (emojiWidth !== 1 && emojiWidth !== 2 && emojiWidth !== 'auto') {
    throw new TypeError("emojiWidth must be 1, 2, or 'auto'")
  }
  return {
    ambiguousIsNarrow:
      options?.ambiguousIsNarrow ??
      DEFAULT_STRING_WIDTH_OPTIONS.ambiguousIsNarrow,
    countAnsiEscapeCodes:
      options?.countAnsiEscapeCodes ??
      DEFAULT_STRING_WIDTH_OPTIONS.countAnsiEscapeCodes,
    emojiWidth,
    normalize: options?.normalize ?? DEFAULT_STRING_WIDTH_OPTIONS.normalize,
  }
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
    const isAnsiIntroducer =
      code === 0x1b ||
      code === 0x90 ||
      code === 0x98 ||
      (code >= 0x9b && code <= 0x9f)
    if ((result & SCAN_HAS_ANSI) === 0 && isAnsiIntroducer) {
      // Validate as soon as ANSI is discovered so an over-budget prefix does
      // not force a complete scan of an arbitrarily large plain-text tail.
      assertSafeAnsiInput(text)
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
  const initialCodePoint = text.codePointAt(start)!
  const initialEnd = start + (initialCodePoint > 0xffff ? 2 : 1)
  if (initialEnd === end) {
    if (isZeroWidth(initialCodePoint)) return 0
    if (
      !isRegionalIndicator(initialCodePoint) &&
      isEmojiPresentation(initialCodePoint)
    ) {
      return options.emojiWidth === 'auto' ? 2 : options.emojiWidth
    }
    return codePointWidth(initialCodePoint, options)
  }
  const commonDecoratedWidth = measureCommonDecoratedGrapheme(
    text,
    initialCodePoint,
    initialEnd,
    end,
    options
  )
  if (commonDecoratedWidth !== undefined) return commonDecoratedWidth
  if (
    isHangulLeadingJamo(initialCodePoint) ||
    isHangulVowelJamo(initialCodePoint) ||
    isHangulTrailingJamo(initialCodePoint) ||
    isHangulSyllable(initialCodePoint)
  ) {
    return measureHangulGrapheme(text, start, end, options)
  }

  let firstVisibleCodePoint: number | undefined
  let hangulWidth: number | undefined
  let hangulPendingLeading: number | undefined
  let hangulCanTakeTrailing = false
  let hasTextVariationSelector = false
  let hasEmojiVariationSelector = false
  let hasKeycap = false
  let hasEmojiModifier = false
  let hasZeroWidthJoiner = false
  let extendedPictographicCount = 0
  let visibleCodePointCount = 0
  let hasOtherZeroWidthCodePoint = false
  let trailingVisibleWidth = 0
  let trailingVisibleSuffixCount = 0
  let inTrailingVisibleSuffix = false
  let hasInterruptedEmojiCore = false
  let emojiCoreEnd = start

  for (let index = start; index < end; ) {
    const codePoint = text.codePointAt(index)!
    const codePointEnd = index + (codePoint > 0xffff ? 2 : 1)
    const zeroWidth = isZeroWidth(codePoint)
    const trailingVisibleCandidate =
      !zeroWidth &&
      firstVisibleCodePoint !== undefined &&
      (isSpacingMark(codePoint) ||
        (codePoint >= 0xff00 && codePoint <= 0xffef))
    if (
      inTrailingVisibleSuffix &&
      !zeroWidth &&
      !trailingVisibleCandidate
    ) {
      hasInterruptedEmojiCore = true
    }
    const belongsToEmojiCore =
      !inTrailingVisibleSuffix && !trailingVisibleCandidate
    if (belongsToEmojiCore) {
      hasTextVariationSelector ||= codePoint === VARIATION_SELECTOR_TEXT
      hasEmojiVariationSelector ||= codePoint === VARIATION_SELECTOR_EMOJI
      hasKeycap ||= codePoint === COMBINING_ENCLOSING_KEYCAP
      hasEmojiModifier ||=
        codePoint >= 0x1f3fb && codePoint <= 0x1f3ff
      hasZeroWidthJoiner ||= codePoint === 0x200d
      if (isExtendedPictographic(codePoint)) extendedPictographicCount++
    }
    if (zeroWidth) {
      if (!inTrailingVisibleSuffix) emojiCoreEnd = codePointEnd
      if (belongsToEmojiCore) {
        hasOtherZeroWidthCodePoint ||=
          codePoint !== VARIATION_SELECTOR_TEXT &&
          codePoint !== VARIATION_SELECTOR_EMOJI &&
          codePoint !== COMBINING_ENCLOSING_KEYCAP &&
          codePoint !== 0x200d &&
          !(codePoint >= 0xe0020 && codePoint <= 0xe007f)
      }
    } else {
      if (firstVisibleCodePoint === undefined) {
        firstVisibleCodePoint = codePoint
        if (isHangulLeadingJamo(codePoint)) {
          hangulWidth = 0
          hangulPendingLeading = codePoint
        } else if (isHangulSyllable(codePoint)) {
          hangulWidth = codePointWidth(codePoint, options)
          hangulCanTakeTrailing = isHangulLvSyllable(codePoint)
        } else if (
          isHangulVowelJamo(codePoint) ||
          isHangulTrailingJamo(codePoint)
        ) {
          hangulWidth = codePointWidth(codePoint, options)
        }
        emojiCoreEnd = codePointEnd
      } else {
        if (hangulWidth !== undefined) {
          if (isHangulLeadingJamo(codePoint)) {
            if (hangulPendingLeading !== undefined) {
              hangulWidth += codePointWidth(hangulPendingLeading, options)
            }
            hangulPendingLeading = codePoint
            hangulCanTakeTrailing = false
          } else if (isHangulSyllable(codePoint)) {
            if (hangulPendingLeading !== undefined) {
              hangulWidth += codePointWidth(hangulPendingLeading, options)
              hangulPendingLeading = undefined
            }
            hangulWidth += codePointWidth(codePoint, options)
            hangulCanTakeTrailing = isHangulLvSyllable(codePoint)
          } else if (isHangulVowelJamo(codePoint)) {
            if (hangulPendingLeading !== undefined) {
              hangulWidth += 2
              hangulPendingLeading = undefined
              hangulCanTakeTrailing = true
            } else {
              hangulWidth += codePointWidth(codePoint, options)
              hangulCanTakeTrailing = false
            }
          } else if (isHangulTrailingJamo(codePoint)) {
            if (hangulPendingLeading !== undefined) {
              hangulWidth += codePointWidth(hangulPendingLeading, options)
              hangulPendingLeading = undefined
            }
            if (hangulCanTakeTrailing) hangulCanTakeTrailing = false
            else hangulWidth += codePointWidth(codePoint, options)
          } else {
            if (hangulPendingLeading !== undefined) {
              hangulWidth += codePointWidth(hangulPendingLeading, options)
              hangulPendingLeading = undefined
            }
            hangulWidth += codePointWidth(codePoint, options)
            hangulCanTakeTrailing = false
          }
        }

        if (trailingVisibleCandidate) {
          trailingVisibleWidth += codePointWidth(codePoint, options)
          trailingVisibleSuffixCount++
          inTrailingVisibleSuffix = true
        } else {
          trailingVisibleSuffixCount = 0
          inTrailingVisibleSuffix = false
          emojiCoreEnd = codePointEnd
        }
      }
      visibleCodePointCount++
    }
    index = codePointEnd
  }
  if (firstVisibleCodePoint === undefined) return 0
  const emojiPresentation = isEmojiPresentation(firstVisibleCodePoint)
  const emojiCoreVisibleCodePointCount =
    visibleCodePointCount - trailingVisibleSuffixCount

  if (
    !hasTextVariationSelector &&
    (isValidEmojiVariationSequence(
      firstVisibleCodePoint,
      hasEmojiVariationSelector,
      emojiCoreVisibleCodePointCount,
      hasInterruptedEmojiCore ||
        hasKeycap ||
        hasZeroWidthJoiner ||
        hasOtherZeroWidthCodePoint
    ) ||
      (!hasInterruptedEmojiCore &&
        isValidKeycapSequence(text, start, emojiCoreEnd)) ||
      (isRegionalIndicator(firstVisibleCodePoint) &&
        !hasInterruptedEmojiCore &&
        isValidRegionalIndicatorSequence(text, start, emojiCoreEnd)) ||
      (emojiPresentation &&
        !hasInterruptedEmojiCore &&
        !isRegionalIndicator(firstVisibleCodePoint) &&
        emojiCoreVisibleCodePointCount === 1 &&
        !hasKeycap &&
        !hasZeroWidthJoiner &&
        !hasOtherZeroWidthCodePoint) ||
      (hasEmojiModifier &&
        !hasInterruptedEmojiCore &&
        isEmojiModifierBase(firstVisibleCodePoint) &&
        emojiCoreVisibleCodePointCount === 2 &&
        !hasKeycap &&
        !hasZeroWidthJoiner &&
        !hasOtherZeroWidthCodePoint) ||
      (!hasInterruptedEmojiCore &&
        hasZeroWidthJoiner &&
        extendedPictographicCount >= 2))
  ) {
    return (
      (options.emojiWidth === 'auto' ? 2 : options.emojiWidth) +
      trailingVisibleWidth
    )
  }

  if (hangulWidth !== undefined) {
    return hangulPendingLeading === undefined
      ? hangulWidth
      : hangulWidth + codePointWidth(hangulPendingLeading, options)
  }

  const baseWidth =
    !hasTextVariationSelector &&
    emojiPresentation &&
    !isRegionalIndicator(firstVisibleCodePoint)
      ? options.emojiWidth === 'auto'
        ? 2
        : options.emojiWidth
      : codePointWidth(firstVisibleCodePoint, options)
  return baseWidth + trailingVisibleWidth
}

function measureCommonDecoratedGrapheme(
  text: string,
  initialCodePoint: number,
  initialEnd: number,
  end: number,
  options: ResolvedStringWidthOptions
): number | undefined {
  const secondCodePoint = text.codePointAt(initialEnd)!
  const secondEnd = initialEnd + (secondCodePoint > 0xffff ? 2 : 1)

  if (
    secondEnd === end &&
    (secondCodePoint === VARIATION_SELECTOR_TEXT ||
      secondCodePoint === VARIATION_SELECTOR_EMOJI)
  ) {
    if (
      secondCodePoint === VARIATION_SELECTOR_EMOJI &&
      !isRegionalIndicator(initialCodePoint) &&
      isEmoji(initialCodePoint)
    ) {
      return options.emojiWidth === 'auto' ? 2 : options.emojiWidth
    }
    if (isZeroWidth(initialCodePoint)) return 0
    return codePointWidth(initialCodePoint, options)
  }

  if (
    secondEnd === end &&
    secondCodePoint >= 0x1f3fb &&
    secondCodePoint <= 0x1f3ff &&
    isEmojiModifierBase(initialCodePoint)
  ) {
    return options.emojiWidth === 'auto' ? 2 : options.emojiWidth
  }

  let onlyOrdinaryMarks = true
  for (let index = initialEnd; index < end; ) {
    const codePoint = text.codePointAt(index)!
    if (
      codePoint === VARIATION_SELECTOR_TEXT ||
      codePoint === VARIATION_SELECTOR_EMOJI ||
      codePoint === COMBINING_ENCLOSING_KEYCAP ||
      codePoint === 0x200d ||
      (!isNonSpacingMark(codePoint) && !isDefaultIgnorable(codePoint))
    ) {
      onlyOrdinaryMarks = false
      break
    }
    index += codePoint > 0xffff ? 2 : 1
  }
  if (onlyOrdinaryMarks) {
    if (initialCodePoint >= 0x20 && initialCodePoint <= 0x7e) return 1
    if (isZeroWidth(initialCodePoint)) return 0
    if (
      !isRegionalIndicator(initialCodePoint) &&
      isEmojiPresentation(initialCodePoint)
    ) {
      return options.emojiWidth === 'auto' ? 2 : options.emojiWidth
    }
    return codePointWidth(initialCodePoint, options)
  }

  if (!isExtendedPictographic(initialCodePoint)) return undefined
  let index = initialEnd
  let joined = false
  let componentCodePoint = initialCodePoint
  while (index < end) {
    let codePoint = text.codePointAt(index)!
    if (codePoint === VARIATION_SELECTOR_TEXT) return undefined
    if (codePoint === VARIATION_SELECTOR_EMOJI) {
      if (!isEmoji(componentCodePoint)) return undefined
      index++
      if (index >= end) {
        return joined
          ? options.emojiWidth === 'auto'
            ? 2
            : options.emojiWidth
          : undefined
      }
      codePoint = text.codePointAt(index)!
    }
    if (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff) {
      if (!isEmojiModifierBase(componentCodePoint)) return undefined
      index += codePoint > 0xffff ? 2 : 1
      if (index >= end) return joined
        ? options.emojiWidth === 'auto'
          ? 2
          : options.emojiWidth
        : undefined
      codePoint = text.codePointAt(index)!
    }
    if (codePoint !== 0x200d) return undefined
    index++
    if (index >= end) return undefined
    codePoint = text.codePointAt(index)!
    if (!isExtendedPictographic(codePoint)) return undefined
    componentCodePoint = codePoint
    index += codePoint > 0xffff ? 2 : 1
    joined = true
  }
  return joined
    ? options.emojiWidth === 'auto'
      ? 2
      : options.emojiWidth
    : undefined
}

function codePointWidth(
  codePoint: number,
  options: ResolvedStringWidthOptions
): number {
  const category = getEastAsianWidth(codePoint)
  if (category === 'F' || category === 'W') return 2
  if (category === 'A') return options.ambiguousIsNarrow ? 1 : 2
  return 1
}

function isRegionalIndicator(codePoint: number): boolean {
  return codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff
}

function isValidEmojiVariationSequence(
  baseCodePoint: number,
  hasEmojiVariationSelector: boolean,
  visibleCodePointCount: number,
  hasInvalidStructure: boolean
): boolean {
  return (
    hasEmojiVariationSelector &&
    visibleCodePointCount === 1 &&
    !hasInvalidStructure &&
    !isRegionalIndicator(baseCodePoint) &&
    isEmoji(baseCodePoint)
  )
}

function isValidKeycapSequence(
  text: string,
  start: number,
  end: number
): boolean {
  let index = start
  const baseCodePoint = text.codePointAt(index)!
  if (
    baseCodePoint !== 0x23 &&
    baseCodePoint !== 0x2a &&
    (baseCodePoint < 0x30 || baseCodePoint > 0x39)
  ) {
    return false
  }
  index += baseCodePoint > 0xffff ? 2 : 1

  if (text.codePointAt(index) === VARIATION_SELECTOR_EMOJI) index++
  if (text.codePointAt(index) !== COMBINING_ENCLOSING_KEYCAP) return false
  return index + 1 === end
}

function isValidRegionalIndicatorSequence(
  text: string,
  start: number,
  end: number
): boolean {
  let count = 0
  for (let index = start; index < end; ) {
    const codePoint = text.codePointAt(index)!
    if (!isRegionalIndicator(codePoint)) return false
    count++
    index += codePoint > 0xffff ? 2 : 1
  }
  return count >= 2
}

function isHangulLeadingJamo(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0xa960 && codePoint <= 0xa97c)
  )
}

function isHangulVowelJamo(codePoint: number): boolean {
  return (
    (codePoint >= 0x1160 && codePoint <= 0x11a7) ||
    (codePoint >= 0xd7b0 && codePoint <= 0xd7c6)
  )
}

function isHangulTrailingJamo(codePoint: number): boolean {
  return (
    (codePoint >= 0x11a8 && codePoint <= 0x11ff) ||
    (codePoint >= 0xd7cb && codePoint <= 0xd7fb)
  )
}

function isHangulSyllable(codePoint: number): boolean {
  return codePoint >= 0xac00 && codePoint <= 0xd7a3
}

function isHangulLvSyllable(codePoint: number): boolean {
  return isHangulSyllable(codePoint) && (codePoint - 0xac00) % 28 === 0
}

function measureHangulGrapheme(
  text: string,
  start: number,
  end: number,
  options: ResolvedStringWidthOptions
): number {
  let width = 0
  let pendingLeading: number | undefined
  let canTakeTrailing = false

  for (let index = start; index < end; ) {
    const codePoint = text.codePointAt(index)!
    index += codePoint > 0xffff ? 2 : 1

    if (isZeroWidth(codePoint)) {
      continue
    }
    if (isHangulLeadingJamo(codePoint)) {
      if (pendingLeading !== undefined) {
        width += codePointWidth(pendingLeading, options)
      }
      pendingLeading = codePoint
      canTakeTrailing = false
    } else if (isHangulSyllable(codePoint)) {
      if (pendingLeading !== undefined) {
        width += codePointWidth(pendingLeading, options)
        pendingLeading = undefined
      }
      width += codePointWidth(codePoint, options)
      canTakeTrailing = isHangulLvSyllable(codePoint)
    } else if (isHangulVowelJamo(codePoint)) {
      if (pendingLeading !== undefined) {
        width += 2
        pendingLeading = undefined
        canTakeTrailing = true
      } else {
        width += codePointWidth(codePoint, options)
        canTakeTrailing = false
      }
    } else if (isHangulTrailingJamo(codePoint)) {
      if (pendingLeading !== undefined) {
        width += codePointWidth(pendingLeading, options)
        pendingLeading = undefined
      }
      if (canTakeTrailing) canTakeTrailing = false
      else width += codePointWidth(codePoint, options)
    } else if (!isZeroWidth(codePoint)) {
      if (pendingLeading !== undefined) {
        width += codePointWidth(pendingLeading, options)
        pendingLeading = undefined
      }
      width += codePointWidth(codePoint, options)
      canTakeTrailing = false
    }
  }

  return pendingLeading === undefined
    ? width
    : width + codePointWidth(pendingLeading, options)
}
