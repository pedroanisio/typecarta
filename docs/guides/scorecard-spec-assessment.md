# Scorecard Spec Assessment

This guide describes how to decide whether a scorecard result is correct against the TypeCarta specification.

## What The CLI Proves

`typecarta scorecard --filter all` proves that the current adapter implementation can run the 70 expanded witnesses through this pipeline:

```text
witness TypeTerm -> adapter.isEncodable -> adapter.encode -> adapter.parse -> criterion.evaluate
```

That is useful adapter evidence. It is not, by itself, a proof that the schema language has exactly those capabilities.

The specification defines scorecard cells as claims about faithful encodings. The implementation checks round-trip preservation of criterion-relevant structure. Those are related, but not identical.

## Assessment Checklist

For each criterion, record five facts:

| Field | Question |
|---|---|
| Criterion | Which `pi-prime-NN` row is being assessed? |
| Spec source | Which section defines the phenomenon? |
| Witness | Which `SPNN_*` TypeTerm represents the phenomenon? |
| Language feature | Which native JSON Schema draft-07 feature should encode it, if any? |
| Adapter result | What does the current TypeCarta adapter return after `encode -> parse`? |

Only call a cell "correct against the spec" when the language feature and adapter result agree with the criterion definition.

## Adapter-Hole vs. Language-Gap

Every `✗` cell in a scorecard collapses three different situations into one symbol:

1. **Adapter hole** — the IR constructor used by the witness (e.g. `mu`, `nominal`, `extension`) is not handled in the adapter's `encode` switch. `isEncodable` returns `false`, and the cell becomes `✗` with the justification `"Schema X is not encodable in Y"`. This is the adapter's fault, not the language's.
2. **Language gap** — the adapter handles the IR constructor, but the target schema language has no construct that preserves it. The encoding either throws or rounds-off; the cell becomes `✗` (or `partial`).
3. **Round-trip loss** — the adapter encodes and re-parses, but the criterion predicate rejects the parsed term. The cell becomes `partial` with a reason.

When assessing a scorecard against the spec, classify each contested cell into one of these three. Only situation (2) is a real claim about the target language; (1) and (3) are claims about the adapter.

## JSON Schema Draft-07 Current Status

The JSON Schema adapter now has a regression test that pins the current full-mode totals:

```text
✓ 22 / partial 15 / ✗ 33
```

The same test names known adapter/spec gaps. These are not necessarily JSON Schema draft-07 limitations; they are current adapter limitations unless separately proven otherwise.

| Criterion | Current adapter result | JSON Schema draft-07 feature to assess |
|---|---:|---|
| `pi-prime-25` Direct Self-Recursion | ✗ | `$ref` recursion |
| `pi-prime-26` Mutual Recursion | ✗ | `$ref` mutual recursion |
| `pi-prime-40` Modular / Divisibility Constraint | partial | `multipleOf` |
| `pi-prime-46` Set / Unique Collection | ✗ | `uniqueItems` |
| `pi-prime-47` Map / Dictionary | ✗ | `additionalProperties` and `patternProperties` |

## XSD Current Status

The XSD adapter currently pins to the following full-mode totals:

```text
✓ 21 / partial 16 / ✗ 33
```

The XSD adapter does not yet declare an XSD version. Several verdicts pivot on 1.0 vs. 1.1 (notably `xs:assert` and `xs:override`); the adapter should be split into `xsd-1.0` and `xsd-1.1` before any of those verdicts can be called spec-correct.

The current adapter encoder at `packages/adapters/xsd/src/adapter.ts` handles only the IR kinds `bottom | top | literal | base | apply | refinement`. Every witness whose root or sub-term uses `mu`, `nominal`, `extension`, `forall`, `let`, `keyof`, `conditional`, `mapped`, `rowpoly`, `complement`, or `var` fails `isEncodable` and produces an `✗` cell **before any XSD-side check runs**. Those rows are adapter holes, not XSD gaps.

The table below splits the contested `✗` cells into the three buckets defined above:

