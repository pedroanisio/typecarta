# ADR 006: Criterion Numbering Scheme

## Status

Accepted

## Context

The framework defines 15 base criteria (Π) and 70 expanded criteria (Π'). These need stable, unambiguous identifiers for scorecards, tests, and documentation.

## Decision

- Base criteria use `pi-01` through `pi-15` (zero-padded two-digit)
- Expanded criteria use `pi-prime-01` through `pi-prime-70` (zero-padded two-digit)
- TypeScript types `PiId` and `PiPrimeId` are string literal unions derived from const arrays

## Rationale

- Zero-padding ensures lexicographic sort matches numeric order
- The `pi-` / `pi-prime-` prefix distinguishes the two sets unambiguously
- String literal types provide compile-time safety — invalid IDs are caught by TypeScript
- Const arrays (`PI_IDS`, `PI_PRIME_IDS`) serve as both runtime registries and type sources

## Alternatives Considered

- **Numeric IDs** — Lose the namespace prefix; easier to confuse π₅ with π'₅
- **Hierarchical IDs** (`pi.01`, `pi-prime.A.01`) — More expressive but harder to parse and sort
- **UUID-based** — Stable across renames but opaque; criterion numbers carry semantic meaning

## Consequences

- Adding new criteria requires appending to the const array and updating the count
- IDs are stable across versions; criteria are never renumbered
- The family grouping for Π' is a separate metadata field (`family: "A"` .. `"V"`), not baked into the ID
