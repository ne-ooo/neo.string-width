import { AnsiType, parse, type AnsiSequence } from '@lpm.dev/neo.ansi'
import type { StringWidthOptions } from '../types.js'
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

interface PositionedSequence {
  readonly offset: number
  readonly sequence: AnsiSequence
}

interface SgrNode {
  readonly raw: string
  readonly previous: SgrNode | undefined
  readonly totalLength: number
}

class TerminalState {
  #sgr: SgrNode | undefined
  #hyperlink: string | undefined

  apply(sequence: AnsiSequence): void {
    if (sequence.type === AnsiType.CSI && sequence.final === 'm') {
      this.#applySgr(sequence)
      return
    }

    if (sequence.type === AnsiType.OSC) {
      const hyperlink = getOsc8Hyperlink(sequence.raw)
      if (hyperlink !== undefined) this.#hyperlink = hyperlink || undefined
    }
  }

  prefix(): string {
    if (this.#sgr === undefined) return this.#hyperlink ?? ''

    const sequences: string[] = []
    for (let node: SgrNode | undefined = this.#sgr; node; node = node.previous) {
      sequences.push(node.raw)
    }
    sequences.reverse()
    return (this.#hyperlink ?? '') + sequences.join('')
  }

  suffix(): string {
    let suffix = ''
    if (this.#hyperlink !== undefined) suffix += '\x1b]8;;\x1b\\'
    if (this.#sgr !== undefined) suffix += '\x1b[0m'
    return suffix
  }

  prefixLength(): number {
    return (this.#hyperlink?.length ?? 0) + (this.#sgr?.totalLength ?? 0)
  }

  suffixLength(): number {
    return (this.#hyperlink === undefined ? 0 : 7) +
      (this.#sgr === undefined ? 0 : 4)
  }

  clone(): TerminalState {
    const state = new TerminalState()
    state.#sgr = this.#sgr
    state.#hyperlink = this.#hyperlink
    return state
  }

  #applySgr(sequence: AnsiSequence): void {
    const parameters = sequence.params ?? []
    let lastReset = parameters.length === 0 ? 0 : -1

    for (let index = 0; index < parameters.length; index++) {
      const firstSubparameter = parameters[index]!.split(':', 1)[0]!
      if (firstSubparameter === '' || Number.parseInt(firstSubparameter, 10) === 0) {
        lastReset = index
      }
    }

    if (lastReset < 0) {
      this.#sgr = {
        raw: sequence.raw,
        previous: this.#sgr,
        totalLength: sequence.raw.length + (this.#sgr?.totalLength ?? 0),
      }
      return
    }

    this.#sgr = undefined
    const hasStateAfterReset = parameters
      .slice(lastReset + 1)
      .some((parameter) => {
        const value = parameter.split(':', 1)[0]!
        return value !== '' && Number.parseInt(value, 10) !== 0
      })
    if (hasStateAfterReset) {
      this.#sgr = {
        raw: sequence.raw,
        previous: undefined,
        totalLength: sequence.raw.length,
      }
    }
  }
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

function positionSequences(text: string): {
  plainText: string
  positioned: PositionedSequence[]
} {
  const parsed = parse(text)
  if (parsed.sequences.length === 0) return { plainText: text, positioned: [] }

  const positioned: PositionedSequence[] = []
  const plainParts: string[] = []
  let originalOffset = 0
  let plainOffset = 0

  for (const sequence of parsed.sequences) {
    const before = text.slice(originalOffset, sequence.start)
    plainParts.push(before)
    plainOffset += before.length
    positioned.push({ offset: plainOffset, sequence })
    originalOffset = sequence.end
  }
  plainParts.push(text.slice(originalOffset))

  return { plainText: plainParts.join(''), positioned }
}

export class TokenizedText {
  readonly tokens: readonly WidthToken[]
  readonly width: number
  readonly options: ResolvedStringWidthOptions
  readonly #states: readonly TerminalState[]
  readonly #cumulativeWidths: readonly number[]

  constructor(text: string, options?: StringWidthOptions) {
    this.options = resolveStringWidthOptions(options)
    this.tokens = tokenize(text, this.options)

    const states: TerminalState[] = []
    const cumulativeWidths = [0]
    let state = new TerminalState()
    states.push(state.clone())
    for (const token of this.tokens) {
      for (const sequence of token.sequences) state.apply(sequence)
      states.push(state.clone())
      cumulativeWidths.push(
        cumulativeWidths[cumulativeWidths.length - 1]! + token.width
      )
    }
    this.#states = states
    this.#cumulativeWidths = cumulativeWidths
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

  rangeWidth(start = 0, end = this.tokens.length): number {
    return this.#cumulativeWidths[end]! - this.#cumulativeWidths[start]!
  }
}

function tokenize(
  text: string,
  options: ResolvedStringWidthOptions
): WidthToken[] {
  const { plainText, positioned } = positionSequences(text)
  const tokens: WidthToken[] = []
  let sequenceIndex = 0

  for (const grapheme of new GraphemeIterator(plainText).segments()) {
    while (
      sequenceIndex < positioned.length &&
      positioned[sequenceIndex]!.offset <= grapheme.index
    ) {
      const sequence = positioned[sequenceIndex]!.sequence
      tokens.push({
        raw: sequence.raw,
        plain: '',
        width: options.countAnsiEscapeCodes ? sequence.raw.length : 0,
        sequences: [sequence],
        ansiOnly: true,
      })
      sequenceIndex++
    }

    const embedded: AnsiSequence[] = []
    const rawParts: string[] = []
    let plainOffset = grapheme.index
    let ansiWidth = 0

    while (
      sequenceIndex < positioned.length &&
      positioned[sequenceIndex]!.offset < grapheme.end
    ) {
      const positionedSequence = positioned[sequenceIndex]!
      rawParts.push(plainText.slice(plainOffset, positionedSequence.offset))
      rawParts.push(positionedSequence.sequence.raw)
      plainOffset = positionedSequence.offset
      embedded.push(positionedSequence.sequence)
      if (options.countAnsiEscapeCodes) {
        ansiWidth += positionedSequence.sequence.raw.length
      }
      sequenceIndex++
    }
    rawParts.push(plainText.slice(plainOffset, grapheme.end))

    tokens.push({
      raw: rawParts.join(''),
      plain: grapheme.segment,
      width: getGraphemeWidth(grapheme.segment, options) + ansiWidth,
      sequences: embedded,
      ansiOnly: false,
    })
  }

  while (sequenceIndex < positioned.length) {
    const sequence = positioned[sequenceIndex]!.sequence
    tokens.push({
      raw: sequence.raw,
      plain: '',
      width: options.countAnsiEscapeCodes ? sequence.raw.length : 0,
      sequences: [sequence],
      ansiOnly: true,
    })
    sequenceIndex++
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
