# ADR 003: Sampling vs Exact Extension Comparison

## Status

Accepted

## Context

Encoding-check properties (ρ_W, ρ_D, ρ_G) require comparing extensions of encoded types. For finite value domains this can be done exactly, but real type extensions are often infinite.

## Decision

Provide both strategies in `@typecarta/encoding-check`:

1. **Exact** (`strategies/exact.ts`) — Enumerates a provided value set and compares point-by-point. Used when the domain is finite or a representative sample is known.

2. **Sampling** (`strategies/sampling.ts`) — Generates random values from a seeded RNG across common types (null, boolean, integer, float, string, array, object) and checks extension membership. Returns an approximate result with a confidence score.

## Rationale

- Exact comparison is sound and complete for the provided value set, but limited by the caller's ability to enumerate relevant values.
- Sampling trades completeness for scalability — it can catch most violations with high probability without requiring domain expertise.
- The seeded RNG ensures reproducibility: same seed → same samples → same result.

## Alternatives Considered

- **Only exact** — Impractical for infinite domains; pushes complexity onto the caller.
- **Only sampling** — Misses deterministic use cases where exact answers are needed.
- **SMT-based** — Sound and complete but requires an SMT solver dependency; out of scope for the zero-dependency core.

## Consequences

- Sampling results include a `confidence` score; consumers must decide their threshold
- The default seed (42) ensures CI reproducibility
- Users can increase `samplesPerType` for higher confidence at the cost of runtime
