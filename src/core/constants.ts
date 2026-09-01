/** Unicode 16 helpers used by width calculation. */

import {
  EMOJI_PRESENTATION_RANGES,
  MARK_RANGES,
  isControl,
  isDefaultIgnorable,
  isEmojiModifier,
  isEmojiPresentation,
  isExtendedPictographic,
  isFormat,
  isNonSpacingMark,
} from './unicode-data.js'

class FrozenNumberSet implements ReadonlySet<number> {
  readonly [Symbol.toStringTag] = 'Set'
  readonly #values: readonly number[]

  constructor(values: number[]) {
    this.#values = Object.freeze(values)
  }

  get size(): number {
    return this.#values.length
  }

  has(value: number): boolean {
    for (let index = 0; index < this.#values.length; index++) {
      if (this.#values[index] === value) return true
    }
    return false
  }

  *entries(): SetIterator<[number, number]> {
    for (let index = 0; index < this.#values.length; index++) {
      const value = this.#values[index]!
      yield [value, value]
    }
  }

  *keys(): SetIterator<number> {
    for (let index = 0; index < this.#values.length; index++) {
      yield this.#values[index]!
    }
  }

  *values(): SetIterator<number> {
    for (let index = 0; index < this.#values.length; index++) {
      yield this.#values[index]!
    }
  }

  *[Symbol.iterator](): SetIterator<number> {
    for (let index = 0; index < this.#values.length; index++) {
      yield this.#values[index]!
    }
  }

  forEach(
    callback: (value: number, key: number, set: ReadonlySet<number>) => void,
    thisArgument?: unknown
  ): void {
    for (let index = 0; index < this.#values.length; index++) {
      const value = this.#values[index]!
      callback.call(thisArgument, value, value, this)
    }
  }
}

Object.freeze(FrozenNumberSet.prototype)

export const ZERO_WIDTH_CHARS: ReadonlySet<number> = Object.freeze(
  new FrozenNumberSet([
  0x200b, // Zero Width Space
  0x200c, // Zero Width Non-Joiner
  0x200d, // Zero Width Joiner
  0x2060, // Word Joiner
  0xfeff, // Zero Width No-Break Space (BOM)
  ])
)

type PublicRange = readonly [number, number]

function frozenRangeCopy(ranges: readonly PublicRange[]): readonly PublicRange[] {
  return Object.freeze(
    ranges.map(([start, end]) => Object.freeze([start, end] as const))
  )
}

/** Full Unicode 16 Mark ranges, retained under the original public name. */
export const COMBINING_MARK_RANGES = frozenRangeCopy(MARK_RANGES)

/** Unicode 16 characters with default emoji presentation. */
export const EMOJI_RANGES = frozenRangeCopy(EMOJI_PRESENTATION_RANGES)

export const VARIATION_SELECTOR_TEXT = 0xfe0e
export const VARIATION_SELECTOR_EMOJI = 0xfe0f
const COMBINING_ENCLOSING_KEYCAP = 0x20e3
const MAX_ANSI_SEQUENCE_INTRODUCERS = 128
const MAX_CSI_PARAMETER_BYTES = 4096
const MAX_CSI_SEPARATORS = 256
const MAX_TOTAL_CSI_PARAMETER_BYTES = 65_536
const MAX_TOTAL_CSI_SEPARATORS = 4096

export function assertSafeAnsiSequenceCount(count: number): void {
  if (count > MAX_ANSI_SEQUENCE_INTRODUCERS) {
    throw new RangeError('input contains too many ANSI sequence introducers')
  }
}

function controlStringContentStart(
  text: string,
  index: number,
  code: number
): { readonly start: number; readonly osc: boolean } | undefined {
  if (code === 0x1b) {
    const next = text.charCodeAt(index + 1)
    if (
      next === 0x50 ||
      next === 0x58 ||
      next === 0x5d ||
      next === 0x5e ||
      next === 0x5f
    ) {
      return { start: index + 2, osc: next === 0x5d }
    }
    return undefined
  }
  if (
    code === 0x90 ||
    code === 0x98 ||
    code === 0x9d ||
    code === 0x9e ||
    code === 0x9f
  ) {
    return { start: index + 1, osc: code === 0x9d }
  }
  return undefined
}

function assertSafeControlString(
  text: string,
  start: number,
  osc: boolean
): number {
  for (let index = start; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (osc && code === 0x07) return index
    if (code === 0x9c) return index
    if (code === 0x1b && text.charCodeAt(index + 1) === 0x5c) {
      return index + 1
    }
    if (
      code === 0x18 ||
      code === 0x1a ||
      code === 0x1b ||
      (code >= 0x80 && code <= 0x9f)
    ) {
      throw new RangeError(
        'ANSI control string contains an unsafe cancellation sequence'
      )
    }
  }
  return text.length - 1
}

/** Reject ANSI shapes that make parsers allocate far beyond the input size. */
export function assertSafeAnsiInput(text: string): void {
  let introducerCount = 0
  let totalParameterBytes = 0
  let totalSeparators = 0

  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    const csiStart =
      code === 0x9b
        ? index + 1
        : code === 0x1b && text.charCodeAt(index + 1) === 0x5b
          ? index + 2
          : -1
    const controlString = controlStringContentStart(text, index, code)
    if (
      code === 0x1b ||
      code === 0x90 ||
      code === 0x98 ||
      (code >= 0x9b && code <= 0x9f)
    ) {
      introducerCount++
      assertSafeAnsiSequenceCount(introducerCount)
    }
    if (controlString) {
      index = assertSafeControlString(
        text,
        controlString.start,
        controlString.osc
      )
      continue
    }
    if (csiStart < 0) continue

    let parameterBytes = 0
    let separators = 0
    for (let cursor = csiStart; cursor < text.length; cursor++) {
      const current = text.charCodeAt(cursor)
      if (current >= 0x40 && current <= 0x7e) {
        index = cursor
        break
      }
      if (current >= 0x30 && current <= 0x3f) {
        parameterBytes++
        totalParameterBytes++
        if (current === 0x3a || current === 0x3b) {
          separators++
          totalSeparators++
        }
        if (
          parameterBytes > MAX_CSI_PARAMETER_BYTES ||
          separators > MAX_CSI_SEPARATORS ||
          totalParameterBytes > MAX_TOTAL_CSI_PARAMETER_BYTES ||
          totalSeparators > MAX_TOTAL_CSI_SEPARATORS
        ) {
          throw new RangeError('ANSI CSI parameters exceed the safe limit')
        }
        continue
      }
      if (current < 0x20 || current > 0x2f) break
    }
  }
}

