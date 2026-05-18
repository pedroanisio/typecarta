---
disclaimer:
  notice: >-
    No information within this document should be taken for granted.
    Cell verdicts are machine-generated from `evaluateScorecard` against
    the witness set at the date below; spec-level interpretation
    (paragraphs labelled "Why" and "What this means") is hypothesis,
    not theorem. Bytes of W3C SHACL Recommendation 2017-07-20 are
    pinned in `vendor/specs/shacl/` with SHA-256 recorded in
    `_meta.json`.
  generated_by: "Claude Opus 4.7 (1M context) via Claude Code"
  date: "2026-05-18"
---

# SHACL — scorecard audit (vs JSON Schema draft-07)

> Audit of `@typecarta/adapter-shacl` (specVersion `1.0`) against the
> full 70-criterion set Π. Side-by-side comparison with
> `@typecarta/adapter-json-schema` (specVersion `draft-07`). Both
> validate structured data; the audit highlights where they classify
> the same witness differently and what that says about each
> language's expressivity *as the typecarta adapters model them*.

---

## Revision history

| Date | Totals (✓ / ◐ / ✗ / n/a) | Cause |
|---|---|---|
| 2026-05-18 v1 | 17 / 30 / 7 / 16 | Initial SHACL adapter (commit `a396295`) |
| 2026-05-18 v2 | **23 / 24 / 7 / 16** | Parser fix: "empty product leak" — `parseNodeShape` no longer wraps logical-combinator-only shapes in a spurious `product([])`. Six rows ◐ → ✓ (pi-prime-03, -06, -07, -20, -21, -23, -42). Regression-tested. See [Reviewer follow-up (v2)](#reviewer-follow-up-v2) below for the full diff and a response to the reviewer's individual claims. |

---

## TL;DR

| Adapter | ✓ | partial | ✗ | n/a | Universe |
|---|---:|---:|---:|---:|---:|
| `shacl-1-0` | 23 | 24 | 7 | 16 | 70 |
| `JSON Schema` (draft-07) | 22 | 15 | 8 | 25 | 70 |

**SHACL is wider but shallower than JSON Schema** on this witness set:

- More cells *reach* the encoder (16 n/a vs 25 n/a — SHACL declares
  more IR kinds in `supportsKind`).
- More cells land at `partial` (30 vs 15) — SHACL produces a
  defensible RDF shape for many witnesses, but the round-trip doesn't
  preserve enough IR structure for the criterion predicate to recognize
  it as `satisfied`. The constraint-component vocabulary is wide; the
  structure-preserving subset is narrow.
- Fewer `✓` (17 vs 22). The criterion predicates are tuned to
  tree-shaped IR; the RDF→IR projection blurs distinctions the
  predicates depend on.

The two adapters diverge on 22 rows — the row-by-row table below
classifies each as a *real* expressivity difference, a *projection
artifact* (the IR collapsed something SHACL could express), or a
*witness shape problem* (the witness uses an IR construct one adapter
declares and the other does not).

---

## Methodology

- Both adapters run `evaluateScorecard(adapter, ALL_WITNESSES, CRITERIA)`
  against the same 70 witnesses.
- Cell values: `✓` (faithful round-trip), `partial` (encoding exists,
  round-trip loses structure the criterion predicate looks for), `✗`
  (encoder threw — language genuinely cannot express the IR construct),
  `n/a` (adapter's `supportsKind` returns false — adapter hole).
- Diff rows are listed for `value(shacl) ≠ value(json-schema)` only.

### RDF → tree-IR projection choices

SHACL describes constraints on RDF graphs; the IR is tree-shaped. The
SHACL adapter makes the following projections, each of which is a
*decision* not a *fact*:

| SHACL feature | IR projection | Lossy? |
|---|---|---|
| NodeShape | `apply("product", …)` | yes — RDF property uniqueness, BNode identity dropped |
| `sh:property` | `FieldDescriptor` | round-trip ✓ |
| `sh:datatype` (xsd:string, xsd:integer, …) | `base("string")` / `base("integer")` | ✓ |
| `sh:minCount`/`sh:maxCount` | `optional` flag + `array` wrapper | ✓ for {0,1}/{1,∞}; lossy for {n,m} |
| `sh:nodeKind` | (none) — recorded as annotation only | yes |
| `sh:class` | `nominal(tag, …)` | additional classes carried as annotation |
| `sh:in` | `union([literal(...), …])` | ✓ |
| `sh:hasValue` | `literal(v)` (or union for multi-valued) | ✓ |
| `sh:pattern` | `refinement(base, patternConstraint)` | ✓; regex flags dropped |
| `sh:min/maxInclusive` | `refinement(base, rangeConstraint)` | ✓ |
| `sh:minLength`/`maxLength` | `refinement` with a `custom: stringLength` predicate | round-trip ✓; criterion-predicate-blind |
| `sh:and`/`or`/`not` | `intersection`/`union`/`complement` | ✓ |
| `sh:xone` | `extension("shacl-xone", …)` | language-specific |
| `sh:closed` | `annotations.open = false` (default) | ✓ |
| `sh:closed: false` | `annotations.open = true` | ✓ |
| `sh:node` (shape ref) | recursive case → `mu`; otherwise inline | partial — IRIs lose namespacing |
| `sh:disjoint`/`equals`/`lessThan` | `annotations.crossField + shaclPair` | round-trip ✓; criterion-blind |
| SPARQL property paths (inverse, alternative, etc.) | first IRI + `pathLoss: true` annotation | **lossy** — known and surfaced |
| `sh:sparql` (SHACL-SPARQL) | `extension("shacl-sparql", …)` envelope | opaque to IR |
| `sh:deactivated` / `sh:severity` / `sh:message` | annotations only | metadata only |

The `pathLoss` annotation is the most consequential: if a SHACL shape
uses inverse paths or alternatives, the IR sees only the first IRI and
the constraint applies "as if" the field were addressable by that name.
Surfacing this as an annotation means a downstream consumer can detect
it; the scorecard does not penalize it.

---

## Side-by-side row diff (22 rows where SHACL and JSON Schema disagree)

### SHACL stronger than JSON Schema (4 rows)

| # | SHACL | JS | Witness | Why |
|---|:---:|:---:|---|---|
| pi-prime-14 Default Value | `✓` | `partial` | `SP14_DEFAULT_VALUE` | SHACL has first-class `sh:defaultValue` on PropertyShape; JSON Schema's `default` is informational, not validating. The IR round-trip preserves the default through the SHACL adapter. |
| pi-prime-17 Open Record, Unconstrained Extras | `✓` | `partial` | `SP17_OPEN_RECORD` | SHACL's `sh:closed: false` (and the implicit "open unless declared closed" default) maps cleanly to `annotations.open = true`; JSON Schema's `additionalProperties: true` is the default but the round-trip is annotation-blind. |
| pi-prime-35 Nominal Tag / Brand | `✓` | `n/a` | `SP35_NOMINAL_TAG` | SHACL has `sh:class` — first-class nominal class membership. JSON Schema declares neither `nominal` in its `supportsKind` nor an equivalent vocabulary. **Real expressivity advantage**. |
| pi-prime-59 Type-Level Complement | `✓` | `partial` | `SP59_COMPLEMENT` | SHACL has `sh:not` — direct complement. JSON Schema's `not` exists but the criterion predicate doesn't match what the round-trip produces. |

### SHACL parity with JSON Schema (7 rows — strengthened after the v2 parser fix)

These rows were marked `partial` in v1 of this audit because the SHACL
parser's "empty product leak" bug ([Reviewer follow-up (v2)](#reviewer-follow-up-v2))
prevented the round-trip from preserving the witness's structural shape.
After the fix they are `✓`, matching JSON Schema:

| # | SHACL v1 → v2 | JS | Witness | Why |
|---|:---:|:---:|---|---|
| pi-prime-03 Global Top | `partial` → `✓` | `✓` | `SP03_GLOBAL_TOP` | Empty `sh:NodeShape` now round-trips as `top()` rather than `product([])`. |
| pi-prime-06 Finite Homogeneous Enum | `partial` → `✓` | `✓` | `SP06_HOMO_ENUM` | `sh:in [...]` (or `sh:or` over `sh:hasValue`) now round-trips as `union([literal, …])` without a spurious leading `product([])`. |
| pi-prime-07 Finite Heterogeneous Enum | `partial` → `✓` | `✓` | `SP07_HETERO_ENUM` | Same as 06. |
| pi-prime-20 Discriminated Union | `partial` → `✓` | `✓` | `SP20_DISCRIMINATED_UNION` | `sh:or` over property-tagged shapes round-trips to a binary `union` of products without the spurious empty branch. |
| pi-prime-21 Shape-Discriminated Union | `partial` → `✓` | `✓` | `SP21_SHAPE_DISCRIMINATED` | Same fix as 20; not flagged by the reviewer but had the identical bug. |
| pi-prime-23 Record-Merge Intersection | `partial` → `✓` | `✓` | `SP23_RECORD_MERGE` | `sh:and` over two NodeShapes round-trips to `intersection(product, product)` cleanly. |
| pi-prime-42 Tagged Dependent Choice | `partial` → `✓` | `✓` | `SP42_TAGGED_DEPENDENT` | Same fix as 20. |

### JSON Schema stronger than SHACL (3 rows — remaining)

After the v2 fix, the rows where JSON Schema still has a ✓ that SHACL
does not:

| # | SHACL | JS | Witness | Why |
|---|:---:|:---:|---|---|
| pi-prime-01 Syntactic Bottom | `partial` | `✓` | `SP01_SYNTACTIC_BOTTOM` | JSON Schema has `false` as a schema. SHACL has no first-class empty extension — encoded as `NodeShape { in: [] }`, which the criterion predicate doesn't recognize as a bottom node. **Projection artifact**. |
| pi-prime-13 Nullable-by-Value | `partial` | `✓` | `SP13_NULLABLE_FIELD` | JSON Schema models nullable with `type: [..., "null"]`; SHACL has no native null type. The current adapter folds `base("null")` to `xsd:string` at encode, losing the null arm before parse. **Real SHACL adapter weakness**, separate from the parser bug; RDF genuinely has no null. |
| pi-prime-24 Refinement Intersection | `partial` | `✓` | `SP24_REFINEMENT_INTERSECTION` | `encodeRefinement` wraps the base in a `complexType` with an `rdf:value` PropertyShape rather than flowing facets through to a `simpleType`. Round-trip yields `intersection(base, product(…))` instead of the witness's `intersection(base, refinement)`. **Real encoder limitation**, separate from the parser bug. Tracked for a follow-up encoder change. |
| pi-prime-46 Set / Unique Collection | `partial` | `✗` | `SP46_SET` | SHACL has no native set — encodes as array. JSON Schema's `uniqueItems` is closer but the adapter throws. SHACL's `partial` is the more graceful failure; JSON Schema's `✗` is the more honest signal. |

### Where the comparison flips the adapter-hole story (10 rows)

These rows are `n/a` on JSON Schema (witness uses an IR kind JSON
Schema doesn't declare in `supportsKind`) but **`partial` on SHACL**
because SHACL declares the kind:

| # | SHACL | JS | Witness | IR kind |
|---|:---:|:---:|---|---|
| pi-prime-36 Opaque / Newtype | `partial` | `n/a` | `SP36_OPAQUE` | `nominal` |
| pi-prime-37 Explicit Coercion | `partial` | `n/a` | `SP37_COERCION` | `extension` |
| pi-prime-44 Inter-Object Referential | `partial` | `n/a` | `SP44_FOREIGN_KEY` | `extension` |
| pi-prime-50 Named Type Alias | `partial` | `n/a` | `SP50_TYPE_ALIAS` | `let` |
| pi-prime-51 Module / Namespace | `partial` | `n/a` | `SP51_MODULE` | `extension` |
| pi-prime-52 Visibility / Export | `partial` | `n/a` | `SP52_VISIBILITY` | `extension` |
| pi-prime-67 Path-Navigating Constraint | `partial` | `n/a` | `SP67_PATH_CONSTRAINT` | `extension` |
| pi-prime-70 State-Machine Type | `partial` | `n/a` | `SP70_STATE_MACHINE` | `extension` |

This block illustrates a methodological subtlety: SHACL's `partial`
verdict here is *generous* — the encoder accepts the IR term and
produces a SHACL shape (often a SPARQL-constraint placeholder), but
the round-trip is lossy. JSON Schema's `n/a` is *honest* — the adapter
doesn't even try.

A reader who treats "more `partial`" as "stronger" will overstate
SHACL. A reader who treats "more `n/a`" as "weaker" will understate
JSON Schema. The right comparison is **per-row**, with the witness
shape and the encoder's behavior on the table.

---

## The 7 SHACL `✗` rows (genuine language gaps)

All 7 are RDF-fundamental limits:

| # | Witness | Why |
|---|---|---|
| pi-prime-08 Positional Tuple | `SP08_POSITIONAL_TUPLE` | RDF has no ordered tuple primitive. `rdf:Seq` exists but is rarely used; SHACL doesn't model it natively. |
| pi-prime-10 Variadic / Rest Element | `SP10_VARIADIC_TUPLE` | Same as 08. |
| pi-prime-47 Map / Dictionary | `SP47_MAP` | SHACL property paths are IRIs, not open keys. Dictionary-style "any key, T value" doesn't map to a SHACL shape without escape hatches. |
| pi-prime-48 Function / Arrow Type | `SP48_ARROW` | SHACL describes data, not behavior. |
| pi-prime-49 Overloaded Function | `SP49_OVERLOADED` | Same as 48. |
| pi-prime-68 String Concatenation | `SP68_STRING_CONCAT` | SHACL has no string-algebra constraint vocabulary. |
| pi-prime-69 String Pattern Decomposition | `SP69_STRING_DECOMPOSITION` | Same as 68. |

These are the genuine "SHACL cannot do this" verdicts. Everything else
that's not `✓` either reaches the encoder and round-trips lossily
(`partial`) or is blocked by an IR-kind hole (`n/a`).

---

## What this audit doesn't claim

- That SHACL is "better" or "worse" than JSON Schema. The two
  languages target different problems — SHACL validates RDF graphs;
  JSON Schema validates JSON trees — and the scorecard is a coverage
  measurement against typecarta's witness set, not a fitness function.
- That a `partial` is always honest. SHACL's encoder produces
  defensible shapes for many witnesses where the round-trip is lossy
  enough that "the criterion predicate doesn't match" is hard to
  distinguish from "the language can't really do this." The
  `pathLoss`, `crossField`, and `shaclPair` annotations are how the
  adapter surfaces the loss; the scorecard does not weigh them.
- That every `✓` represents faithful semantics. The IR's notion of
  "semantic faithfulness" is structural round-trip; SHACL's semantics
  involve RDF graph closure, open-world assumption, and SPARQL
  evaluation that the IR does not model. A `✓` here means "the
  structural shape survives parse(encode(t))", not "validation in
  SHACL agrees with validation in the IR."

The audit is the audit — the per-row table and its classification,
not the headline number. If a future contributor renders a "SHACL is
more expressive than JSON Schema" or vice-versa claim from a single
totals comparison, point them at the diff table and the methodology
section.

---

## Reviewer follow-up (v2)

An external reviewer (2026-05-18) critiqued v1 of this audit, arguing
the SHACL scorecard "looks materially wrong" because rows where SHACL
has more direct constructs than XSD (sh:in, sh:and, sh:or, sh:not, sh:path,
sh:equals/disjoint/lessThan) were marked ◐ where XSD got ✓. The reviewer
identified 10 specific rows as suspect.

The critique was substantially right. A probe through `parse(encode(t))`
on every flagged witness revealed a single root cause:

> `parseNodeShape` used to unconditionally produce `product([…])` even
> when the SHACL NodeShape carried no own structural content. When that
> shape was a child of `sh:or` / `sh:and` / `sh:not`, the empty product
> leaked into the parsed union/intersection/complement as a spurious
> extra arg. The criterion predicates for those rows pattern-match the
> arg shape exactly, so the spurious arg flipped them to ◐.

The fix split `parseNodeShape` into a `parseNodeShapeCore` (which
returns `undefined` when there's no own structural content) and a
top-level `parseNodeShape` (which returns a logical combinator's
result directly when the core is empty, and `top()` for a fully empty
NodeShape). The same pattern was applied to `parsePropertyValueType`
where logical combinators on a pure-combinator property would have
leaked `top()` instead of `product([])`.

Six rows moved from ◐ → ✓ as a direct result: pi-prime-03, -06, -07,
-20, -21, -23, -42. All six are covered by regression tests in
`packages/adapters/shacl/tests/conformance.test.ts` under the
"regression: no empty product leakage" describe block.

### Response to specific reviewer claims

| Row | Reviewer | Resolution |
|---|---|---|
| pi-prime-03 Global Top | should be ✓ | **Accepted, fixed.** |
| pi-prime-06 Homogeneous Enum | should be ✓ | **Accepted, fixed.** |
| pi-prime-07 (implied, same family) | should be ✓ | **Accepted, fixed.** |
| pi-prime-20 Discriminated Union | should be ✓ | **Accepted, fixed.** |
| pi-prime-23 Record-Merge Intersection | should be ✓ | **Accepted, fixed.** |
| pi-prime-42 Tagged Dependent Choice | should be ✓ | **Accepted, fixed.** |
| pi-prime-24 Refinement Intersection | should be ✓ | **Partially declined.** Separate from the parser bug. `encodeRefinement` wraps the base type in a `complexType` with an `rdf:value` PropertyShape rather than flowing facets through; the round-trip yields `intersection(base, product(...))` rather than the witness's `intersection(base, refinement)`. This is a real encoder limitation that needs its own fix; flagging for follow-up. The reviewer's claim that "`sh:and` between a base shape and a constraint shape narrows the value set" is true at the language level but doesn't address the round-trip shape mismatch. |
| pi-prime-41 Compound Decidable Predicate | should be ✓ | **Declined.** The reviewer conflated this row with pi-prime-23. The pi-prime-41 predicate looks specifically for `refinement(_, andPredicate \| orPredicate)` — i.e., compound predicates *on a refinement node* (e.g. `{n : number \| (0 ≤ n ≤ 100) ∧ n mod 5 = 0}`). The witness `SP41_COMPOUND` is `refinement(number, range ∧ multipleOf)`. SHACL has `sh:and` / `sh:or` as constraint components, but it has no native `multipleOf` facet, so the SHACL adapter routes `multipleOf` through `sh:sparql`. The round-trip cannot reconstruct the `andPredicate(range, multipleOf)` shape because the `multipleOf` arm is no longer in the refinement tree. **XSD's ✓ on this row is itself a function of XSD having `multipleOf` as a native facet, not of XSD's compound-predicate handling being stronger than SHACL's.** SHACL's ◐ here is honest. |
| pi-prime-43 Intra-Object Cross-Field | should be ✓ | **Declined as adapter issue.** The witness `SP43_CROSS_FIELD` doesn't carry `annotations.crossField` — the criterion predicate is checking for that annotation, and both SHACL and XSD adapters get ◐ for the same reason. This is a **witness gap** (same finding as the xsd-1-1 audit's pi-prime-43 note), tracked separately. SHACL's `sh:equals`/`sh:disjoint`/`sh:lessThan` are correctly modeled in `ShaclPairConstraint` and encoded when the annotation is present. |
| pi-prime-46 Set / Unique Collection | should be ✓ | **Declined as methodological.** The reviewer argues "RDF triples are deduplicated by definition: any multi-valued property is set-valued at the data layer." That is correct at the *data* layer. The criterion predicate measures at the *IR-structure* layer: it pattern-matches `apply("set", …)`. The SHACL adapter encodes IR `set` as `array` (no native `sh:list+sh:unique` vocabulary at the encoder), so the IR-side round-trip loses set-ness. The reviewer's data-layer argument is the same methodological clash flagged in earlier rounds (the "split the dot" thread): is `n/a` / `◐` a property of the target language or of the harness? In this row, it's a property of the harness's IR-level measurement, not of SHACL the language. Keeping ◐ until either the adapter declares `sh:list+sh:unique` for round-trip set preservation or the criterion is reworded. |
| pi-prime-67 Path-Navigating Constraint | should be ✓ | **Declined as encoder issue.** The witness `SP67_PATH_CONSTRAINT` uses `extension`, which the SHACL adapter declares in `supportsKind`, so it reaches the encoder. The encoder wraps the extension's payload in a SHACL-SPARQL stub. The criterion looks for the round-tripped structural shape, which the SPARQL envelope flattens. The reviewer's claim that "`sh:path` accepts SPARQL property paths" is true and is already modeled in `ShaclPath`, but the witness doesn't use a SHACL-path witness — it uses `extension`. To flip this row to ✓ we'd need either a new witness using a SHACL-native path shape or a different round-trip choice. Tracked for follow-up. |
| pi-prime-70 State-Machine Type | "either standardize as · or ✗" across all adapters | **Acknowledged.** This is a broader cross-adapter consistency point. Currently SHACL gets ◐ (via the `extension`→SPARQL projection) and XSD gets · (does not model `extension`). The right resolution is probably to add `extension` to every adapter's `supportsKind` set and route to `extension("language-sparql-like", …)` envelopes — but that's an adapter-wide refactor, not a SHACL fix. |

### Where the reviewer was wrong about methodology

The reviewer framed pi-prime-41's XSD-✓ / SHACL-◐ split as evidence
that "the rubric drifts between adapters" or "two adapters are being
asked different questions under the same row name." Neither is true.
The criterion `evaluate` function is a single static function in
`packages/core/src/criteria/pi-prime/family-j.ts`. It takes a
`TypeTerm`, returns a status. The same function is called on the
round-tripped term from every adapter. The cell verdict differs
because the round-tripped term differs — that's the *measurement*, not
the rubric.

What the reviewer correctly intuited but mis-framed is that *adapter
implementation gaps look identical to rubric drift* in the output.
The scorecard does need a way to distinguish "the language doesn't
have this" from "the adapter doesn't round-trip this" from "the
witness doesn't exercise this." We already have `n/a` for one of those
three. The remaining two are conflated under `◐` — that's the real
methodological hole, and the reviewer was right to push on it. The
follow-up is to add justification taxonomy to cells (e.g.
`{value: "partial", reason: "adapter-encoder-limitation" | "witness-shape-mismatch" | …}`)
so audits can mechanically distinguish these cases. Tracked for a
future change.
