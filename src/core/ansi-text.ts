import { AnsiType, parse, type AnsiSequence } from '@lpm.dev/neo.ansi'
import type { StringWidthOptions } from '../types.js'
import {
  assertSafeAnsiInput,
  assertSafeAnsiSequenceCount,
} from './constants.js'
import { GraphemeIterator } from './grapheme-iterator.js'
import {
  getGraphemeWidth,
  resolveStringWidthOptions,
  type ResolvedStringWidthOptions,
} from './width-calculator.js'

export interface WidthToken {
  readonly raw: string
  readonly plain: string
  readonly width: number
  readonly sequences: readonly AnsiSequence[]
  readonly ansiOnly: boolean
}

type SgrState = ReadonlyMap<string, readonly string[]>
const MAX_REPLAYED_SGR_PARAMETER_LENGTH = 64
const MAX_REPLAYED_HYPERLINK_LENGTH = 2048
const MAX_ANSI_OUTPUT_AMPLIFICATION = 8
const MAX_ANSI_OUTPUT_OVERHEAD = 4096
const MAX_COUNTED_ANSI_HELPER_INPUT_LENGTH = 4096
const MAX_COUNTED_ANSI_HELPER_INTRODUCERS = 128

class TerminalState {
  #sgr: SgrState = new Map()
  #sgrPrefix = ''
  #hyperlink: string | undefined
  #hyperlinkOpen = false
  #lastAppliedSequenceRaw: string | undefined
  #knownNoOpSgr = new Set<string>()

