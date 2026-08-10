/**
 * Unicode 16 extended grapheme cluster segmentation (UAX #29).
 *
 * The implementation uses the generated Unicode 16 properties in this
 * package, so behavior does not vary with the host's ICU version.
 */

import {
  getGraphemeBreakProperty,
  getIndicConjunctBreak,
  isExtendedPictographic,
  type GraphemeBreakProperty,
  type IndicConjunctBreak,
} from './unicode-data.js'

export interface GraphemeRange {
  readonly index: number
  readonly end: number
}

export interface GraphemeSegment extends GraphemeRange {
  readonly segment: string
}

interface CodePointInfo {
  readonly start: number
  readonly end: number
  readonly graphemeBreak: GraphemeBreakProperty
  readonly indicConjunctBreak: IndicConjunctBreak
  readonly extendedPictographic: boolean
  readonly zwjAfterExtendedPictographic: boolean
}

interface SegmentationState {
  /** Consecutive regional indicators ending at the previous code point. */
  regionalIndicatorCount: number
  /** GB9c state: 0 none, 1 consonant, 2 consonant followed by a linker. */
  indicConjunctState: 0 | 1 | 2
  /** Whether the last non-Extend code point was Extended_Pictographic. */
  extendedPictographicBeforeExtends: boolean
}

function getCodePointInfo(
  text: string,
  start: number,
  state: SegmentationState
): CodePointInfo {
  const codePoint = text.codePointAt(start)!
  const graphemeBreak = getGraphemeBreakProperty(codePoint)
  return {
    start,
    end: start + (codePoint > 0xffff ? 2 : 1),
    graphemeBreak,
    indicConjunctBreak: getIndicConjunctBreak(codePoint),
    extendedPictographic: isExtendedPictographic(codePoint),
    zwjAfterExtendedPictographic:
      graphemeBreak === 'ZWJ' && state.extendedPictographicBeforeExtends,
  }
}

function isBreakControl(property: GraphemeBreakProperty): boolean {
  return property === 'CR' || property === 'LF' || property === 'Control'
}

function matchesIndicConjunctRule(
  current: CodePointInfo,
  state: SegmentationState
): boolean {
  return (
    current.indicConjunctBreak === 'Consonant' &&
    state.indicConjunctState === 2
  )
}

function matchesExtendedPictographicRule(
  previous: CodePointInfo,
  current: CodePointInfo
): boolean {
  return (
    current.extendedPictographic &&
    previous.graphemeBreak === 'ZWJ' &&
    previous.zwjAfterExtendedPictographic
  )
}

function hasOddRegionalIndicatorRun(
  previous: CodePointInfo,
  current: CodePointInfo,
  state: SegmentationState
): boolean {
  return (
    current.graphemeBreak === 'Regional_Indicator' &&
    previous.graphemeBreak === 'Regional_Indicator' &&
    state.regionalIndicatorCount % 2 === 1
  )
}

function shouldBreak(
  previousPoint: CodePointInfo,
  currentPoint: CodePointInfo,
  state: SegmentationState
): boolean {
  const previous = previousPoint.graphemeBreak
  const current = currentPoint.graphemeBreak

  // GB3
  if (previous === 'CR' && current === 'LF') return false

  // GB4 and GB5
  if (isBreakControl(previous) || isBreakControl(current)) return true

  // GB6, GB7, and GB8 (Hangul syllable sequences)
  if (
    previous === 'L' &&
    (current === 'L' ||
      current === 'V' ||
      current === 'LV' ||
      current === 'LVT')
  ) {
    return false
  }
  if (
    (previous === 'LV' || previous === 'V') &&
    (current === 'V' || current === 'T')
  ) {
    return false
  }
  if ((previous === 'LVT' || previous === 'T') && current === 'T') return false

  // GB9, GB9a, and GB9b
  if (current === 'Extend' || current === 'ZWJ') return false
  if (current === 'SpacingMark') return false
  if (previous === 'Prepend') return false

  // GB9c (Indic conjuncts)
  if (matchesIndicConjunctRule(currentPoint, state)) return false

  // GB11 (extended pictographic ZWJ sequences)
  if (matchesExtendedPictographicRule(previousPoint, currentPoint)) return false

  // GB12 and GB13 (regional-indicator pairs)
  if (hasOddRegionalIndicatorRun(previousPoint, currentPoint, state)) return false

  // GB999
  return true
}

function advanceState(point: CodePointInfo, state: SegmentationState): void {
  state.regionalIndicatorCount =
    point.graphemeBreak === 'Regional_Indicator'
      ? state.regionalIndicatorCount + 1
      : 0

  if (point.indicConjunctBreak === 'Consonant') {
    state.indicConjunctState = 1
  } else if (point.indicConjunctBreak === 'Linker') {
    state.indicConjunctState = state.indicConjunctState === 0 ? 0 : 2
  } else if (point.indicConjunctBreak !== 'Extend') {
    state.indicConjunctState = 0
  }

  if (point.graphemeBreak !== 'Extend') {
    state.extendedPictographicBeforeExtends = point.extendedPictographic
  }
}

export class GraphemeIterator implements Iterable<string> {
  readonly #text: string

  constructor(text: string) {
    this.#text = text
  }

  *ranges(): IterableIterator<GraphemeRange> {
    if (this.#text.length === 0) return

    const state: SegmentationState = {
      regionalIndicatorCount: 0,
      indicConjunctState: 0,
      extendedPictographicBeforeExtends: false,
    }
    let segmentStart = 0
    let previous = getCodePointInfo(this.#text, 0, state)
    advanceState(previous, state)

    while (previous.end < this.#text.length) {
      const current = getCodePointInfo(this.#text, previous.end, state)
      if (shouldBreak(previous, current, state)) {
        yield {
          index: segmentStart,
          end: current.start,
        }
        segmentStart = current.start
      }

      advanceState(current, state)
      previous = current
    }

    yield {
      index: segmentStart,
      end: this.#text.length,
    }
  }

  *segments(): IterableIterator<GraphemeSegment> {
    for (const range of this.ranges()) {
      yield {
        segment: this.#text.slice(range.index, range.end),
        index: range.index,
        end: range.end,
      }
    }
  }

  *[Symbol.iterator](): Iterator<string> {
    for (const segment of this.segments()) {
      yield segment.segment
    }
  }

  toArray(): string[] {
    return Array.from(this)
  }

  count(): number {
    let count = 0
    for (const _ of this) count++
    return count
  }

  at(index: number): string | undefined {
    if (!Number.isInteger(index) || index < 0) return undefined

    let current = 0
    for (const grapheme of this) {
      if (current === index) return grapheme
      current++
    }
    return undefined
  }
}
