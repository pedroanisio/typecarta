---
title: "typecarta — Schema IR Expressiveness Framework"
version: "0.1.0"
status: "pre-alpha"
date: "2026-03-18"
disclaimer: >
  NO INFORMATION WITHIN THIS DOCUMENT SHOULD BE TAKEN FOR GRANTED.
  Any statement or premise not backed by a real logical definition or a
  verifiable reference may be invalid, erroneous, or a hallucination.
  The repository structure described herein is a proposal and may change
  substantially. All capability claims refer to design targets, not
  delivered functionality, unless explicitly stated otherwise.
---

# typecarta

**A formal framework and programmatic toolkit for measuring, comparing, and
reasoning about the expressive power of schema Intermediate Representations.**

---

## The Problem

Every schema tool — Zod, JSON Schema, Protobuf, TypeScript, GraphQL, Avro,
Effect Schema, Typebox — implicitly claims to "support" certain type-system
features. These claims are informal, unauditable, and incomparable. When a
tool says "we support unions," it could mean untagged set-union, discriminated
tagged sums, shape-discriminated unions, or exhaustive closed unions — four
structurally independent phenomena with different IR design costs and different
semantic-loss profiles when converting between formats.

The consequences are real:

- **Silent data loss at schema boundaries.** Converting a Zod schema with
  nominal brands to JSON Schema silently drops the brand. Converting a JSON
  Schema with `if/then/else` to TypeScript requires manual intervention.
  These losses are discovered in production, not at compile time.

- **Indefensible tool selection.** There's no formal basis for choosing between
  schema IRs. Feature matrices on marketing pages conflate syntactic sugar
  with semantic expressiveness.

- **Impossible universality claims.** No finite IR can faithfully encode all
  possible type languages — this is a provable mathematical fact (cardinality
  argument over the power set of the value universe). Yet tools routinely
  imply universality without naming the class of schemas they actually target.

## What typecarta Does

typecarta provides:

1. **A formal specification** (`spec/`) defining what it means for an IR to
   *model* a schema language, what *faithfulness* of encoding means
   (sound, complete, or both), and what the *impossibility boundary* is.

2. **A criterion set** of 70 orthogonal, formally defined type-system
   phenomena (Π′), organized in 22 families — from bottom types and
   singleton literals through recursive generics, row polymorphism,
   conditional types, GADTs, and state-machine types. Each criterion is
   a decidable predicate on type terms.

3. **A witness schema set** (ℂ) — 15 concrete schemas, one per base
   criterion, serving as a minimal litmus test for any IR.

4. **A scorecard engine** that evaluates a concrete IR against the criterion
   set and produces a machine-readable ✓ / partial / ✗ evaluation matrix.

5. **An encoding-check layer** for relational properties (width subtyping,
   depth subtyping, variance under generics) that unary criteria cannot
   capture.

6. **Adapter interfaces** for plugging in concrete schema languages
   (JSON Schema, Zod, TypeScript, etc.) as both source languages and
   evaluation targets.

## Core Concepts

### Types as Predicates

A type τ is a total function τ : 𝒱 → {⊤, ⊥} over a countably infinite
value universe 𝒱. Its *extension* ⟦τ⟧ = {v ∈ 𝒱 | τ(v) = ⊤} is the
set of values it accepts. Subtyping is set inclusion: τ₁ ≤ τ₂ iff
⟦τ₁⟧ ⊆ ⟦τ₂⟧.

### Encoding Faithfulness

An encoding φ : 𝒯(Σ) → 𝒩ᵣ maps source type terms to IR nodes. It is:

- **Sound** if ⟦φ(τ)⟧ᵣ ⊆ ⟦τ⟧_Σ — the IR never accepts what the source rejects.
- **Complete** if ⟦τ⟧_Σ ⊆ ⟦φ(τ)⟧ᵣ — the IR never rejects what the source accepts.
- **Faithful** if both hold: ⟦φ(τ)⟧ᵣ = ⟦τ⟧_Σ.

