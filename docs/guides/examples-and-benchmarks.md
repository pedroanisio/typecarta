# Examples and Benchmarks

This guide explains the two root-level runnable surfaces that are outside `packages/`.

## Examples

Examples are small workspace packages under `examples/*`. They are intended for learning and smoke validation:

```bash
pnpm run examples:smoke
```

Each example has a `start` script and a `smoke` script. The smoke script should exit successfully so it can be used as a repository health check.

The CI compatibility gate example has two modes:

```bash
pnpm --filter @typecarta/example-ci-compatibility-gate run start
pnpm --filter @typecarta/example-ci-compatibility-gate run start:regression
```

The default mode demonstrates a passing comparison. The regression mode intentionally exits non-zero after showing the failing gate.

## Benchmarks

Benchmarks live in the single `@typecarta/benchmarks` workspace package:

```bash
pnpm run bench:all
```

The benchmark package currently focuses on JSON Schema draft-07. It measures real adapter behavior, but over fixed corpora:

- `scorecard-perf` measures base scorecard runtime for `JsonSchemaAdapter`.
- `adapter-coverage` reports expanded criterion-family coverage.
- `encoding-fidelity` checks sampled soundness, completeness, and faithfulness.

## What These Commands Do Not Prove

`examples:smoke` proves that demos still execute. It does not prove semantic correctness.

`bench:all` proves that benchmark fixtures still execute and reports their current measurements. It does not prove exhaustive coverage, formal faithfulness, or production performance.

For regression confidence, run the normal package gates:

```bash
pnpm build
pnpm test
pnpm check
```
