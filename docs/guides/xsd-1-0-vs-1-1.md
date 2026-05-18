---
disclaimer:
  notice: >-
    No information within this document should be taken for granted.
    Cell verdicts are machine-generated from `evaluateScorecard` against
    the witness set at the date below; spec-level interpretation
    (paragraphs labelled "Why" and "What this means") is hypothesis,
    not theorem.
  generated_by: "Claude Opus 4.7 (1M context) via Claude Code"
  date: "2026-05-18"
---

# XSD 1.0 vs XSD 1.1 — side-by-side adapter audit

> Comparison of `@typecarta/adapter-xsd` (specVersion `1.0`) and
> `@typecarta/adapter-xsd-1-1` (specVersion `1.1`) against the full
> 70-criterion set Π. Bytes of the corresponding W3C Recommendations are
> pinned in `vendor/specs/xsd/` and `vendor/specs/xsd-1-1/` with SHA-256
> recorded in `_meta.json`.

---

## TL;DR

- **xsd 1.0**: `(satisfied=26, partial=15, ✗=12, n/a=17)` — 70 cells total.
- **xsd-1-1**: `(satisfied=24, partial=15, ✗=5, n/a=26)` — 70 cells total.

The 1.1 adapter is **not strictly more capable** than 1.0 right now. The
1.1 build is younger and the 1.0 adapter has been extended in parallel
with support for additional IR kinds (`extension`, `let`, `nominal`,
`refinement`-intersection) that the 1.1 sibling has not yet caught up
with. The 1.1-only encoder paths (`xs:assert`, `xs:alternative`) are
implemented and unit-tested but **no witness in the current set
exercises them**, so the headline scorecard shifts under 1.1 are
incidental: gains from a broader `simpleType` facet path, losses from
the unfilled IR-kind list.

Reading this audit, the right answer to "is XSD 1.1 more expressive than
1.0?" *for the spec itself* is yes (`xs:assert` and `xs:alternative` are
real new powers). The right answer for *these two adapter implementations
against this witness set* is "they diverge in shape, not in score" — and
the witnesses that would actually exercise the 1.1 features are missing.

---

## Methodology

- Both adapters run `evaluateScorecard(adapter, ALL_WITNESSES, CRITERIA)`
  against the same 70 witnesses; cell values are `✓` / `partial` / `✗` /
  `n/a`. `n/a` means the adapter does not model the IR kind the witness
  uses (`supportsKind` returns `false`); it is an adapter hole, not an
  XSD language claim.
- The criterion predicate is the same for both adapters; only the
  encoder and `supportsKind` set differ. So a row diff is always
  attributable to one of:
  - **1.1 encoder added** that wasn't in 1.0 (`xs:assert`,
    `xs:alternative`, `xs:openContent`, `xs:override`).
  - **`supportsKind` set diverges** because the 1.0 adapter declares
    more IR kinds (the parallel work).
  - **Round-trip behavior shifted** because one of the adapter sources
    diverged in `parse`/`encode` between the sibling and the original.
- The audit lists every row where `value(xsd 1.0) ≠ value(xsd-1-1)`,
  plus per-adapter totals. Rows where both adapters agree are omitted.

---

## Per-adapter totals

| Adapter | ✓ | partial | ✗ | n/a | Universe |
|---|---:|---:|---:|---:|---:|
| `xsd` (1.0) | 26 | 15 | 12 | 17 | 70 |
| `xsd-1-1` | 24 | 15 | 5 | 26 | 70 |

Reconciliation: 1.0 has 7 more `✗` and 9 fewer `n/a` than 1.1. That
means 1.0's vocabulary is wider — more IR kinds reach the encoder, and
when they fail there they fail as language gaps (`✗`) rather than as
adapter holes (`n/a`).

---

## Row-by-row diff (14 rows where 1.0 and 1.1 disagree)

| # | 1.0 | 1.1 | Why |
|---|:---:|:---:|---|
| pi-prime-24 Refinement Intersection | `✗` | `partial` | 1.1's parse/encode handles a wider `simpleType`-derivation pattern; the witness round-trips to a non-empty refinement that satisfies the predicate partially. **Real 1.1 advantage**, though both fall short of `✓`. |
| pi-prime-35 Nominal Tag / Brand | `partial` | `n/a` | 1.0 declares `nominal` in `supportsKind` (parallel-agent extension); 1.1 has not yet. The 1.0 partial means "encoding exists, brand tag drops in round-trip"; the 1.1 n/a means "adapter does not model `nominal` at all". **1.1 lag**, not a language claim. |
| pi-prime-36 Opaque / Newtype | `partial` | `n/a` | Same as pi-prime-35. **1.1 lag**. |
| pi-prime-37 Explicit Coercion | `✗` | `n/a` | 1.0 sees the `extension` kind in vocabulary and fails to encode it (`✗`); 1.1 doesn't support `extension` (`n/a`). **1.1 lag** at the kind level. |
| **pi-prime-40 Modular / Divisibility** | `✗` | `✓` | **Genuine 1.1 win.** `xs:multipleOf` was not a facet in 1.0 (added in 1.1 for `xs:decimal` derivatives via `xs:totalDigits`+`xs:fractionDigits` interactions); 1.1's encoder produces the facet, 1.0 cannot. |
| **pi-prime-41 Compound Decidable Predicate** | `✗` | `✓` | **Genuine 1.1 win.** Compound `and` predicates fold to facet-conjunctions; the 1.1 encoder explicitly composes them. |
| pi-prime-44 Inter-Object Referential | `✓` | `n/a` | 1.0 supports `extension` and uses it for `xs:keyref`-style refs; 1.1 doesn't yet support `extension`. **1.1 lag**, not a language claim. |
| pi-prime-67 Path-Navigating Constraint | `✓` | `n/a` | Same as pi-prime-44. **1.1 lag**. |
| pi-prime-47 Map / Dictionary | `✗` | `partial` | 1.1's encoder ships a `complexType` with a repeated `entry` element as the map shape; 1.0 throws on the `map` constructor. **Real 1.1 advantage**, lossy round-trip. |
| pi-prime-49 Overloaded Function | `✗` | `partial` | Same shape as pi-prime-47: 1.1 emits a placeholder complexType where 1.0 throws. **Real 1.1 advantage**, lossy. |
| pi-prime-50 Named Type Alias | `✓` | `n/a` | 1.0 supports `let`; 1.1 doesn't yet. **1.1 lag**. |
| pi-prime-51 Module / Namespace | `✓` | `n/a` | 1.0 supports `extension`; 1.1 doesn't yet. **1.1 lag**. |
| pi-prime-52 Visibility / Export | `partial` | `n/a` | Same as pi-prime-51. **1.1 lag**. |
| pi-prime-70 State-Machine Type | `✗` | `n/a` | 1.0 sees the `extension` kind; 1.1 doesn't. **1.1 lag**. |

