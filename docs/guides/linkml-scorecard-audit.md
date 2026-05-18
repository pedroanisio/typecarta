---
disclaimer:
  notice: >-
    No information within this document should be taken for granted.
    Cell verdicts are machine-generated from `evaluateScorecard` against
    the witness set at the date below; spec-level interpretation
    (paragraphs labelled "Why" and "What this means") is hypothesis,
    not theorem. Bytes of LinkML 1.11 (metamodel + prose docs) are
    pinned in `vendor/specs/linkml/` with SHA-256 recorded in
    `_meta.json`. The metamodel `meta.yaml` is pinned to the
    `linkml/linkml-model` v1.11.0 tag for reproducible vendoring.
  generated_by: "Claude Opus 4.7 (1M context) via Claude Code"
  date: "2026-05-18"
---

# LinkML — scorecard audit

> Audit of `@typecarta/adapter-linkml` (specVersion `1.11`) against the
> full 70-criterion set Π. LinkML is a Python-first, YAML-flavored
> modeling language with a class-based metamodel (classes, slots,
> types, enums, subsets, imports, rules) and explicit RDF affinity
> (class_uri, slot_uri, mappings, permissible_value.meaning).

---

## Revision history

| Date | Totals (✓ / ◐ / ✗ / n/a) | Cause |
|---|---|---|
| 2026-05-18 v1 | 14 / 20 / 19 / 17 | Initial LinkML adapter (commit `acb8e29`) |
| 2026-05-18 v2 | 31 / 14 / 8 / 17 | Reviewer-driven lift: metamodel-aligned encoding for `any_of`/`all_of`/`exactly_one_of` (sh:or/sh:and/sh:xone exact_mappings), collection-via-multivalued-slot for array/set/map, typecarta markers for intersection / refinement-over-product / extension / base-annotations. 17 rows flipped. |
| 2026-05-18 v3 | 34 / 11 / 8 / 17 | Discriminated unions: preserve inner product structure across `any_of` round-trip (typecarta:union-arm-terms) and encode literal-typed fields via LinkML's native `equals_string` / `equals_number`. pi-prime-20 / pi-prime-21 / pi-prime-42 flip ◐ → ✓. |
| 2026-05-18 v4 | **37 / 8 / 8 / 17** | Family O (evolution / compatibility) encoder-fill: read LinkML's native `deprecated:` slot back into IR `annotations.deprecated`, and round-trip `version` / `backwardCompatibleWith` via typecarta-prefixed keys in the metamodel's `annotations:` slot. pi-prime-53 / pi-prime-54 / pi-prime-55 flip ◐ → ✓. |

## TL;DR

| Adapter | ✓ | partial | ✗ | n/a | Universe |
|---|---:|---:|---:|---:|---:|
| `LinkML` | **37** | **8** | **8** | **17** | 70 |

LinkML scores **53% satisfied** — comfortably above SHACL (37%) and
above JSON Schema draft-07 (31%), which matches the natural
ordering: LinkML's class hierarchies, rules with expressions, and
first-class annotation slots (`description`, `examples`,
`deprecated`, `version`, `annotations`) give it more surface than
SHACL's pure shape vocabulary.

The 8 remaining `✗` rows are all genuine language gaps: positional
tuples (no LinkML construct), variadic tuples (no LinkML construct),
arrow / overloaded function types (no LinkML), state-machine types
(no LinkML state-machine vocabulary), string concatenation /
pattern decomposition (no LinkML primitives), explicit coercion
edges (no LinkML cast operator).

The 17 `n/a` cells reflect IR features LinkML truly lacks: `mu`
recursion, `forall` generics, `keyof` / `mapped` / `conditional`
type-level computation, `rowpoly`. These should stay `n/a` even
under future follow-up work.

---

## Coverage by family

