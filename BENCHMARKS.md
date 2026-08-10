# Performance Benchmarks

These results compare `@lpm.dev/neo.string-width` 1.0.0 with the real,
exact-pinned `string-width` 8.2.2 package. The benchmark checks output equality
for every comparison case before it records timing data.

## Environment

- Date: August 10, 2026
- Hardware: Apple M5 Pro
- Operating system: macOS 26.5.2 (arm64)
- Node.js: 26.5.0
- Vitest: 4.1.10
- Command: `lpm exec vitest bench --run test/benchmarks/vs-string-width.bench.ts`

Results are throughput in operations per second. Higher is better. Treat small
differences as noise and rerun the suite on the target production environment.

## Comparison with string-width 8.2.2

| Workload | neo.string-width | string-width | Relative result |
| --- | ---: | ---: | ---: |
| ASCII, short (11 characters) | 20.83M | 10.38M | 2.01x |
| ASCII, medium (43 characters) | 10.47M | 9.91M | 1.06x |
| ASCII, long (570 characters) | 4.11M | 3.38M | 1.21x |
| Chinese | 318.85k | 215.49k | 1.48x |
| Japanese | 259.24k | 201.71k | 1.29x |
| Korean | 230.28k | 174.45k | 1.32x |
| Emoji, simple | 540.80k | 393.33k | 1.37x |
| Emoji, complex graphemes | 572.23k | 563.67k | 1.02x |
| ANSI, short | 3.29M | 4.04M | 0.81x |
| ANSI, long | 663.09k | 1.13M | 0.59x |
| Mixed terminal line | 235.58k | 214.46k | 1.10x |
| All cases, batch of 110 calls | 4.25k | 3.46k | 1.23x |

The package leads this run on ASCII, CJK, simple emoji, mixed text, and the
combined batch. The complex-emoji result is effectively tied. ANSI-only input
remains slower because this package recognizes a broader ANSI grammar and uses
the pinned `@lpm.dev/neo.ansi` parser. Do not infer performance for a different
input distribution from the batch result alone.

## Optimization impact

The table below compares the internal benchmark before and after the current
performance pass on the same machine. It is not a comparison with another
package.

| Internal workload | Before | After | Improvement |
| --- | ---: | ---: | ---: |
| Width, short ASCII | 23.06M | 28.69M | 1.24x |
| Width, medium ASCII | 16.82M | 22.50M | 1.34x |
| Width, long ASCII | 690.60k | 3.19M | 4.63x |
| Width, short CJK | 1.46M | 2.94M | 2.01x |
| Width, medium CJK | 315.07k | 596.15k | 1.89x |
| Width, short emoji | 1.64M | 3.45M | 2.10x |
| Width, mixed text | 253.62k | 456.67k | 1.80x |
| ANSI truncation | 47.98k | 74.65k | 1.56x |
| Unicode slicing | 24.03k | 121.39k | 5.05x |
| Unicode splitting | 31.78k | 49.23k | 1.55x |

Command:

```bash
lpm exec vitest bench --run test/benchmarks/internal.bench.ts
```

## What changed

- Grapheme segmentation now streams code points with constant contextual state.
- Width measurement consumes grapheme ranges without allocating substrings.
- Emoji and base-width analysis share one scan of each grapheme.
- Printable ASCII and ANSI detection share preprocessing for common inputs.
- Long printable ASCII uses a native linear-time scan.
- Plain-text truncate, slice, and split paths stream graphemes. They do not
  allocate a token array for the full input.
- ANSI token ranges use cumulative widths and persistent terminal-state
  snapshots. Rendering no longer rescans every preceding token.
- Helper range checks use known token widths instead of repeatedly invoking the
  complete `stringWidth()` pipeline.

`Intl.Segmenter` is not used. Segmentation relies on the package's pinned
Unicode 16 tables, so there is no per-call segmenter to cache and results do not
vary with the host ICU version.

## Reproduction

```bash
lpm install --frozen
lpm exec vitest bench --run test/benchmarks/vs-string-width.bench.ts
lpm exec vitest bench --run test/benchmarks/internal.bench.ts
```

Vitest benchmarking is experimental and results vary with CPU load, runtime
version, power mode, and thermal state. Keep the dependency and tool versions
pinned when comparing changes.
