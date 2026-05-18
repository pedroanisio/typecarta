# Benchmarks

The `benchmarks` package contains small command-line benchmark scripts for the TypeCarta evaluation machinery. It is a workspace package named `@typecarta/benchmarks`.

Run all benchmarks from the repository root:

```bash
pnpm run bench:all
```

Or run an individual benchmark from this directory:

```bash
pnpm run bench:scorecard
pnpm run bench:coverage
pnpm run bench:fidelity
```

## What Each Benchmark Measures

| Script | Command | Adapter | Corpus | What it means |
|---|---|---|---|---|
| `scorecard-perf` | `pnpm run bench:scorecard` | Real `JsonSchemaAdapter` | 15 base witnesses from `@typecarta/witnesses` | Wall-clock scorecard evaluation cost for the JSON Schema adapter over the fixed base witness set. |
| `adapter-coverage` | `pnpm run bench:coverage` | Real `JsonSchemaAdapter` | 70 expanded witnesses from `@typecarta/witnesses` | Criterion-family coverage over the expanded criterion set. |
| `encoding-fidelity` | `pnpm run bench:fidelity` | Real `JsonSchemaAdapter` | Hardcoded TypeTerms and sample values | Sampled soundness, completeness, and faithfulness checks over a small fixture set. |

## Limits

These scripts are benchmark fixtures, not formal proofs or broad performance claims.

- The corpora are fixed and intentionally small.
- The coverage benchmark reports whether at least one fixed witness satisfies each criterion.
- The fidelity benchmark reports results for the hardcoded `TEST_TERMS` and `TEST_VALUES` only.
- Runtime numbers depend on Node.js, local hardware, and process startup behavior.

Use package tests for regression safety. Use these benchmarks to catch rough performance changes and to inspect current adapter coverage.