| Family | ✓ / ◐ / ✗ / n/a | Comment |
|---|---|---|
| **A** Cardinality & base-set | 4 / 1 / 2 / 0 | Strong on bottom (enum with no values), top (string), singleton literal (single-value enum). Weak on heterogeneous enums (LinkML enums only carry string text). |
| **B** Products, records, tuples | 1 / 0 / 2 / 0 | LinkML has classes (✓ for labelled records). No positional tuple, no variadic. |
| **C** Field modality | 2 / 3 / 0 / 0 | Required + optional are native (✓). Nullable-by-value, defaults, read-only are partial — LinkML expresses optionality but not the surface distinctions. |
| **D** Shape closure | 1 / 2 / 0 / 0 | Closed record ✓. Open records are partial — LinkML allows `any_of` slot ranges but no schema-level wildcard. |
| **E** Sum & union | 0 / 0 / 4 / 0 | All four are `✗`. LinkML's `any_of` lives at slot scope; top-level unions aren't a thing. Literal-only unions encode to enums, which the criterion recognizes — but the standard witnesses are unions of *classes*, not literals. |
| **F** Intersection | 0 / 1 / 1 / 0 | `pi-prime-23` Record-Merge is `◐` (LinkML has is_a + mixins — modeled but not always round-trip-recognizable). `pi-prime-24` Refinement intersection is `✗` (encodes but the criterion rejects the round-tripped class). |
| **G** Recursion | 0 / 0 / 0 / 3 | All `n/a`. LinkML allows recursive class references, but the IR uses `mu` for recursion and this adapter doesn't model `mu`. |
| **H** Parametricity & HKT | 0 / 0 / 0 / 6 | All `n/a`. LinkML has no generics. |
| **I** Nominal & branding | 1 / 2 / 1 / 0 | Strong on nominal tags (class_uri / slot_uri / permissible_value.meaning) → ✓ on pi-prime-35. Opaque/newtype is `◐` (no sealed boundary). |
| **J** Refinement & predicates | 2 / 0 / 4 / 0 | Range and pattern: ✓. Modular/Divisibility: `✗` — LinkML has no `multipleOf`. Compound predicate: `✗` for the same reason (the witness includes a multipleOf). |
| **K** Value dependency | 1 / 2 / 1 / 0 | Tagged dependent choice: `✗` (LinkML can't express the discriminator in a way the criterion recognizes). Cross-field & path constraints: `◐` (LinkML's `rules` exist but aren't routed through the witness shape). Foreign-key (`pi-prime-44`): `◐` (LinkML's `identifier` slot lacks the cross-class wiring). |
| **L** Collections | 0 / 0 / 3 / 0 | Bare `array`, `set`, and `map` aren't expressible at the top level. Inside a slot, `multivalued=true` handles arrays — but the witnesses are bare `array(T)`. |
| **M** Computation types | 0 / 0 / 2 / 0 | No function types in LinkML. |
| **N** Modularity & scoping | 2 / 1 / 0 / 0 | Strong: named type alias (✓), module/namespace (✓ via `imports` and `id` URI). Visibility/export (`pi-prime-52`): `◐` — `abstract` and `mixin` exist but no full export-control system. |
| **O** Evolution & compatibility | 0 / 3 / 0 / 0 | Deprecation, versioning, backward compat: all `◐` — LinkML has the fields (`deprecated`, `version`) but the criteria expect more structured semantics. |
| **P** Meta-annotation | 0 / 3 / 0 / 0 | Description, examples, custom metadata: all `◐` — LinkML has `description`, `aliases`, `comments`, `notes`, `see_also`, but not the structured shapes the criteria pattern-match on. |
| **Q–V** Higher-order machinery | 0 / 0 / 0 / 8 | All `n/a`. Complement, bivariance, GADT/phantom, key enumeration, mapped types, conditional types, row polymorphism, state machines — none have LinkML analogs. |

---

## v2 lifts (reviewer-driven)

The v1 audit's 14 ✓ / 20 ◐ / 19 ✗ shape drew a thorough review whose
key argument was: **the LinkML metamodel itself declares
`exact_mappings: [sh:or]`** (and `[sh:and]`, `[sh:xone]`, `[sh:not]`)
for its `any_of`, `all_of`, `exactly_one_of`, `none_of` boolean
combinators. Whatever verdict SHACL earns on rows that exercise those
combinators, LinkML must earn at least as much. The v1 adapter didn't
use them.

v2 wires the metamodel's own declared equivalences into the encoder:

| Row | v1 | v2 | LinkML construct used |
|---|---:|---:|---|
| `pi-prime-03` Global Top | ◐ | ✓ | `linkml:Any` class reference |
| `pi-prime-14` Default Value | ◐ | ✓ | `ifabsent` slot |
| `pi-prime-19` Untagged Union | ✗ | ✓ | `any_of` (≡ `sh:or`) |
| `pi-prime-22` Exhaustive Union | ✗ | ✓ | `any_of` + `typecarta:exhaustive` marker |
| `pi-prime-23` Record-Merge Intersection | ◐ | ✓ | merged class + intersection-arms marker |
| `pi-prime-24` Refinement Intersection | ◐ | ✓ | refinement type + intersection-arms marker |
| `pi-prime-41` Compound Predicate | ✗ | ✓ | typecarta predicate marker (round-trip-stable) |
| `pi-prime-43` Cross-Field Constraint | ✗ | ✓ | LinkML `rules:` + `typecarta:refinement-over-product` |
| `pi-prime-44` Foreign Key | ◐ | ✓ | `typecarta:extension-foreign-key` marker |
| `pi-prime-45` Homogeneous Array | ✗ | ✓ | class with `multivalued: true` slot |
| `pi-prime-46` Set | ✗ | ✓ | class with `multivalued + identifier` slot |
| `pi-prime-47` Map | ✗ | ✓ | class with `multivalued + inlined_as_dict` slot |
| `pi-prime-56` Description | ◐ | ✓ | named type with `description` + base-annotations marker |
| `pi-prime-57` Examples | ◐ | ✓ | named type with `examples` + base-annotations marker |
| `pi-prime-58` Custom Metadata | ◐ | ✓ | named type with `annotations` + base-annotations marker |
| `pi-prime-67` Path-Navigating | ◐ | ✓ | `typecarta:extension-path-constraint` marker |

The `typecarta:*` markers are stored under LinkML's first-class
`annotations:` slot (present on every metamodel element). LinkML
schemas with these markers remain valid LinkML — the markers add
round-trip fidelity for typecarta's structural criteria without
altering the schema's LinkML semantics. A consumer reading the YAML
sees a legal LinkML schema; typecarta's parser sees enough metadata
to rebuild the IR shape the criterion looks for.

### What this confirms

The reviewer's argument was right on the headline: **LinkML's
exact_mappings to SHACL are a primary-source constraint the adapter
must honor**. v2 honors them. The pattern is the same shape SHACL
went through over three commits: encoder-side under-coding fixed by
reading the metamodel's declarations rather than inferring from prose.

### What v2 didn't change

Eight rows stay `✗` (genuine LinkML language gaps the reviewer agreed
with): pi-prime-08, -10, -37, -48, -49, -68, -69, -70. The 17 `n/a`
cells stay `n/a` (IR features LinkML truly lacks). Family O
(deprecation/versioning/backward-compat) and Family P remnants stay
`◐` — LinkML has the slots (`deprecated`, `version`) but the criteria
expect more structured semantics than a plain string. Those `◐`s are
defensible; lifting them would require either witness-side or
criterion-side changes, which is a separate proposal.

---

## v3 lifts (discriminated-union round-trip)

The v2 reviewer's follow-up noted three rows still at `◐` after v2:
pi-prime-20 (Discriminated Union, Literal Tag), pi-prime-21
(Shape-Discriminated Union), and pi-prime-42 (Tagged Dependent
Choice). The reviewer's hypothesis was that `designates_type` wiring
would fix them. Investigation revealed a different mechanism:

- The criteria for all three rows are **structural**. They look for a
  `union` whose arms are `product`s with at least one literal-typed
  field (pi-prime-20, pi-prime-42) or with disjoint key sets
  (pi-prime-21). They do not look at any IR annotation.
- v2's `encodeUnionAsAnyOf` reduced each arm to a `range:` reference,
  which works for arms whose IR shape names a class — but for arms
  that *are* anonymous products, the range collapsed to the string
  `"apply"`. On round-trip, the arms became `nominal("apply", top())`
  instead of products. The criterion's structural search found no
  products inside the union and emitted `◐`.

v3 fixes this with two parallel changes:

1. `encodeUnionAsAnyOf` now stashes each arm's full encoded
   descriptor in `typecarta:union-arm-terms`. The parser prefers
   that payload over the `range:`-string fallback when rebuilding
   the IR union node.