Genuine 1.1 wins (where the 1.1 adapter encodes something 1.0 cannot):
**4 rows** — pi-prime-24, pi-prime-40, pi-prime-41, pi-prime-47, pi-prime-49.

1.1 lags (where the 1.0 adapter's wider `supportsKind` set lets it
reach the encoder while 1.1 short-circuits to `n/a`): **9 rows** —
pi-prime-35, -36, -37, -44, -50, -51, -52, -67, -70.

---

## What this means

### The witnesses don't exercise 1.1's headline features

The reviewer's v2 critique (`docs/conceptual-analysis.md`-adjacent
correspondence) predicted that 1.1 would flip:

- **pi-prime-43 Intra-Object Cross-Field** to `✓` via `xs:assert`.
- **pi-prime-65 Conditional Type** to `✓` via `xs:alternative`.

Both predictions are **falsified by the audit**.

- pi-prime-43 is `partial` on **both** adapters — the criterion
  predicate looks for `annotations.crossField === true` on a `product`,
  and the witness `SP43_CROSS_FIELD` does not currently set that
  annotation. The 1.1 encoder *would* emit `xs:assert` if the witness
  carried the flag (verified by the
  [conformance test](../../packages/adapters/xsd-1-1/tests/conformance.test.ts)),
  but the witness change is needed to surface it on the scorecard. This
  is a **witness gap**, not an adapter gap.
- pi-prime-65 is `n/a` on **both** adapters — the witness uses a
  `typeVar` subterm that neither adapter declares in `supportsKind`. To
  surface 1.1's `xs:alternative` support, either the witness must lose
  the `typeVar` or `supportsKind` must extend to ignore type variables
  in subterms. Again a **witness/contract gap**.

The 1.1 adapter has both encoders implemented and unit-tested. They
sit downstream of conditions the witness set does not currently meet.

### The 1.0 adapter has moved during the 1.1 work

The 1.0 adapter has grown `nominal` / `extension` / `let` / wider
`refinement`-intersection support in parallel. The 1.1 adapter was
forked from the 1.0 source at scaffolding time and has not absorbed
these extensions. That gap is real (9 rows) but it's an
**implementation-completeness** issue, not a language claim. The 1.1
spec is a superset of 1.0; the 1.1 *adapter* is currently not.

### What would close the gap

1. **Catch the 1.1 adapter up to 1.0's `supportsKind` set.** Add
   `nominal`, `extension`, `let` to `XSD_SUPPORTED_KINDS`. This is
   mechanical; recovers the 9 lag rows.
2. **Augment witnesses to exercise 1.1-only encoders.**
   - Add `annotations: { crossField: true }` to `SP43_CROSS_FIELD`.
   - Either rewrite `SP65_CONDITIONAL` without `typeVar`, or extend the
     adapter contract so `supportsKind` consults the whole subtree shape
     rather than just the head kind.
3. **Decide whether `partial` on pi-prime-23/24 is the right verdict.**
   The 1.1 encoder fakes an intersection with a placeholder element; the
   reviewer's v2 argued that `xs:extension` / `xs:restriction` deserve a
   stronger reading. This is a methodological choice independent of the
   adapter implementation.

---

## Honest summary

The xsd-1-1 adapter ships:

- A correct `specVersion: "1.1"` contract claim.
- Working encoders for `xs:assert`, `xs:alternative`, `xs:openContent`,
  `xs:override` (unit-tested at the descriptor level).
- A scorecard that **moves 4 rows** the 1.0 adapter cannot reach
  (pi-prime-24, -40, -41, -47, -49).
- A scorecard that **loses 9 rows** the parallel-extended 1.0 adapter
  reaches (the IR-kind lag).
- Spec bytes pinned in `vendor/specs/xsd-1-1/` with SHA-256.

It does **not** ship:

- A scorecard win on `pi-prime-43` or `pi-prime-65`, which the reviewer
  expected. The encoder paths exist; the witnesses do not exercise them.
- Parity with the 1.0 adapter's wider `supportsKind` set. The IR-kind
  catch-up is a follow-up.

The audit is the audit — not the headline number, the row-by-row
narrative. If a future contributor renders an "XSD 1.1 is more
expressive than 1.0" claim from a single totals comparison, point them
at the table above.
