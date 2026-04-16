---
title: "ADR-002: TypeTerm AST Node-Kind Binding Decisions"
status: "accepted"
date: "2026-03-18"
prerequisite_for:
  - "packages/core/src/ast/*"
  - "packages/core/src/semantics/*"
  - "packages/witnesses/src/*"
relates_to:
  - "spec/schema-ir-expressiveness-map.md (§3 Remark 3.2.1, §12)"
---

# ADR-002: TypeTerm AST Node-Kind Binding Decisions

## Status

**Accepted.** This ADR must be resolved before any code is written in
`packages/core/src/ast/`.

## Context

The formal specification (§3, Def. 3.2) defines a core term grammar
sufficient for the base criterion set $\Pi$ (15 criteria):

- Nullary base types $b \in B$
- $n$-ary constructor applications $f(\tau_1, \ldots, \tau_n)$
- Parametric abstraction $\Lambda\alpha.\,\tau$ (optional)

Remark 3.2.1 explicitly identifies four type-level operators used by the
expanded criterion set $\Pi'$ (70 criteria) that **fall outside this
grammar**. Additionally, 20 of the 70 $\Pi'$ criteria are tagged
**[meta]**, requiring semantic enrichments beyond the extensional domain
$\tau : \mathcal{V} \to \{\top, \bot\}$.

The `TypeTerm` discriminated union is the central data structure of
`@typecarta/core`. Every adapter, criterion predicate, encoding function,
and scorecard evaluator depends on it. Adding a node kind later is a
breaking change that propagates to every exhaustive visitor. Removing one
is worse. **The set of node kinds must be decided up front.**

## Decision

Every operator reachable from $\Pi$ or $\Pi'$ is classified into exactly
one of three categories:

| Category | Meaning | Implication for `TypeTerm` |
|---|---|---|
| **First-class node kind** | Dedicated discriminant in the `TypeTerm` union | Visitors must handle it; adapters must map to/from it |
| **Derived form** | Expressible as a composition of first-class nodes | No new discriminant; a smart constructor in `constructors.ts` desugars to first-class nodes |
| **Adapter-specific extension** | Semantics depend on a specific IR's operational judgment or tooling layer | Represented via a generic `Extension` node carrying opaque adapter-defined payload |

### Binding Table: Remark 3.2.1 Operators

These are the four operators the spec explicitly flags as outside the
core grammar.

| Operator | Spec ref | Decision | Rationale |
|---|---|---|---|
| **Fixpoint binder** $\mu\alpha.\,\tau$ | $\pi_7$, $\pi'_{25}$-$\pi'_{27}$ | **First-class** | Variable-binding form with no fixed-arity decomposition. Required by 3 criteria in the base set ($\pi_7$, $\pi_8$) and 3 in $\Pi'$. Knaster-Tarski least-fixpoint semantics in $(\mathcal{P}(\mathcal{V}), \subseteq)$ must be implemented in `semantics/denotation.ts`. |
| **Complement** $\neg\tau$ | $\pi'_{59}$ | **First-class** | Unary operator whose semantics require $\mathcal{V}$ (not compositional over sub-term extensions alone). Interacts with $\mu$ and $\Lambda$ to create decidability hazards (§7 Remark 7.1.2); first-class status allows the evaluator to check and reject unsafe combinations. |
| **Key enumeration** $\mathrm{keyof}\,\tau$ | $\pi'_{63}$ | **First-class** | Type-level introspection with no fixed arity. Cannot be derived from product/union alone because it inspects the *label set* of a structural type, producing a union of literal types. |
| **Conditional type** $\tau_1\ \mathtt{extends}\ \tau_2\ ?\ \tau_A : \tau_B$ | $\pi'_{65}$ | **First-class** | Embeds a subtyping judgment inside a type constructor. 4-ary but fundamentally different from a regular constructor because the first two children participate in a relation, not a denotation. |

### Binding Table: Core Grammar Operators (from Def. 3.2)

These are already within the grammar but must be enumerated as explicit
node kinds.

