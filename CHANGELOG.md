# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Security

- Upgrade Vitest and its coverage provider to 4.1.10 to remove known Vitest and Vite advisories
- Replace tsup/tsx with tsdown and the TypeScript compiler to remove vulnerable esbuild versions
- Pin direct dependencies and commit an integrity- and signature-bearing LPM lockfile
- Deny dependency lifecycle scripts, enforce strict peers, and apply a three-day release-age gate
- Restrict published LPM metadata to `.lpm/skills` so local audit and trust state cannot enter the package
- Add CI gates for frozen installs, registry signatures, vulnerability audits, and publish contents

### Fixed

- Use complete, deterministic Unicode 16 property tables and UAX #29 grapheme segmentation
- Preserve ANSI sequences atomically and balance SGR styles and OSC 8 hyperlinks in helpers
- Apply width options consistently in truncate, pad, slice, and split helpers
- Reject invalid widths and avoid partial graphemes, over-width chunks, and broken UTF-16 ellipses
- Align `SplitOptions` with the documented `preferSplitOnSpace` option

### Performance

- Stream grapheme segmentation and plain-text helper transformations
- Reuse cumulative token widths and persistent ANSI state at render boundaries
- Combine grapheme width analysis and avoid repeated full-pipeline measurements
- Replace the synthetic competitor benchmark with exact-pinned `string-width` 8.2.2 and equality guards

## [1.0.0] - 2026-03-09

### Added

- **`stringWidth(str)`** — Calculate the visual display width of a string
- **`truncate(str, maxWidth, ellipsis?)`** — Truncate string to a max visual width
- **`pad(str, width, align?, fillChar?)`** — Pad string to a target visual width
- **`slice(str, start, end?)`** — Slice string by visual width positions
- **`splitByWidth(str, maxWidth)`** — Split string into lines by visual width
- Handles Unicode 16: emoji, CJK, fullwidth, ANSI escape codes, combining marks
- Initial performance benchmark suite
- 328 comprehensive tests (99.55% coverage)
- One runtime dependency (`@lpm.dev/neo.ansi` for ANSI parsing)
- ESM + CJS dual output with TypeScript declaration files
- Tree-shakeable (`sideEffects: false`)
