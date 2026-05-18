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

## TL;DR

| Adapter | ✓ | partial | ✗ | n/a | Universe |
|---|---:|---:|---:|---:|---:|
| `shacl-1-0` | 17 | 30 | 7 | 16 | 70 |
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

### JSON Schema stronger than SHACL (8 rows)

| # | SHACL | JS | Witness | Why |
|---|:---:|:---:|---|---|
| pi-prime-01 Syntactic Bottom | `partial` | `✓` | `SP01_SYNTACTIC_BOTTOM` | JSON Schema has `false` as a schema. SHACL has no first-class empty extension — encoded as `NodeShape { in: [] }` which the criterion predicate doesn't recognize as `bottom`. **Projection artifact**. |
| pi-prime-03 Global Top | `partial` | `✓` | `SP03_GLOBAL_TOP` | Same shape: JSON Schema's `true` is bottom's dual; SHACL's empty NodeShape is structurally indistinguishable from "any node" but the round-trip produces a NodeShape, not a `top()` term. |
| pi-prime-06 Finite Homogeneous Enum | `partial` | `✓` | `SP06_HOMO_ENUM` | JSON Schema's `enum: [...]` round-trips to `union([literal(...), …])` directly. SHACL's `sh:in` round-trips the same way, but the criterion's predicate matches the JSON Schema shape better. |
| pi-prime-07 Finite Heterogeneous Enum | `partial` | `✓` | `SP07_HETERO_ENUM` | Same as 06. |
| pi-prime-13 Nullable-by-Value | `partial` | `✓` | `SP13_NULLABLE_FIELD` | JSON Schema models nullable with `type: [..., "null"]`; SHACL has no native null type and the adapter falls back to `xsd:string` for `base("null")` — round-trip drops the union. **Real SHACL weakness**: RDF doesn't have null. |
| pi-prime-20 Discriminated Union | `partial` | `✓` | `SP20_DISCRIMINATED_UNION` | JSON Schema's `oneOf` + a tag property is the textbook pattern. SHACL's `sh:or` is unordered; the discriminator-property convention isn't native. |
| pi-prime-23 Record-Merge Intersection | `partial` | `✓` | `SP23_RECORD_MERGE` | JSON Schema's `allOf` merges two object schemas by field union. SHACL's `sh:and` over two NodeShapes round-trips to `intersection(...)` but the witness criterion expects the merged product. |
| pi-prime-24 Refinement Intersection | `partial` | `✓` | `SP24_REFINEMENT_INTERSECTION` | Same shape as 23 but on simple-type refinements. |
| pi-prime-42 Tagged Dependent Choice | `partial` | `✓` | `SP42_TAGGED_DEPENDENT` | JSON Schema's `if/then/else` is closer to the witness shape than SHACL's `sh:or` of branches. |
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