### The Impossibility Boundary

No IR with a finite signature can strongly model the class of *all* schema
languages over 𝒱. The type terms over a finite signature are countable;
the possible type extensions are uncountable (|𝒫(𝒱)| = 2^ℵ₀). Every
IR *must* have blind spots. The only honest engineering posture is to name
them.

### Criterion Families (Π′ — 22 families, 70 criteria)

| Family | Criteria | Covers |
|---|---|---|
| **A** Cardinality & Base-Set | π′₁–π′₇ | Bottom, top, sort-restricted top, literals, enums |
| **B** Products, Records, Tuples | π′₈–π′₁₀ | Tuples, labelled records, variadic rest |
| **C** Field Modality | π′₁₁–π′₁₅ | Required, optional, nullable, defaults, read-only |
| **D** Shape Closure | π′₁₆–π′₁₈ | Closed, open-unconstrained, open-typed extras |
| **E** Sum & Union Structure | π′₁₉–π′₂₂ | Untagged, discriminated, shape-discriminated, exhaustive |
| **F** Intersection | π′₂₃–π′₂₄ | Record-merge, refinement intersection |
| **G** Recursion | π′₂₅–π′₂₇ | Direct, mutual, recursive generic |
| **H** Parametricity & Higher Kinds | π′₂₈–π′₃₃ | Rank-1, bounded, higher-rank, HKT, variance |
| **I** Nominal Identity & Branding | π′₃₄–π′₃₇ | Structural, nominal, opaque, coercion |
| **J** Refinement & Predicates | π′₃₈–π′₄₁, π′₆₈–π′₆₉ | Range, regex, modular, compound, string concat/decomp |
| **K** Value Dependency | π′₄₂–π′₄₄, π′₆₇ | Tagged choice, cross-field, inter-object, path-nav |
| **L** Collection Types | π′₄₅–π′₄₇ | Array, set, map |
| **M** Computation Types | π′₄₈–π′₄₉ | Arrow, overloaded function |
| **N** Modularity & Scoping | π′₅₀–π′₅₂ | Named alias, module/namespace, visibility |
| **O** Evolution & Compatibility | π′₅₃–π′₅₅ | Deprecation, versioning, backward compat |
| **P** Meta-Annotation | π′₅₆–π′₅₈ | Description, examples, custom metadata |
| **Q** Type-Level Negation | π′₅₉ | Complement (¬τ) |
| **R** Unsound / Bivariant | π′₆₀ | Unsound bivariant type (e.g. `any`) |
| **S** Phantom & Indexed | π′₆₁–π′₆₂ | Phantom parameters, GADTs |
| **T** Type-Level Computation | π′₆₃–π′₆₅ | keyof, mapped types, conditional types |
| **U** Row Polymorphism | π′₆₆ | Row-polymorphic records |
| **V** Temporal / Stateful | π′₇₀ | State-machine types |

Of these, 50 are purely extensional and 20 require meta-structural
enrichment (operational subtyping, coercion, multi-instance, or annotation).

### Scorecard (Base Π — 15 criteria)

The specification includes a worked scorecard for three IRs:

| IR | ✓ | partial | ✗ |
|---|:---:|:---:|:---:|
| JSON Schema (draft-07) | 7 | 5 | 3 |
| Zod IR (est.) | 11 | 2 | 2 |
| TypeScript 5.x | 12 | 2 | 1 |

## Installation

> **Status: pre-alpha.** The specification is published; the programmatic
> implementation is under active development. The package is not yet
> published to npm.

```bash
# When published:
npm install typecarta

# Development:
git clone https://github.com/<org>/typecarta.git
cd typecarta
pnpm install
pnpm build
```

## Usage (Target API — Design-Phase)