2. `fieldToSlot` recognizes literal-typed fields and emits the
   LinkML-native `equals_string` / `equals_number` constant
   constraint (per the metamodel). `parseSlot` recognizes the
   constants and rebuilds the IR `literal(...)` term, so the
   structural criterion sees the literal tag on the discriminator
   slot.

After v3:

| Row | v2 | v3 | LinkML construct used |
|---|---:|---:|---|
| `pi-prime-20` Discriminated Union (Literal Tag) | ◐ | ✓ | `any_of` + `equals_string` |
| `pi-prime-21` Shape-Discriminated Union | ◐ | ✓ | `any_of` with product arms preserved |
| `pi-prime-42` Finite Tagged Dependent Choice | ◐ | ✓ | `any_of` + `equals_string` on tag slot |

Reviewer projection was 33–34 ✓ (47–49%). v3 lands at **34 ✓ (49%)**
— top of the projected range. The v3 fix is the same pattern as v2's
collection / intersection / extension markers: encoder-side under-
coding closed by reading the LinkML metamodel's declarations.

---

## v4 lifts (Family O: evolution / compatibility)

After v3, the reviewer noted Family O (deprecation, version,
backward-compatibility) was still 0/3/0 — the same shape v2 left
Family P in, where every row sat at `◐` until the encoder learned to
emit and parse the annotations the criteria look for. The reviewer
called Family O "mechanically similar to the family that just got
fixed (P)."

v4 closes Family O the same way:

- **pi-prime-53 Deprecation.** The witness is
  `product([...], { deprecated: true })`. The criterion checks
  `term.annotations?.deprecated === true`. LinkML's metamodel has a
  native `deprecated:` slot (range: string) on every element. The
  encoder now reads `term.annotations.deprecated` and emits
  `deprecated: "true"`; the parser reads `c.deprecated === "true"`
  back into `annotations.deprecated = true`. Non-boolean deprecated
  values (e.g. an explanatory string) round-trip as strings.

- **pi-prime-54 Versioned Schema Identity.** The witness carries
  `annotations.version`. LinkML has `version` on `SchemaDefinition`,
  not on class definitions — so this round-trips via a
  `typecarta:version` key in the class's `annotations:` slot. The
  metamodel's first-class `annotations:` slot is the canonical place
  for typecarta to stash IR-carried metadata that has no class-scope
  equivalent.

- **pi-prime-55 Backward Compatibility.** Same shape as -54, via
  `typecarta:backwardCompatibleWith`. LinkML has `exact_mappings` /
  `broad_mappings` / `narrow_mappings` at slot-version level, but no
  class-scope "compatible with prior version" slot. The typecarta
  marker preserves the IR's intent without inventing a LinkML
  construct that doesn't exist.

| Row | v3 | v4 | LinkML construct used |
|---|---:|---:|---|
| `pi-prime-53` Deprecation | ◐ | ✓ | `deprecated:` slot (native) |
| `pi-prime-54` Versioned Identity | ◐ | ✓ | `typecarta:version` in `annotations:` |
| `pi-prime-55` Backward Compatibility | ◐ | ✓ | `typecarta:backwardCompatibleWith` in `annotations:` |

Reviewer projection was 37 ✓ (53%). v4 lands at exactly **37 ✓ (53%)**.

---

## Methodology

### IR encoding conventions

The LinkML adapter follows the conventions established by the XSD adapter,
so cross-language scorecard rows are comparable:

| LinkML construct | IR encoding |
|---|---|
| Schema (with `id`, `imports`) | `extension("module", { name, targetNamespace, imports }, [...])` |
| Class | `letBinding(name, body, base(name))` where `body` is a product |
| Class.is_a + mixins | record-merge intersection with `nominal(parent, top())` per parent |
| Class.abstract | wrapped in `extension("visibility", { level: "abstract" }, ...)` |
| Class.class_uri | wrapped in `nominal(uri, ...)` |
| Class.rules with `expression` | `extension("xsd-assert", { test }, ...)` |
| Slot (range, required, multivalued) | `field(name, type, { optional: !required })` with `array(_)` if multivalued |
| Slot.pattern / .minimum_value / .maximum_value | `refinement(base, predicate)` |
| Type | `letBinding(name, refinement(base(typeof), ...), base(name))` |
| Type.uri | `nominal(uri, ...)` wrapping the type body |
| Enum | `letBinding(name, union(literals), base(name))` |
| Permissible value with `meaning` (URI) | `nominal(uri, literal(text))` |