| Operator | Spec ref | Decision | Rationale |
|---|---|---|---|
| **Base type** $b \in B$ | Def. 3.2 clause 1 | **First-class** (`Base`) | Nullary. Carries the base-type name. |
| **Constructor application** $f(\tau_1, \ldots, \tau_n)$ | Def. 3.2 clause 2 | **First-class** (`Apply`) | Covers `product`, `union`, `intersection`, `array`, `map`, `arrow`, etc. via constructor identity. |
| **Type abstraction** $\Lambda\alpha.\,\tau$ | Def. 3.2 clause 3 | **First-class** (`Forall`) | Required for $\pi_9$, $\pi_{15}$, $\pi'_{28}$-$\pi'_{33}$. |

### Binding Table: Additional Structural Operators from $\Pi'$

Operators introduced by $\Pi'$ criteria that are **not** in Remark 3.2.1
but require AST-level decisions.

| Operator | Spec ref | Decision | Rationale |
|---|---|---|---|
| **Refinement** $\{v : \tau \mid P(v)\}$ | $\pi_{10}$, $\pi'_{38}$-$\pi'_{41}$, $\pi'_{68}$ | **First-class** (`Refinement`) | The predicate $P$ is not a type term — it's a value-level constraint. Needs its own node kind carrying both the base type and the predicate representation. |
| **Mapped type** $\{[K \in S]: F(K, \tau[K])\}$ | $\pi'_{64}$ | **First-class** (`Mapped`) | Structural introspection + per-key transformation. Cannot be derived from `Apply` because it iterates over a dynamically-determined key set. |
| **Row-polymorphic record** $\prod\{l_i : \tau_i \mid \rho\}$ | $\pi'_{66}$ | **First-class** (`RowPoly`) | The row variable $\rho$ ranges over field sets, not types. Requires a distinct binding form from $\Lambda\alpha$. |
| **String concatenation** $S_1 \cdot S_2$ | $\pi'_{68}$ | **Derived form** | Expressible as `Apply("concat", S1, S2)` — a binary constructor application. Smart constructor `templateLiteral(parts)` in `constructors.ts`. |
| **Literal value** $\ell$ | $\pi_3$, $\pi'_5$ | **First-class** (`Literal`) | Singleton types. Could be a `Base` with a value payload, but the value-carrying nature makes it semantically distinct from named base types. |
| **Bottom** $\bot$ | $\pi_1$, $\pi'_1$ | **First-class** (`Bottom`) | Distinguished nullary. Not derived from `Base` because it has a unique semantic role ($\llbracket\bot\rrbracket = \emptyset$) and must be recognizable without evaluating constraints. |
| **Top** $\top$ | $\pi_2$, $\pi'_3$ | **First-class** (`Top`) | Dual of Bottom. $\llbracket\top\rrbracket = \mathcal{V}$. |
| **Type variable** $\alpha$ | Def. 3.2 clause 3 | **First-class** (`Var`) | Free and bound variables must be representable for substitution, free-variable extraction, and alpha-equivalence. |

### Binding Table: [meta]-Tagged Operators

These operators require semantic enrichments beyond the extensional
domain. They are grouped by their meta-tag.

#### [meta-op] — Operational Assignability Judgment