export function isZeroWidth(codePoint: number): boolean {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return false
  }
  return (
    (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
    isControl(codePoint) ||
    isFormat(codePoint) ||
    isNonSpacingMark(codePoint) ||
    isDefaultIgnorable(codePoint)
  )
}

export function startsWithZeroWidth(codePoint: number | undefined): boolean {
  return codePoint !== undefined && isZeroWidth(codePoint)
}

export function isInEmojiRange(codePoint: number): boolean {
  return isEmojiPresentation(codePoint)
}

export function getEmojiPresentation(
  text: string
): 'emoji' | 'text' | null {
  let firstCodePoint: number | undefined
  let codePointCount = 0
  let allRegionalIndicators = true
  let hasTextVariationSelector = false
  let hasEmojiVariationSelector = false
  let hasKeycap = false
  let hasEmojiModifier = false
  let hasExtendedPictographic = false
  let hasZeroWidthJoiner = false

  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index)!
    firstCodePoint ??= codePoint
    codePointCount++
    allRegionalIndicators &&=
      codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff
    hasTextVariationSelector ||= codePoint === VARIATION_SELECTOR_TEXT
    hasEmojiVariationSelector ||= codePoint === VARIATION_SELECTOR_EMOJI
    hasKeycap ||= codePoint === COMBINING_ENCLOSING_KEYCAP
    hasEmojiModifier ||= isEmojiModifier(codePoint)
    hasExtendedPictographic ||= isExtendedPictographic(codePoint)
    hasZeroWidthJoiner ||= codePoint === 0x200d
    index += codePoint > 0xffff ? 2 : 1
  }

  if (firstCodePoint === undefined) return null
  if (hasTextVariationSelector) return 'text'
  if (hasEmojiVariationSelector || hasKeycap) return 'emoji'
  if (codePointCount >= 2 && allRegionalIndicators) return 'emoji'
  if (isEmojiPresentation(firstCodePoint)) return 'emoji'
  if (isExtendedPictographic(firstCodePoint) && hasEmojiModifier) return 'emoji'
  if (hasZeroWidthJoiner && hasExtendedPictographic) return 'emoji'

  return null
}

export function isAscii(codePoint: number): boolean {
  return codePoint >= 0 && codePoint < 0x80
}

export function isAsciiOnly(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    if (text.charCodeAt(index) > 0x7f) return false
  }
  return true
}

/** True only for printable ASCII; C0 controls and DEL have no fixed width. */
export function isPrintableAsciiOnly(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code < 0x20 || code > 0x7e) return false
  }
  return true
}