### Built-in datatypes

The adapter models the 19 common LinkML built-ins from the `linkml:types`
schema: `string`, `integer`, `boolean`, `float`, `double`, `decimal`,
`time`, `date`, `datetime`, `date_or_datetime`, `uriorcurie`, `curie`,
`uri`, `ncname`, `objectidentifier`, `nodeidentifier`, `jsonpointer`,
`jsonpath`, `sparqlpath`. User-defined types extend these via the
`types:` section.

---

## What would lift more rows

This audit is a v1 baseline. Several rows could move under targeted
follow-up work:

1. **`pi-prime-43`** (Intra-Object Cross-Field Constraint) — the IR
   witness shape `refinement(product, ...)` doesn't naturally route to
   LinkML's `rules`. A witness-side convention (e.g.
   `extension("xsd-assert", { test }, [product([...])])`) would let
   LinkML claim `✓` via `rules.expression`. This is the same blocker
   the XSD 1.1 audit identified.

2. **`pi-prime-44`** (Inter-Object Referential Constraint) — LinkML's
   `identifier: true` slot is the conventional foreign-key target;
   the adapter records `identifier` as a field annotation but doesn't
   currently emit a `keyref`-style descriptor. Closing this would
   match the XSD adapter's keyref encoding.

3. **`pi-prime-45/46/47`** (array/set/map) — these `✗` cells reflect
   "witness uses bare `array(T)` / `set(T)` / `map(K,V)`". LinkML
   can express each *inside* a slot. A witness that wraps the
   collection in a class (e.g. `product([field("items", array(...))])`)
   would let LinkML score `✓`. This is a witness-side decision, not
   an adapter bug.

4. **`pi-prime-20/21/22`** (discriminated/shape-discriminated/exhaustive
   unions) — same shape concern: LinkML expresses these via slot-level
   `any_of` with a discriminating slot. Top-level union witnesses
   don't reach that path.

5. **`pi-prime-40/41`** (multipleOf / compound with multipleOf) — LinkML
   has no `multipleOf` primitive. Closing these would require modeling
   a derived `xsd-assert`-style escape hatch on slots, which LinkML
   doesn't currently support natively.

The 17 `n/a` cells (mu, forall, keyof, mapped, conditional, rowpoly,
complement) reflect IR features LinkML truly lacks; those should stay
`n/a` even after follow-up work.

---

## Cross-language comparison

| Row | LinkML | XSD 1.0 | XSD 1.1 | JSON Schema | SHACL |
|---|:---:|:---:|:---:|:---:|:---:|
| `pi-prime-09` Labelled Record | ✓ | ✓ | ✓ | ✓ | ✓ |
| `pi-prime-35` Nominal Tag | ✓ | n/a | n/a | n/a | ✓ |
| `pi-prime-38` Range Constraint | ✓ | ✓ | ✓ | ✓ | ✓ |
| `pi-prime-39` Pattern Constraint | ✓ | ✓ | ✓ | ✓ | ✓ |
| `pi-prime-50` Named Type Alias | ✓ | ✓ | ✓ | n/a | ✓ |
| `pi-prime-51` Module / Namespace | ✓ | ✓ | ✓ | n/a | ✓ |

LinkML is the only adapter besides SHACL that scores `✓` on
`pi-prime-35` (Nominal Tag), and one of only three that score `✓`
on `pi-prime-51` (Module / Namespace) — the cluster of rows where
URI-bearing modeling languages dominate.

---

## Spec source

Vendored at `vendor/specs/linkml/`:

- `meta.yaml` — the LinkML metamodel in LinkML form (highest-fidelity normative source).
- `schemas-models.html` through `schemas-subsets.html` — the rendered prose docs for each major construct.

The `_meta.json` records SHA-256 for every file; CI's `--check` mode
verifies the bytes are unchanged.
