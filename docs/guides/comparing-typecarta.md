---
disclaimer:
  notice: >-
    No information within this document should be taken for granted.
    Any statement or premise not backed by a real logical definition
    or verifiable reference may be invalid, erroneous, or a hallucination.
  generated_by: "Codex via OpenAI API"
  date: "2026-05-18"
---

# Comparing TypeCarta Against Schema Languages

Use this guide when writing a matrix, report, adapter audit, or external
comparison that includes TypeCarta as one column among schema languages.

TypeCarta is the scoring frame for schema IR expressiveness. It is not an
operational superset of every target ecosystem. A row about HTTP routes,
query planners, command handlers, runtime graph traversal, DDD aggregates, or
authorization policy may be outside TypeCarta's type/schema scope even when a
target language exposes it.

## Evidence Classes

Classify each TypeCarta cell by the mechanism that carries the evidence.

| Class | Use when | Example |
|---|---|---|
| `native-node` | A first-class `TypeTerm.kind` carries the construct directly | `bottom`, `top`, `forall`, `mu`, `refinement`, `nominal`, `complement`, `conditional` |
| `apply-constructor` | An `apply` node uses a well-known constructor name | `product`, `union`, `intersection`, `array`, `set`, `map`, `arrow`, `tuple` |
| `annotation` | The construct is represented by node metadata | `description`, `examples`, `deprecated`, `version`, `backwardCompatibleWith` |
| `extension` | The construct needs an explicit escape-hatch node | `foreign-key`, `path-constraint` |
| `unsupported` | The construct is in TypeCarta's scope but no current TypeTerm evidence represents it | A future criterion without a witness |
| `out-of-scope` | The construct is not a type/schema expressiveness claim | HTTP routing, command execution, query execution, database trigger runtime behavior |

Do not collapse these classes into a single "native" label. A TypeCarta
extension is intentional evidence, but it is not the same claim as a
first-class node or a well-known `apply` constructor.

## Source Of Truth

Prefer machine-readable data over hand-rated prose.

```bash
typecarta capabilities --format json
```

The JSON export is backed by `SELF_CAPABILITIES` in
`packages/core/src/criteria/pi-prime/self-capabilities.ts`. Supported entries
there are tied to `SELF_WITNESSES` in
`packages/core/src/criteria/pi-prime/self-witnesses.ts`, and tests verify each
witness satisfies its criterion predicate.

Use `typecarta scorecard --adapter <name> --filter all --output json` when the
comparison is about a concrete adapter. Use `typecarta capabilities --format
json` when the comparison is about TypeCarta's own expressiveness evidence.

## Common Rating Corrections

These rows are often misclassified in external matrices:

| Criterion | Correct TypeCarta evidence | Class |
|---|---|---|
| `pi-prime-08` Positional Tuple | `apply` with constructor `tuple` | `apply-constructor` |
| `pi-prime-44` Inter-Object Referential Constraint | `extensionKind: "foreign-key"` | `extension` |
| `pi-prime-47` Map / Dictionary | `apply` with constructor `map` | `apply-constructor` |
| `pi-prime-48` Function / Arrow Type | `apply` with constructor `arrow` | `apply-constructor` |
| `pi-prime-53` Deprecation Annotation | `annotations.deprecated` | `annotation` |
| `pi-prime-56` Description / Documentation | `annotations.description` | `annotation` |
| `pi-prime-57` Example Values | `annotations.examples` | `annotation` |
| `pi-prime-67` Path-Navigating Constraint | `extensionKind: "path-constraint"` or `annotations.pathConstraint` | `extension` or `annotation` |

## Boundary Rules

Use these rules before assigning a cell:

1. If the row names a `TypeTerm.kind`, rate it as `native-node`.
2. If the row names a product, union, collection, tuple, map, set, or arrow
   form represented by `ApplyNode.constructor`, rate it as `apply-constructor`.
3. If the row is about descriptive, compatibility, or provenance metadata,
   check `annotations` before claiming an extension is required.
4. If the row needs cross-object or target-specific schema behavior, check for
   an explicit extension witness before marking it unsupported.
5. If the row describes runtime behavior outside type/schema membership, mark
   it `out-of-scope` rather than forcing a TypeTerm encoding.

## Claims To Avoid

Avoid unqualified claims that TypeCarta automatically covers every construct
because it is the comparison frame. More precise phrasing is:

> TypeCarta is the measurement frame for this criterion set. Its evidence may
> be first-class, constructor-backed, annotation-backed, extension-backed, or
> outside scope depending on the row.

Avoid treating TypeCarta's `conditional` node as JSON Schema `if/then/else`
or LinkML classification logic without checking the criterion. Type-level
conditionals and value-level cross-field constraints are different phenomena.

Avoid using `CORE_CRITERIA` array position as an informal criterion number.
The stable identifiers are `pi-prime-NN`; the core list follows the spec
c-index order only because the implementation exports an explicit ordered
`CORE_IDS` list.
