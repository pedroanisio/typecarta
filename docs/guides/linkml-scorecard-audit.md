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

## TL;DR

| Adapter | ✓ | partial | ✗ | n/a | Universe |
|---|---:|---:|---:|---:|---:|
| `LinkML` | **14** | **20** | **19** | **17** | 70 |

LinkML's strengths surface where you'd expect: named classes, slots,
enums, URIs/mappings, schema modules. Weaknesses cluster in three
places: bare top-level forms (LinkML has no top-level `array` or
`union` outside a slot context), constructs LinkML simply lacks
(positional tuples, function types, polymorphism), and rows where
the IR vocabulary itself outruns LinkML's metamodel (mu, forall,
keyof, mapped, conditional, rowpoly → 17 `n/a` cells).

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
