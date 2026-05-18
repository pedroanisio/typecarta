# ADR 006: Criterion Numbering Scheme

## Status

**Amended 2026-05-18** — the two-tier `pi-NN` / `pi-prime-NN` distinction was
removed when the Π set was absorbed into Π′ as a `core: true`-tagged subset
(commit `379ff96`). The current decision is recorded in §**Amended Decision
(v2)** below; the v1 sections are kept verbatim for historical context.

---

## Amended Decision (v2)

Criterion identifiers are a single flat namespace:

- All 70 criteria use `pi-prime-NN` (zero-padded two-digit), `NN ∈ 01..70`.
- The TypeScript type `CriterionId` is the string literal union derived from
  the const array `CRITERION_IDS`.
- The 15-element canonical subset (formerly Π, now `Π_core`) is identified
  by a `core: true` flag on `Criterion`, **not** by a separate id namespace.
- The `pi-` / `-prime-` lexical structure is **historical, not semantic**.
  It does not denote two sets. New readers should treat the whole id string
  as opaque; tooling should not pattern-match on the `-prime-` infix.

### Why the legacy spelling persists

Renaming all 70 ids to `pi-NN` (or any other scheme) would have been a
breaking change to every test, every witness file, every scorecard
serialization that consumers may have stored. The original ADR commitment
("IDs are stable across versions; criteria are never renumbered") is
**load-bearing**, and it applies to the lexical id strings as much as to
the underlying numbering. The `-prime-` infix is the cost of having gone
through one rename already; we pay it to avoid paying it twice.

### Spec alignment

The formal specification (`spec/schema-ir-expressiveness-map.md` v2.2.0,
§8.5) defines `Π = {π_1, …, π_70}` as a single 70-criterion set with a
15-element subset `Π_core` (§9). The code now matches that shape; before
the merge it carried a parallel `PI_IDS`/`PI_PRIME_IDS` structure that the
spec stopped reifying in v2.0.0.

### What did not change

- Zero-padding (`pi-prime-01`, not `pi-prime-1`) — still required so
  lexicographic sort matches numeric order.
- Family membership remains a separate metadata field (`family: "A".."V"`),
  not encoded in the id.
- Criteria are never renumbered. Adding a new criterion appends to the
  const array; removing one is not supported within a major version.

### Renamed exports (for migrators)

| Old              | New                |
| ---              | ---                |
| `PiId`           | `CriterionId`      |
| `PiPrimeId`      | `CriterionId`      |
| `PI_IDS`         | (removed)          |
| `PI_PRIME_IDS`   | `CRITERION_IDS`    |
| `PI_CRITERIA`    | (removed)          |
| `PI_PRIME_CRITERIA` | `CRITERIA`      |
| `PiPrimeCriterion` / `CriterionPredicate` | `Criterion` |
| `pi-01..pi-15`   | (removed; see `core: true` flag on `Criterion`) |

---

## v1 — Original Decision (superseded)

> The sections below describe the *original* two-tier numbering and are
> retained for historical context. Do not rely on them for current code.

### Context (v1)

The framework defines 15 base criteria (Π) and 70 expanded criteria (Π'). These need stable, unambiguous identifiers for scorecards, tests, and documentation.

### Decision (v1)

- Base criteria use `pi-01` through `pi-15` (zero-padded two-digit)
- Expanded criteria use `pi-prime-01` through `pi-prime-70` (zero-padded two-digit)
- TypeScript types `PiId` and `PiPrimeId` are string literal unions derived from const arrays

### Rationale (v1)

- Zero-padding ensures lexicographic sort matches numeric order
- The `pi-` / `pi-prime-` prefix distinguishes the two sets unambiguously
- String literal types provide compile-time safety — invalid IDs are caught by TypeScript
- Const arrays (`PI_IDS`, `PI_PRIME_IDS`) serve as both runtime registries and type sources

### Alternatives Considered (v1)

- **Numeric IDs** — Lose the namespace prefix; easier to confuse π₅ with π'₅
- **Hierarchical IDs** (`pi.01`, `pi-prime.A.01`) — More expressive but harder to parse and sort
- **UUID-based** — Stable across renames but opaque; criterion numbers carry semantic meaning

### Consequences (v1)

- Adding new criteria requires appending to the const array and updating the count
- IDs are stable across versions; criteria are never renumbered
- The family grouping for Π' is a separate metadata field (`family: "A"` .. `"V"`), not baked into the ID