  apply(sequence: AnsiSequence): void {
    // Tracked SGR and OSC 8 operations are absolute and therefore idempotent.
    if (sequence.raw === this.#lastAppliedSequenceRaw) return
    this.#lastAppliedSequenceRaw = sequence.raw

    if (sequence.type === AnsiType.CSI && sequence.final === 'm') {
      const noOpKey = `${this.#sgrPrefix}\0${sequence.raw}`
      if (this.#knownNoOpSgr.has(noOpKey)) return
      if (!this.#applySgr(sequence) && this.#knownNoOpSgr.size < 32) {
        this.#knownNoOpSgr.add(noOpKey)
      }
      return
    }

    if (sequence.type === AnsiType.OSC) {
      const hyperlink = getOsc8Hyperlink(sequence.raw)
      if (hyperlink !== undefined) {
        this.#hyperlinkOpen = hyperlink !== ''
        this.#hyperlink =
          hyperlink.length <= MAX_REPLAYED_HYPERLINK_LENGTH
            ? hyperlink || undefined
            : undefined
      }
    }
  }

  prefix(): string {
    return (this.#hyperlink ?? '') + this.#sgrPrefix
  }

  suffix(): string {
    let suffix = ''
    if (this.#hyperlinkOpen) suffix += '\x1b]8;;\x1b\\'
    if (this.#sgrPrefix !== '') suffix += '\x1b[0m'
    return suffix
  }

  prefixLength(): number {
    return (this.#hyperlink?.length ?? 0) + this.#sgrPrefix.length
  }

  suffixLength(): number {
    return (this.#hyperlinkOpen ? 7 : 0) +
      (this.#sgrPrefix === '' ? 0 : 4)
  }

  prefixSequenceCount(): number {
    return (this.#hyperlink === undefined ? 0 : 1) +
      (this.#sgrPrefix === '' ? 0 : 1)
  }

  suffixSequenceCount(): number {
    return (this.#hyperlinkOpen ? 1 : 0) +
      (this.#sgrPrefix === '' ? 0 : 1)
  }

  clone(): TerminalState {
    const state = new TerminalState()
    state.#sgr = this.#sgr
    state.#sgrPrefix = this.#sgrPrefix
    state.#hyperlink = this.#hyperlink
    state.#hyperlinkOpen = this.#hyperlinkOpen
    state.#lastAppliedSequenceRaw = this.#lastAppliedSequenceRaw
    state.#knownNoOpSgr = this.#knownNoOpSgr
    return state
  }

  #applySgr(sequence: AnsiSequence): boolean {
    if (sequence.privateMarker || sequence.intermediateBytes) return false

    const nextSgr = applySgrParameters(this.#sgr, sequence.params ?? [])
    if (nextSgr === this.#sgr) return false
    const nextPrefix = renderSgrPrefix(nextSgr)
    if (nextPrefix === this.#sgrPrefix) return false
    this.#sgr = nextSgr
    this.#sgrPrefix = nextPrefix
    return true
  }
}

function applySgrParameters(
  current: SgrState,
  parameters: readonly string[]
): SgrState {
  let state: Map<string, readonly string[]> | undefined
  const activeState = (): SgrState => state ?? current
  const writableState = (): Map<string, readonly string[]> => {
    state ??= new Map(current)
    return state
  }
  const clearState = (): void => {
    if (activeState().size > 0) writableState().clear()
  }
  const deleteAttribute = (name: string): void => {
    if (activeState().has(name)) writableState().delete(name)
  }
  const setAttribute = (
    name: string,
    values: readonly string[]
  ): void => {
    const existing = activeState().get(name)
    if (
      existing?.length === values.length &&
      existing.every((value, index) => value === values[index])
    ) {
      return
    }
    const target = writableState()
    target.delete(name)
    target.set(name, values)
  }

  if (parameters.length === 0) {
    clearState()
    return state ?? current
  }

  for (let index = 0; index < parameters.length; index++) {
    const parameter = parameters[index]!
    const firstSubparameter = parameter.split(':', 1)[0]!
    const code = firstSubparameter === ''
      ? 0
      : Number.parseInt(firstSubparameter, 10)
    if (!Number.isFinite(code)) continue

    if (code === 0) {
      clearState()
    } else if (code === 1) {
      setAttribute('bold', [String(code)])
    } else if (code === 2) {
      setAttribute('faint', [String(code)])
    } else if (code === 22) {
      deleteAttribute('bold')
      deleteAttribute('faint')
    } else if (code === 3) {
      setAttribute('italic', [String(code)])
    } else if (code === 20) {
      setAttribute('fraktur', [String(code)])
    } else if (code === 23) {
      deleteAttribute('italic')
      deleteAttribute('fraktur')
    } else if (code === 4 || code === 21) {
      if (parameter.length <= MAX_REPLAYED_SGR_PARAMETER_LENGTH) {
        setAttribute('underline', [parameter])
      }
    } else if (code === 24) {
      deleteAttribute('underline')
    } else if (code === 5 || code === 6) {
      setAttribute('blink', [String(code)])
    } else if (code === 25) {
      deleteAttribute('blink')
    } else if (code === 7) {
      setAttribute('inverse', [String(code)])
    } else if (code === 27) {
      deleteAttribute('inverse')
    } else if (code === 8) {
      setAttribute('conceal', [String(code)])
    } else if (code === 28) {
      deleteAttribute('conceal')
    } else if (code === 9) {
      setAttribute('strike', [String(code)])
    } else if (code === 29) {
      deleteAttribute('strike')
    } else if (code === 10) {
      deleteAttribute('font')
    } else if (code >= 11 && code <= 19) {
      setAttribute('font', [String(code)])
    } else if (code === 26) {
      setAttribute('proportional', [String(code)])
    } else if (code === 50) {
      deleteAttribute('proportional')
    } else if (
      (code >= 30 && code <= 37) ||
      (code >= 90 && code <= 97)
    ) {
      setAttribute('foreground', [String(code)])
    } else if (code === 38) {
      const color = readColorParameters(parameters, index)
      if (color.parameters) {
        setAttribute('foreground', color.parameters)
      }
      index = color.end
    } else if (code === 39) {
      deleteAttribute('foreground')
    } else if (
      (code >= 40 && code <= 47) ||
      (code >= 100 && code <= 107)
    ) {
      setAttribute('background', [String(code)])
    } else if (code === 48) {
      const color = readColorParameters(parameters, index)
      if (color.parameters) {
        setAttribute('background', color.parameters)
      }
      index = color.end
    } else if (code === 49) {
      deleteAttribute('background')
    } else if (code === 51 || code === 52) {
      setAttribute('frame', [String(code)])
    } else if (code === 54) {
      deleteAttribute('frame')
    } else if (code === 53) {
      setAttribute('overline', [String(code)])
    } else if (code === 55) {
      deleteAttribute('overline')
    } else if (code === 58) {
      const color = readColorParameters(parameters, index)
      if (color.parameters) {
        setAttribute('underline-color', color.parameters)
      }
      index = color.end
    } else if (code === 59) {
      deleteAttribute('underline-color')
    } else if (code >= 60 && code <= 64) {
      setAttribute('ideogram', [String(code)])
    } else if (code === 65) {
      deleteAttribute('ideogram')
    } else if (code === 73 || code === 74) {
      setAttribute('script', [String(code)])
    } else if (code === 75) {
      deleteAttribute('script')
    }
  }

  return state ?? current
}

function readColorParameters(
  parameters: readonly string[],
  start: number
): {
  readonly parameters: readonly string[] | undefined
  readonly end: number
} {
  const first = parameters[start]!
  if (first.includes(':')) {
    return {
      parameters:
        first.length <= MAX_REPLAYED_SGR_PARAMETER_LENGTH
          ? [first]
          : undefined,
      end: start,
    }
  }

  const mode = parameters[start + 1]
  let end = start
  if (mode === '5') end = Math.min(parameters.length - 1, start + 2)
  else if (mode === '2') {
    const hasEmptyColorSpace = parameters[start + 2] === ''
    end = Math.min(parameters.length - 1, start + (hasEmptyColorSpace ? 5 : 4))
  }
  const colorParameters = parameters.slice(start, end + 1)
  return {
    parameters:
      colorParameters.join(';').length <= MAX_REPLAYED_SGR_PARAMETER_LENGTH
        ? colorParameters
        : undefined,
    end,
  }
}

function renderSgrPrefix(state: SgrState): string {
  if (state.size === 0) return ''

  const parameters: string[] = []
  for (const value of state.values()) parameters.push(...value)
  return `\x1b[${parameters.join(';')}m`
}

function getOsc8Hyperlink(raw: string): string | undefined {
  let body: string
  if (raw.startsWith('\x1b]')) body = raw.slice(2)
  else if (raw.charCodeAt(0) === 0x9d) body = raw.slice(1)
  else return undefined

  if (body.endsWith('\x1b\\')) body = body.slice(0, -2)
  else if (body.endsWith('\x07') || body.charCodeAt(body.length - 1) === 0x9c) {
    body = body.slice(0, -1)
  }

  if (!body.startsWith('8;')) return undefined
  const secondSeparator = body.indexOf(';', 2)
  if (secondSeparator < 0) return undefined
  return body.slice(secondSeparator + 1) === '' ? '' : raw
}

function parseText(text: string): {
  plainText: string
  sequences: readonly AnsiSequence[]
} {
  assertSafeAnsiInput(text)
  const parsed = parse(text)
  return {
    plainText: parsed.sequences.length === 0 ? text : parsed.text,
    sequences: parsed.sequences,
  }
}

interface TokenizationOptions {
  readonly renderLengths?: boolean
  readonly visibleTokens?: boolean
  readonly tokenWidthLimit?: number
  readonly skipZeroWidthPlain?: boolean
}

function lowerBound(values: readonly number[], target: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (values[middle]! < target) low = middle + 1
    else high = middle
  }
  return low
}

function upperBound(values: readonly number[], target: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (values[middle]! <= target) low = middle + 1
    else high = middle
  }
  return low
}

/**
 * Sparse ANSI view for helpers that can select ranges by plain-text offset.
 * State is stored per ANSI sequence rather than per grapheme.
 */
export class AnsiTextView {
  readonly plainText: string
  readonly sourceLength: number
  readonly #source: string
  readonly #sequences: readonly AnsiSequence[]
  readonly #plainOffsets: readonly number[]
  readonly #rawLengthPrefixes: readonly number[]
  readonly #prefixesAfter: readonly string[]
  readonly #suffixesAfter: readonly string[]
  readonly #prefixSequenceCountsAfter: readonly number[]
  readonly #suffixSequenceCountsAfter: readonly number[]

  constructor(text: string) {
    const parsed = parseText(text)
    this.#source = text
    this.plainText = parsed.plainText
    this.sourceLength = text.length
    this.#sequences = parsed.sequences

    const plainOffsets: number[] = []
    const rawLengthPrefixes: number[] = [0]
    const prefixesAfter: string[] = []
    const suffixesAfter: string[] = []
    const prefixSequenceCountsAfter: number[] = []
    const suffixSequenceCountsAfter: number[] = []
    let removedAnsiLength = 0
    const state = new TerminalState()
    for (const sequence of this.#sequences) {
      plainOffsets.push(sequence.start - removedAnsiLength)
      removedAnsiLength += sequence.raw.length
      rawLengthPrefixes.push(
        rawLengthPrefixes[rawLengthPrefixes.length - 1]! + sequence.raw.length
      )
      state.apply(sequence)
      prefixesAfter.push(state.prefix())
      suffixesAfter.push(state.suffix())
      prefixSequenceCountsAfter.push(state.prefixSequenceCount())
      suffixSequenceCountsAfter.push(state.suffixSequenceCount())
    }
    this.#plainOffsets = plainOffsets
    this.#rawLengthPrefixes = rawLengthPrefixes
    this.#prefixesAfter = prefixesAfter
    this.#suffixesAfter = suffixesAfter
    this.#prefixSequenceCountsAfter = prefixSequenceCountsAfter
    this.#suffixSequenceCountsAfter = suffixSequenceCountsAfter
  }

  render(
    start: number,
    end: number,
    boundaries?: {
      readonly includeStartSequences?: boolean
      readonly includeEndSequences?: boolean
    }
  ): string {
    if (start > end) return ''

    const firstSequence = boundaries?.includeStartSequences
      ? lowerBound(this.#plainOffsets, start)
      : upperBound(this.#plainOffsets, start)
    const lastSequence = boundaries?.includeEndSequences
      ? upperBound(this.#plainOffsets, end)
      : lowerBound(this.#plainOffsets, end)
    if (start === end && firstSequence >= lastSequence) return ''
    const parts = [this.#prefixAfterSequence(firstSequence - 1)]
    let plainCursor = start
    for (let index = firstSequence; index < lastSequence; index++) {
      const plainOffset = this.#plainOffsets[index]!
      parts.push(
        this.plainText.slice(plainCursor, plainOffset),
        this.#sequences[index]!.raw
      )
      plainCursor = plainOffset
    }
    parts.push(
      this.plainText.slice(plainCursor, end),
      this.#suffixAfterSequence(lastSequence - 1)
    )
    return parts.join('')
  }

  renderLength(
    start: number,
    end: number,
    boundaries?: {
      readonly includeStartSequences?: boolean
      readonly includeEndSequences?: boolean
    }
  ): number {
    if (start > end) return 0

    const firstSequence = boundaries?.includeStartSequences
      ? lowerBound(this.#plainOffsets, start)
      : upperBound(this.#plainOffsets, start)
    const lastSequence = boundaries?.includeEndSequences
      ? upperBound(this.#plainOffsets, end)
      : lowerBound(this.#plainOffsets, end)
    if (start === end && firstSequence >= lastSequence) return 0
    return (
      end - start +
      this.#rawLengthPrefixes[lastSequence]! -
      this.#rawLengthPrefixes[firstSequence]! +
      this.#prefixAfterSequence(firstSequence - 1).length +
      this.#suffixAfterSequence(lastSequence - 1).length
    )
  }

  assertSafeRender(
    start: number,
    end: number,
    boundaries?: {
      readonly includeStartSequences?: boolean
      readonly includeEndSequences?: boolean
    }
  ): void {
    if (start > end) return

    const firstSequence = boundaries?.includeStartSequences
      ? lowerBound(this.#plainOffsets, start)
      : upperBound(this.#plainOffsets, start)
    const lastSequence = boundaries?.includeEndSequences
      ? upperBound(this.#plainOffsets, end)
      : lowerBound(this.#plainOffsets, end)
    if (start === end && firstSequence >= lastSequence) return
    assertSafeAnsiSequenceCount(
      lastSequence -
        firstSequence +
        this.#prefixSequenceCountAfter(firstSequence - 1) +
        this.#suffixSequenceCountAfter(lastSequence - 1)
    )
  }

  /** Preserve the original bytes and only append the required closing state. */
  renderAll(): string {
    const suffix = this.#suffixAfterSequence(this.#suffixesAfter.length - 1)
    assertSafeAnsiExpansion(this.sourceLength, this.sourceLength + suffix.length)
    return this.#source + suffix
  }

  #prefixAfterSequence(index: number): string {
    return index < 0 ? '' : this.#prefixesAfter[index]!
  }

  #suffixAfterSequence(index: number): string {
    return index < 0 ? '' : this.#suffixesAfter[index]!
  }

  #prefixSequenceCountAfter(index: number): number {
    return index < 0 ? 0 : this.#prefixSequenceCountsAfter[index]!
  }

  #suffixSequenceCountAfter(index: number): number {
    return index < 0 ? 0 : this.#suffixSequenceCountsAfter[index]!
  }
}

export class TokenizedText {
  readonly tokens: readonly WidthToken[]
  readonly width: number
  readonly sourceLength: number
  readonly options: ResolvedStringWidthOptions
  readonly #states: readonly TerminalState[]
  readonly #cumulativeWidths: readonly number[]
  readonly #cumulativeRawLengths: readonly number[] | undefined
  readonly #cumulativeVisibleTokens: readonly number[] | undefined

  constructor(
    text: string,
    options?: StringWidthOptions,
    tokenizationOptions?: TokenizationOptions
  ) {
    this.options = resolveStringWidthOptions(options)
    this.tokens = tokenize(text, this.options, tokenizationOptions)
    this.sourceLength = text.length

    const states: TerminalState[] = []
    const cumulativeWidths = [0]
    const cumulativeRawLengths = tokenizationOptions?.renderLengths
      ? [0]
      : undefined
    const cumulativeVisibleTokens = tokenizationOptions?.visibleTokens
      ? [0]
      : undefined
    let state = new TerminalState()
    states.push(state)
    for (const token of this.tokens) {
      if (token.sequences.length > 0) {
        state = state.clone()
        for (const sequence of token.sequences) state.apply(sequence)
      }
      states.push(state)
      cumulativeWidths.push(
        cumulativeWidths[cumulativeWidths.length - 1]! + token.width
      )
      if (cumulativeRawLengths) {
        cumulativeRawLengths.push(
          cumulativeRawLengths[cumulativeRawLengths.length - 1]! +
            token.raw.length
        )
      }
      if (cumulativeVisibleTokens) {
        cumulativeVisibleTokens.push(
          cumulativeVisibleTokens[cumulativeVisibleTokens.length - 1]! +
            (token.ansiOnly ? 0 : 1)
        )
      }
    }
    this.#states = states
    this.#cumulativeWidths = cumulativeWidths
    this.#cumulativeRawLengths = cumulativeRawLengths
    this.#cumulativeVisibleTokens = cumulativeVisibleTokens
    this.width = cumulativeWidths[cumulativeWidths.length - 1]!
  }

  render(start = 0, end = this.tokens.length): string {
    if (start >= end) return ''

    let output = this.#states[start]!.prefix()
    for (let index = start; index < end; index++) {
      output += this.tokens[index]!.raw
    }
    return output + this.#states[end]!.suffix()
  }

  renderWidth(start = 0, end = this.tokens.length): number {
    if (start >= end) return 0

    const contentWidth =
      this.#cumulativeWidths[end]! - this.#cumulativeWidths[start]!
    if (!this.options.countAnsiEscapeCodes) return contentWidth

    return (
      contentWidth +
      this.#states[start]!.prefixLength() +
      this.#states[end]!.suffixLength()
    )
  }

  renderLength(start = 0, end = this.tokens.length): number {
    if (start >= end) return 0

    let contentLength = 0
    if (this.#cumulativeRawLengths) {
      contentLength =
        this.#cumulativeRawLengths[end]! - this.#cumulativeRawLengths[start]!
    } else {
      for (let index = start; index < end; index++) {
        contentLength += this.tokens[index]!.raw.length
      }
    }
    return (
      contentLength +
      this.#states[start]!.prefixLength() +
      this.#states[end]!.suffixLength()
    )
  }

  rangeWidth(start = 0, end = this.tokens.length): number {
    return this.#cumulativeWidths[end]! - this.#cumulativeWidths[start]!
  }

  hasVisibleTokens(start = 0, end = this.tokens.length): boolean {
    if (this.#cumulativeVisibleTokens) {
      return (
        this.#cumulativeVisibleTokens[end]! -
          this.#cumulativeVisibleTokens[start]! >
        0
      )
    }
    for (let index = start; index < end; index++) {
      if (!this.tokens[index]!.ansiOnly) return true
    }
    return false
  }
}

export function assertSafeAnsiExpansion(
  inputLength: number,
  outputLength: number
): void {
  const safeInputLength = Math.max(0, inputLength)
  const maximumOutputLength =
    safeInputLength >
    (Number.MAX_SAFE_INTEGER - MAX_ANSI_OUTPUT_OVERHEAD) /
      MAX_ANSI_OUTPUT_AMPLIFICATION
      ? Number.MAX_SAFE_INTEGER
      : safeInputLength * MAX_ANSI_OUTPUT_AMPLIFICATION +
        MAX_ANSI_OUTPUT_OVERHEAD
  if (!Number.isSafeInteger(outputLength) || outputLength > maximumOutputLength) {
    throw new RangeError('ANSI-balanced output exceeds the safe expansion limit')
  }
}

/** Return generated ANSI text only when it remains valid package input. */
export function finalizeAnsiOutput(text: string): string {
  assertSafeAnsiInput(text)
  return text
}

export function assertSafeCountedAnsiHelperInput(text: string): void {
  if (text.length > MAX_COUNTED_ANSI_HELPER_INPUT_LENGTH) {
    throw new RangeError(
      'counted ANSI helper input exceeds the safe length limit'
    )
  }
  assertSafeAnsiInput(text)
  if (parse(text).sequences.length > MAX_COUNTED_ANSI_HELPER_INTRODUCERS) {
    throw new RangeError(
      'counted ANSI helper input contains too many sequence introducers'
    )
  }
}

function tokenize(
  text: string,
  options: ResolvedStringWidthOptions,
  tokenizationOptions?: TokenizationOptions
): WidthToken[] {
  const { plainText, sequences } = parseText(text)
  const tokens: WidthToken[] = []
  let sequenceIndex = 0
  let removedAnsiLength = 0
  let tokenWidth = 0
  let truncated = false
  let pendingZeroStart = -1
  let pendingZeroEnd = -1
  let pendingZeroWhitespace = false
  let pendingZeroLastStart = -1

  const flushPendingZeroWidth = (): void => {
    if (pendingZeroStart < 0) return
    const pushZeroWidthRange = (start: number, end: number): void => {
      const plain = plainText.slice(start, end)
      tokens.push({
        raw: plain,
        plain,
        width: 0,
        sequences: [],
        ansiOnly: false,
      })
    }
    if (
      pendingZeroWhitespace &&
      pendingZeroLastStart > pendingZeroStart
    ) {
      pushZeroWidthRange(pendingZeroStart, pendingZeroLastStart)
      pushZeroWidthRange(pendingZeroLastStart, pendingZeroEnd)
    } else {
      pushZeroWidthRange(pendingZeroStart, pendingZeroEnd)
    }
    pendingZeroStart = -1
    pendingZeroEnd = -1
    pendingZeroLastStart = -1
  }

  graphemes: for (const grapheme of new GraphemeIterator(plainText).segments()) {
    while (sequenceIndex < sequences.length) {
      const first = sequences[sequenceIndex]!
      const groupOffset = first.start - removedAnsiLength
      if (groupOffset > grapheme.index) break

      const grouped: AnsiSequence[] = []
      let raw = ''
      let width = 0
      while (sequenceIndex < sequences.length) {
        const sequence = sequences[sequenceIndex]!
        const sequenceOffset = sequence.start - removedAnsiLength
        if (sequenceOffset !== groupOffset) break
        grouped.push(sequence)
        raw += sequence.raw
        if (options.countAnsiEscapeCodes) width += sequence.raw.length
        removedAnsiLength += sequence.raw.length
        sequenceIndex++
      }
      flushPendingZeroWidth()
      tokens.push({
        raw,
        plain: '',
        width,
        sequences: grouped,
        ansiOnly: true,
      })
      tokenWidth += width
      if (
        tokenizationOptions?.tokenWidthLimit !== undefined &&
        tokenWidth > tokenizationOptions.tokenWidthLimit
      ) {
        truncated = true
        break graphemes
      }
    }

    const embedded: AnsiSequence[] = []
    const rawParts: string[] = []
    let plainOffset = grapheme.index
    let ansiWidth = 0

    while (sequenceIndex < sequences.length) {
      const sequence = sequences[sequenceIndex]!
      const sequenceOffset = sequence.start - removedAnsiLength
      if (sequenceOffset >= grapheme.end) break

      const before = plainText.slice(plainOffset, sequenceOffset)
      if (before !== '') rawParts.push(before)
      rawParts.push(sequence.raw)
      plainOffset = sequenceOffset
      embedded.push(sequence)
      if (options.countAnsiEscapeCodes) {
        ansiWidth += sequence.raw.length
      }
      removedAnsiLength += sequence.raw.length
      sequenceIndex++
    }
    const after = plainText.slice(plainOffset, grapheme.end)
    if (after !== '') rawParts.push(after)

    const width = getGraphemeWidth(grapheme.segment, options) + ansiWidth
    if (
      tokenizationOptions?.skipZeroWidthPlain &&
      width === 0 &&
      embedded.length === 0
    ) {
      continue
    }
    if (width === 0 && embedded.length === 0) {
      const whitespace = /^\s+$/u.test(grapheme.segment)
      if (pendingZeroStart >= 0 && whitespace !== pendingZeroWhitespace) {
        flushPendingZeroWidth()
      }
      if (pendingZeroStart < 0) {
        pendingZeroStart = grapheme.index
        pendingZeroWhitespace = whitespace
      }
      if (whitespace) pendingZeroLastStart = grapheme.index
      pendingZeroEnd = grapheme.end
      continue
    }
    flushPendingZeroWidth()
    tokens.push({
      raw: embedded.length === 0 ? grapheme.segment : rawParts.join(''),
      plain: grapheme.segment,
      width,
      sequences: embedded,
      ansiOnly: false,
    })
    tokenWidth += width
    if (
      tokenizationOptions?.tokenWidthLimit !== undefined &&
      tokenWidth > tokenizationOptions.tokenWidthLimit
    ) {
      truncated = true
      break
    }
  }

  flushPendingZeroWidth()
  if (!truncated && sequenceIndex < sequences.length) {
    const trailing = sequences.slice(sequenceIndex)
    let raw = ''
    let width = 0
    for (const sequence of trailing) {
      raw += sequence.raw
      if (options.countAnsiEscapeCodes) width += sequence.raw.length
    }
    tokens.push({
      raw,
      plain: '',
      width,
      sequences: trailing,
      ansiOnly: true,
    })
  }

  return tokens
}

export function assertWidth(
  value: number,
  name: string,
  options: { allowZero: boolean; allowNegative?: boolean }
): void {
  if (!Number.isSafeInteger(value) || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite safe integer`)
  }
  if (options.allowNegative) return
  if (value < 0 || (!options.allowZero && value === 0)) {
    throw new RangeError(
      `${name} must be ${options.allowZero ? 'non-negative' : 'greater than zero'}`
    )
  }
}

export function isWhitespaceToken(token: WidthToken): boolean {
  return token.plain !== '' && /^\s+$/u.test(token.plain)
}