| Criterion | Current | Bucket | XSD feature that should encode it | Adapter blocker |
|---|---:|---|---|---|
| `pi-prime-13` Nullable-by-Value | ✗ | adapter hole | `nillable="true"` + `xsi:nil="true"` | `XsdDescriptor` has no `nillable`; witness uses `union([string, null])` and `null` is not in `encodeBase` |
| `pi-prime-25` Direct Self-Recursion | ✗ | adapter hole | named `xs:complexType` self-reference | no `mu` case in `encodeApply` |
| `pi-prime-26` Mutual Recursion | ✗ | adapter hole | two named complex types referencing each other | no `mu` case |
| `pi-prime-35` Nominal Tag / Brand | ✗ | adapter hole | nominal `{ns}name` identity; `xsi:type` | no `nominal` case |
| `pi-prime-36` Opaque / Newtype | ✗ | adapter hole | nominal sealed type | no `nominal` case |
| `pi-prime-44` Inter-Object Referential Constraint | ✗ | adapter hole + rubric | `xs:keyref` (document-scoped) | no `extension` case; rubric must decide whether document-scoped FK counts |
| `pi-prime-46` Set / Unique Collection | ✗ | adapter hole + rubric | `xs:unique` + `maxOccurs="unbounded"` | adapter signature lacks the `set` constructor; rubric must decide whether `xs:unique` counts |
| `pi-prime-50` Named Type Alias | ✗ | adapter hole | `simpleType` / `complexType` `name="..."` | descriptor supports `name` but encoder never emits it |
| `pi-prime-51` Module / Namespace | ✗ | adapter hole | `targetNamespace`, `xs:include`, `xs:import` | descriptor has no namespace field |
| `pi-prime-52` Visibility / Export Control | ✗ → ◐ | adapter hole | `final="..."`, `block="..."` | descriptor lacks these attributes |
| `pi-prime-67` Path-Navigating Constraint | ✗ | adapter hole | `xs:selector` / `xs:field` XPath subset | no `extension` case |

The `◐` cells in Families F (intersection), O (evolution), and P (annotations) are also genuine adapter gaps rather than XSD ones — XSD has `xs:extension` for record-merge, `xs:restriction` for refinement, and `xs:annotation` with `xs:appinfo` and `xs:documentation` for descriptions/examples/metadata.

The genuinely missing rows (XSD 1.0 and 1.1 alike) are Families H (parametricity & HKT), M (functions), Q (complement), R (bivariance), S (phantom/GADT), T (type-level computation), U (row polymorphism), V (state machines), plus `pi-prime-08` (positional unnamed tuple), `pi-prime-27` (recursive generic), and `pi-prime-68`/`pi-prime-69` (string concatenation/decomposition). Those reflect the fact that XSD is a document-validation language, not a programming-language type system.

### XSD 1.0 vs. 1.1

XSD 1.1 adds `xs:assert`, `xs:override`, and conditional type assignment. These move at least the following cells:

| Criterion | XSD 1.0 verdict | XSD 1.1 verdict | Rationale |
|---|---:|---:|---|
| `pi-prime-43` Intra-Object Cross-Field Constraint | ◐ | ✓ | `xs:assert` with XPath |
| `pi-prime-52` Visibility / Export Control | ◐ | ◐ | `xs:override` adds redefinition surface |

Until the adapter is split, treat all 1.1-specific verdicts as unmeasured.

### Known Defect: Intersection Encoding

The XSD encoder at `packages/adapters/xsd/src/adapter.ts:303-312` encodes `A ∩ B` as a complex type with a single field literally named `"intersection"` of type `anyType`. That is not a partial encoding — it produces a wrong descriptor that no XSD consumer would understand. The scorecard happens to mark `pi-prime-23` and `pi-prime-24` as `◐` ("No record-merge intersection" / "No refinement intersection") because the criterion predicate rejects the round-tripped form, but the underlying behavior is a bug, not a partial encoding. Either implement intersection via `xs:complexType` + `xs:extension`, or remove the fake encoding so `isEncodable` returns `false`.

## Validation Commands

Run the adapter assessment tests:

```bash
pnpm --filter @typecarta/adapter-json-schema test
pnpm --filter @typecarta/adapter-xsd test
```

Run the CLI scorecard manually:

```bash
node packages/cli/dist/index.js scorecard --adapter "JSON Schema" --filter all
node packages/cli/dist/index.js scorecard --adapter "xsd" --filter all
```

Then compare any changed row against the checklist above before treating the output as spec-correct.