| Operator | Spec ref | Decision | Rationale |
|---|---|---|---|
| **Nominal tag** $\mathrm{nominal}(\mathtt{Tag}, \tau)$ | $\pi_{12}$, $\pi'_{35}$-$\pi'_{36}$ | **First-class** (`Nominal`) | The tag has no extensional effect but must survive encoding and round-tripping. A `Nominal` node wraps an inner type with a name. Opaque/newtype ($\pi'_{36}$) is a `Nominal` with a `sealed: true` flag. |
| **Variance annotation** $\Lambda(\alpha^{+/-})$ | $\pi'_{33}$ | **Derived form** | Variance is metadata on a `Forall` node's bound variable, not a separate operator. Represented as an attribute on the binding site within `Forall`. |
| **Explicit coercion edge** $c : S_1 \to S_2$ | $\pi'_{37}$ | **Adapter-specific extension** | Coercion edges are a property of the IR's type graph, not of an individual type term. Adapters that support coercions declare them via the `Extension` node or out-of-band in the adapter's metadata. |
| **Bivariant type** (e.g. `any`) | $\pi'_{60}$ | **Adapter-specific extension** | Bivariance is an operational property. An adapter represents its `any` as an `Extension` node; criterion $\pi'_{60}$ is evaluated against the adapter's operational judgment, not the AST. |
| **Phantom type parameter** | $\pi'_{61}$ | **Derived form** | A `Forall` where $\alpha \notin \mathrm{FTV}(\tau_0)$. Detectable by `free-vars.ts`; no new node kind needed. The phantom *enforcement* is operational and lives in the adapter. |
| **String pattern decomposition** | $\pi'_{69}$ | **Adapter-specific extension** | An inference-engine capability, not a type term property. |
| **State-machine type** | $\pi'_{70}$ | **Adapter-specific extension** | Requires transition-relation semantics beyond the single-value domain. |

#### [meta-coerce] — Validation-with-Coercion Domain

| Operator | Spec ref | Decision | Rationale |
|---|---|---|---|
| **Default value** $\mathrm{default}(l_i, d_i)$ | $\pi'_{14}$ | **Derived form** | A field-level annotation on a `Product`/`Apply("product", ...)` node. Represented as metadata in the field descriptor, not a separate AST node. Smart constructor `withDefault(field, value)` in `constructors.ts`. |

#### [meta-multi] — Multi-Instance Semantic Domain

| Operator | Spec ref | Decision | Rationale |
|---|---|---|---|
| **Inter-object referential constraint** | $\pi'_{44}$ | **Adapter-specific extension** | Foreign-key constraints are relational properties across schema instances. Cannot be represented as a property of a single type term. Adapters expose these via `Extension` or out-of-band declarations. |

#### [meta-annot] — Pure Annotation

| Operator | Spec ref | Decision | Rationale |
|---|---|---|---|
| **Read-only marker** | $\pi'_{15}$ | **Derived form** | Field-level metadata on product fields. Attribute on the field descriptor. |
| **Exhaustive/closed union** | $\pi'_{22}$ | **Derived form** | A boolean attribute on a union node. |
| **Generic default** $\Lambda(\alpha = \tau_D)$ | $\pi'_{30}$ | **Derived form** | Default is metadata on a `Forall` binding site, alongside the bound and variance. |
| **Named type alias** | $\pi'_{50}$ | **First-class** (`Let`) | $\mathrm{let}\ n = \tau\ \mathrm{in}\ \ldots$ is a binding form that introduces a scope. Required for `print.ts` round-tripping and module structure. |
| **Module/namespace** | $\pi'_{51}$ | **Adapter-specific extension** | Hierarchical grouping is a packaging concern, not a type-term property. |
| **Visibility/export control** | $\pi'_{52}$ | **Adapter-specific extension** | Same as above. |
| **Deprecation** | $\pi'_{53}$ | **Derived form** | Annotation metadata attachable to any node via a generic `annotations` map. |
| **Version identity** | $\pi'_{54}$ | **Adapter-specific extension** | Schema-level, not term-level. |
| **Backward compatibility** | $\pi'_{55}$ | **Adapter-specific extension** | Binary predicate on schema versions, not a term property ($\approx$ §13 encoding-check). |
| **Description/documentation** | $\pi'_{56}$ | **Derived form** | Annotation metadata. |
| **Example values** | $\pi'_{57}$ | **Derived form** | Annotation metadata. |
| **Custom extension metadata** | $\pi'_{58}$ | **Derived form** | Annotation metadata — the generic `annotations` map itself. |

### Resulting TypeTerm Union

The binding decisions above yield **16 first-class node kinds**:

```
TypeTerm =
  | Bottom                           -- pi_1, pi'_1
  | Top                              -- pi_2, pi'_3
  | Literal    { value }             -- pi_3, pi'_5
  | Base       { name }              -- Def. 3.2(1)
  | Var        { name }              -- Def. 3.2(3)
  | Apply      { constructor, args } -- Def. 3.2(2): product, union,
  |                                  --   intersection, array, map, arrow,
  |                                  --   concat, etc.
  | Forall     { var, bound?, variance?, default?, body }
  |                                  -- pi_9, pi_15, pi'_28-pi'_33
  | Mu         { var, body }         -- pi_7, pi_8, pi'_25-pi'_27
  | Refinement { base, predicate }   -- pi_10, pi'_38-pi'_41
  | Complement { inner }             -- pi'_59
  | KeyOf      { inner }             -- pi'_63
  | Conditional{ check, extends_, then_, else_ }
  |                                  -- pi'_65
  | Mapped     { keySource, valueTransform }
  |                                  -- pi'_64
  | RowPoly    { fields, rowVar, knownTypes }
  |                                  -- pi'_66
  | Nominal    { tag, inner, sealed } -- pi_12, pi'_35-pi'_36
  | Let        { name, binding, body } -- pi'_50
  | Extension  { kind, payload }     -- adapter-specific escape hatch
```

The `Extension` node is the **only** escape hatch. Adapters may define
custom `kind` discriminants within `Extension`, but core traversal,
free-variable extraction, and substitution treat `Extension` as opaque.

### Annotation Strategy

Rather than creating node kinds for each [meta-annot] criterion, every
node carries an optional `annotations` map:

```
annotations?: Record<string, unknown>
```

This covers: deprecation ($\pi'_{53}$), description ($\pi'_{56}$),
examples ($\pi'_{57}$), custom metadata ($\pi'_{58}$), read-only markers
($\pi'_{15}$), exhaustive-union flags ($\pi'_{22}$), and generic
defaults ($\pi'_{30}$, stored on the `Forall` node's binding metadata).

Field-level attributes (required, optional-by-absence, nullable-by-value,
default value) are properties of the field descriptor within an
`Apply("product", ...)` node, not separate AST nodes.

## Consequences

1. **Visitor exhaustiveness.** Any new first-class node kind added later
   will break every exhaustive match. The 16-kind set is designed to be
   stable across the full $\Pi'$ criterion set.

2. **Decidability gate.** Because `Complement`, `Mu`, and `Forall` are
   all first-class, the evaluator can statically detect the $\mu + \neg
   + \Lambda$ combination flagged in §7 Remark 7.1.2 and reject or warn.

3. **Adapter burden.** Adapters must handle 16 node kinds (plus
   `Extension` as a pass-through). Adapters for simpler IRs (e.g. JSON
   Schema draft-07) will map many kinds to `Extension` or return
   encoding errors.

4. **Compositionality of $\mu$.** The `Mu` node's denotation must be
   defined via Knaster-Tarski least fixpoint in
   $(\mathcal{P}(\mathcal{V}), \subseteq)$, not via the compositional
   semantics of Def. 3.3. This is a known gap in the spec (noted in the
   theoretical review) and must be addressed in
   `packages/core/src/semantics/denotation.ts`.

5. **`Extension` discipline.** The `Extension` node must not be used to
   circumvent the binding decisions in this ADR. If a phenomenon is
   classified as "adapter-specific extension" above, it belongs in
   `Extension`. If a phenomenon is "first-class" or "derived form", it
   must use the designated node kind or smart constructor.

## Alternatives Considered

**Flat union with one kind per $\Pi'$ criterion (70+ kinds).** Rejected:
many criteria test the same structural operator under different semantic
conditions (e.g., $\pi'_{38}$-$\pi'_{41}$ all test refinement variants).
Separate kinds would create artificial distinctions in the AST.

**Minimal union (8 kinds, matching $\Pi$ only).** Rejected: would require
retrofitting ~8 new kinds when $\Pi'$ witnesses are built, breaking all
existing adapters and visitors.

**Class hierarchy instead of discriminated union.** Rejected per ADR-002's
original intent (plan.md): union types give exhaustive matching, better
error messages, and align with the TypeScript implementation target.