```typescript
import {
  loadIRAdapter,
  evaluateScorecard,
  checkEncoding,
} from 'typecarta';
import { zodAdapter } from '@typecarta/adapter-zod';
import { jsonSchemaAdapter } from '@typecarta/adapter-json-schema';

// Evaluate Zod against the base criterion set Π
const zodScore = evaluateScorecard(zodAdapter, { criterionSet: 'pi' });
// => { S1: '✓', S2: '✓', ..., S15: '✗', totals: { pass: 11, partial: 2, fail: 2 } }

// Evaluate encoding faithfulness for a specific schema
const source = jsonSchemaAdapter.parse(myJsonSchema);
const encoded = zodAdapter.encode(source);
const fidelity = checkEncoding(source, encoded);
// => { sound: true, complete: false, faithful: false, lostCriteria: ['pi_12', 'pi_9'] }

// Run the encoding-check layer (subtyping precision)
import { encodingChecks } from 'typecarta';
const rhoW = encodingChecks.widthSubtyping(zodAdapter, witnessWide, witnessNarrow);
// => { preserved: true }
```

## Project Structure

See [`STRUCTURE.md`](./STRUCTURE.md) for the full annotated repository layout.

```
typecarta/
├── spec/                        # Formal specification (the math)
│   └── schema-ir-expressiveness-map.md
├── packages/
│   ├── core/                    # AST, criteria predicates, scorecard engine
│   ├── witnesses/               # Diverse schema sets ℂ and ℂ′
│   ├── encoding-check/          # ρ_W, ρ_D, ρ_G implementations
│   ├── cli/                     # CLI for running evaluations
│   └── adapters/                # Per-language encoding functions
│       ├── json-schema/
│       ├── zod/
│       ├── typescript/
│       ├── protobuf/
│       ├── graphql/
│       └── effect-schema/
├── docs/                        # Architecture, contributing, ADRs
├── benchmarks/                  # Performance and coverage benchmarks
└── examples/                    # Worked examples and tutorials
```

## Relationship to Existing Work

typecarta draws on established type theory and PL research but addresses a
gap: there is no existing tool or framework that provides a *practical,
machine-executable* comparison of schema IR expressiveness grounded in
formal semantics. Adjacent work includes:

- **Pierce, "Types and Programming Languages" (2002)** — foundational
  treatment of type systems, subtyping, and polymorphism that informs the
  semantic foundation (§2) and the criterion taxonomy.

- **Frisch, Castagna, Benzaken, "Semantic Subtyping" (2008)** — the
  decidability result for semantic subtyping with recursive types and
  Boolean connectives referenced in §7 (Remark 7.1.2) regarding the
  μ+¬ interaction.

- **JSON Schema Test Suite** — tests syntactic conformance of JSON Schema
  validators, but does not address expressiveness relative to other
  schema languages.

- **OpenAPI Specification** — defines a schema vocabulary built on JSON
  Schema, but provides no formal expressiveness comparison with other IRs.

typecarta does not replace any of these. It provides the formal bridge
between type-theoretic foundations and practical IR engineering that none
of them cover.

## Contributing

> Contribution guidelines will be published in `docs/CONTRIBUTING.md`
> once the core package structure stabilizes.

Key areas where contributions are needed:

- **Witness schemas for Π′.** The expanded criterion set has 70 criteria
  but no corresponding diverse schema set ℂ′. Each witness must satisfy
  Def. 8.4 (Π-diversity): primary witness for at least one criterion that
  no other witness covers.

- **Adapter implementations.** Each adapter requires: (a) a parser from
  the source format into the typecarta AST, (b) an encoding function
  from the AST into the source format, (c) a semantic evaluator or
  test-value oracle for checking extension equality.

- **Encoding-check witness pairs.** Concrete schema pairs for ρ_W, ρ_D,
  ρ_G across multiple source languages.

- **Formal verification.** The proof sketches in §10 are exactly that —
  sketches. Machine-checked proofs (e.g., in Lean or Agda) would
  strengthen the foundation substantially.

## License

TBD — likely MIT or Apache-2.0 for the toolkit, CC-BY-SA-4.0 for the
specification document.
