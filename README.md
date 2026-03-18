---
disclaimer: >
  NO INFORMATION WITHIN THIS DOCUMENT SHOULD BE TAKEN FOR GRANTED.
  Any statement or premise not backed by a real logical definition or a
  verifiable reference may be invalid, erroneous, or a hallucination.
---

# TypeCarta

**A formal framework for measuring, comparing, and reasoning about the expressive power of schema Intermediate Representations.**

TypeCarta answers a question that currently has no formal answer: *When someone says a schema IR "supports" intersection types or "handles" recursive schemas — what does that actually mean, and how would you verify it?*

---

## The Problem

Schema languages — JSON Schema, Zod, TypeScript's type system, Protobuf, Avro, OpenAPI — each describe data shapes with different capabilities. Tools that translate between them (code generators, validators, API gateways, schema registries) implicitly make claims about preserving meaning across these boundaries. But there is no formal framework for evaluating whether those claims hold.

The existing literature formalizes individual languages in isolation:
- Pezoa et al. (WWW 2016) gave JSON Schema its first formal semantics
- Attouche et al. (POPL 2024) proved Modern JSON Schema validation is PSPACE-complete
- Frisch, Castagna & Benzaken (JACM 2008) established decidable semantic subtyping with full Boolean connectives

**No published work bridges these to ask**: given a source schema language and a target IR, which phenomena survive translation? Which are lost? Which are fundamentally impossible to preserve?

## The Specification

The core artifact is the **[Schema IR Expressiveness — Formal Specification](spec/schema-ir-expressiveness-map.md)** (v2.2.0), which defines:

| Component | What it does | Section |
|---|---|---|
| **Semantic Foundation** | Types as predicates on a shared value universe; subtyping as extension inclusion | §2–§3 |
| **Encoding Relations** | Formal definitions of sound, complete, and faithful schema encodings | §5 |
| **Impossibility Boundary** | Proof that no finite IR is semantically universal; Rice-style argument for the decidable case | §7 |
| **Criterion Set Π** | 70 orthogonal criteria across 22 families capturing structural and semantic phenomena | §8, §12 |
| **Core Subset Π_core** | 15 independently testable criteria, each with a witness schema | §9 |
| **Completeness & Minimality** | Proofs that the witness set is Π_core-complete and diverse | §10 |
| **IR Scorecard** | Evaluation of JSON Schema draft-07, Zod, and TypeScript 5.x against Π_core | §11 |
| **Encoding-Check Layer** | Binary predicates testing whether an encoding preserves subtyping relationships | §13 |

### Key Results

1. **No finite IR can model all schema languages** (Prop. 7.1) — every expressiveness claim must name its target class explicitly.

2. **Combining recursive types (μ), complement (¬), and parametric polymorphism (Λ) creates a decidability hazard** — an IR admitting all three must prove its type equivalence procedure terminates (Remark 7.1.2, citing Castagna & Xu 2011).

3. **TypeScript 5.x scores 12✓ / 2 partial / 1✗ on the 15-criterion core**; Zod scores 11✓ / 2 partial / 2✗; JSON Schema draft-07 scores 7✓ / 5 partial / 3✗. No production IR satisfies higher-kinded type parameters (π₃₂) natively.

## Status

**Draft.** This is a v2.2.0 specification with 20 references, 28 formal definitions, and proof sketches for all theorems. It has not been peer-reviewed. All scorecard entries are estimates derived from publicly documented behavior, not machine-verified.

The document carries a standing disclaimer: no information within should be taken for granted; any claim not backed by a formal definition or verifiable reference may be invalid.

## Quick Start

```bash
# Prerequisites: Node.js >= 20, pnpm >= 9

# Install dependencies
pnpm install

# Build all packages (topological order via Turborepo)
pnpm build

# Run all tests
pnpm test

# Run tests with coverage
pnpm --filter @typecarta/core exec vitest run --coverage

# Lint / format check
pnpm check

# Generate API docs (output: docs/api/)
pnpm docs
```

## CLI Usage

```bash
# Score an IR against the core 15 criteria (default)
typecarta scorecard --adapter json-schema

# Score against all 70 criteria
typecarta scorecard --adapter json-schema --mode full

# Compare two IRs side by side
typecarta compare --left json-schema --right zod --output table

# Print a witness schema
typecarta witness --criterion pi-07
# => S₇ = μalpha. {value: string, children: alpha[]}

# Profile a schema file against the expanded 70 criteria
typecarta profile --schema ./my-schema.ts

# Check encoding precision (subtyping preservation)
typecarta check-encoding --source json-schema --target zod
```

## Packages

| Package | Description | Dependencies |
|---|---|---|
| `@typecarta/core` | AST, semantics, criteria, encoding, scorecard, adapter interface | none |
| `@typecarta/witnesses` | Diverse schema sets (C, witness pairs) | core |
| `@typecarta/encoding-check` | Relational property evaluator (ρ checks) | core |
| `@typecarta/cli` | Command-line interface | core, witnesses |
| `@typecarta/adapter-json-schema` | JSON Schema draft-07 adapter | core |
| `@typecarta/adapter-zod` | Zod adapter | core |
| `@typecarta/adapter-typescript` | TypeScript 5.x type system adapter | core |
| `@typecarta/adapter-protobuf` | Protobuf adapter | core |
| `@typecarta/adapter-avro` | Avro adapter | core |
| `@typecarta/adapter-graphql` | GraphQL adapter | core |
| `@typecarta/adapter-effect-schema` | Effect Schema adapter | core |

## Architecture

```
typecarta/
├── packages/
│   ├── core/                       @typecarta/core
│   │   ├── src/ast/                TypeTerm (16 node kinds), Signature, traversal
│   │   ├── src/semantics/          Value universe, extension, subtyping, denotation
│   │   ├── src/criteria/
│   │   │   ├── pi/                 15 core criteria (π₁–π₁₅), Π_core (§9)
│   │   │   └── pi-prime/           70 expanded criteria (π'₁–π'₇₀), 22 families (A–V)
│   │   ├── src/encoding/           Soundness, completeness, faithfulness, models
│   │   ├── src/scorecard/          Evaluate, compare, render
│   │   ├── src/encoding-check/     ρ_W, ρ_D, ρ_G, ρ_B subtyping precision
│   │   ├── src/universality/       Schema class, impossibility boundary
│   │   └── src/adapter/            IRAdapter<Sig, Native> interface, registry
│   ├── witnesses/                  Diverse schema sets C (15) and C_full (70)
│   ├── adapters/
│   │   ├── json-schema/            JSON Schema draft-07
│   │   ├── zod/                    Zod
│   │   ├── typescript/             TypeScript 5.x
│   │   ├── protobuf/               Protobuf
│   │   ├── avro/                   Avro
│   │   ├── graphql/                GraphQL
│   │   ├── effect-schema/          Effect Schema
│   │   └── _template/              Adapter scaffold for new IRs
│   ├── encoding-check/             Encoding-check runner and report
│   └── cli/                        Command-line interface
├── spec/                           Formal specification (v2.2.0)
├── docs/
│   ├── api/                        Generated API docs (typedoc)
│   ├── adr/                        Architecture Decision Records
│   ├── guides/                     Tutorials and how-tos
│   ├── faq.md                      Frequently asked questions
│   ├── glossary.md                 Term/symbol quick reference (from §14)
│   └── architecture.md             High-level architecture overview
├── examples/                       Runnable example projects
│   ├── basic-scorecard/            Score an IR with minimal setup
│   ├── ci-compatibility-gate/      Use TypeCarta as a CI gate
│   ├── custom-ir/                  Build and register a custom adapter
│   ├── llm-integration/            Feed scorecard output to an LLM
│   └── schema-migration/           Detect expressiveness loss during migration
├── benchmarks/                     Performance benchmarks
│   ├── adapter-coverage/
│   ├── encoding-fidelity/
│   └── scorecard-perf/
└── bin/                            Repo tooling scripts
```

## Key Design Decisions

- **Discriminated union AST** with exhaustive `TypeTermVisitor<R>` — adding
  a node kind is a compile-time error everywhere (ADR-002).
- **Generic adapter interface** `IRAdapter<Sig, Native>` — type-safe at the
  boundary between source format and AST.
- **Knaster-Tarski fixpoint** for μ node denotation — addresses the
  compositionality gap noted in the spec review.
- **Decidability hazard detection** — statically flags μ + ¬ + Λ
  combinations per §7 Remark 7.1.2.
- **Spec is sovereign** — every type, function, and constant traces back to
  a numbered definition in the formal specification.

See [docs/adr/](docs/adr/) for all Architecture Decision Records.

## Documentation

| Resource | Description |
|---|---|
| [Formal Specification](spec/schema-ir-expressiveness-map.md) | The mathematical foundation (v2.2.0) |
| [Architecture Overview](docs/architecture.md) | High-level system design |
| [FAQ](docs/faq.md) | Common questions answered |
| [Glossary](docs/glossary.md) | Terms and symbols from §14 |
| **Guides** | |
| [Reading the Scorecard](docs/guides/reading-the-scorecard.md) | Interpret scorecard output |
| [Writing an Adapter](docs/guides/writing-an-adapter.md) | Implement a new IR adapter |
| [Criterion Independence](docs/guides/criterion-independence.md) | How criteria avoid overlap |
| [Meta-Tags Explained](docs/guides/meta-tags-explained.md) | What meta-tags mean and how they work |

## Writing an Adapter

```typescript
import type { IRAdapter, Signature, TypeTerm } from "@typecarta/core";
import { createSignature } from "@typecarta/core";

const MY_SIG = createSignature(
  ["string", "number", "boolean"],
  [{ name: "product", arity: 1 }, { name: "array", arity: 1 }],
);

export class MyAdapter implements IRAdapter<Signature, MyNativeFormat> {
  readonly name = "My Schema Language";
  readonly signature = MY_SIG;

  parse(source: MyNativeFormat): TypeTerm { /* ... */ }
  encode(term: TypeTerm): MyNativeFormat { /* ... */ }
  isEncodable(term: TypeTerm): boolean { /* ... */ }
  inhabits(value: unknown, term: TypeTerm): boolean { /* ... */ }
}
```

See the full guide at [docs/guides/writing-an-adapter.md](docs/guides/writing-an-adapter.md) or use `packages/adapters/_template/` as a starting point.

## Criterion Coverage

| Set | Criteria | Families | Witnesses | Scorecard | Status |
|---|---|---|---|---|---|
| Π_core | 15 | — | C (15 schemas) | §11 (3 IRs) | Implemented + tested |
| Π' | 70 | 22 (A–V) | C_full (70 schemas) | §11.1 (3 IRs) | Implemented + tested |
| ρ (encoding-check) | 4 | — | 3 witness pairs | — | Implemented + tested |

## Spec Traceability

| Spec section | Implementation |
|---|---|
| §2 Semantic Foundation | `core/src/semantics/` |
| §3 Schema Language | `core/src/ast/` |
| §4 IR | `core/src/adapter/interface.ts` |
| §5 Encoding & Modeling | `core/src/encoding/` |
| §6 Universality | `core/src/universality/` |
| §7 Impossibility | `core/src/universality/impossibility.ts` |
| §8 Coverage Criteria | `core/src/criteria/types.ts` |
| §9 Diverse Schema Set | `witnesses/src/pi/` (core), `witnesses/src/pi-prime/` (full) |
| §10 Completeness Theorems | `witnesses/tests/diversity-check.test.ts` |
| §11 IR Scorecard | `core/src/scorecard/` |
| §11.1 Extended Scorecard (70) | `core/src/scorecard/evaluate.ts` (`evaluatePrimeScorecard`) |
| §12 Criterion Families (A–V) | `core/src/criteria/pi-prime/` |
| §12.5 Full Witness Set | `witnesses/src/pi-prime/` (C_full) |
| §13 Encoding-Check | `core/src/encoding-check/` |

## Relationship to Prior Work

The semantic foundation (§2–§3) follows Pierce (*Types and Programming Languages*, 2002) and Cardelli & Wegner (1985). Recursive type semantics uses Tarski's fixpoint theorem (1955). The encoding soundness/completeness definitions (§5) are structurally parallel to Cousot's abstract interpretation framework — a deliberate analogy, explicitly not a formal reduction.

The encoding relations (§5), universality definitions (§6), impossibility boundary (§7), criterion framework (§8), core subset and witness methodology (§9–§10), scorecard (§11), and encoding-check layer (§13) are original contributions. See the §1 provenance note for full attribution.

## References

The specification cites 20 publications. Key references:

1. Pierce. *Types and Programming Languages.* MIT Press, 2002.
2. Frisch, Castagna, Benzaken. "Semantic Subtyping." *JACM* 55(4), 2008.
3. Tarski. "A Lattice-Theoretical Fixpoint Theorem." *Pacific J. Math.* 5(2), 1955.
10. Kozen, Palsberg, Schwartzbach. "Efficient Recursive Subtyping." *MSCS* 5(1), 1995.
11. Pezoa, Reutter, Suárez, Ugarte, Vrgoč. "Foundations of JSON Schema." *WWW*, 2016.
20. Castagna, Xu. "Set-Theoretic Foundation of Parametric Polymorphism and Subtyping." *ICFP*, 2011.

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md).

The most valuable contributions right now are:

- **Scorecard verification**: Machine-checkable confirmation or refutation of any §11 cell value
- **Additional IR evaluations**: Scoring new IRs against Π_core (adapter template at `packages/adapters/_template/`)
- **Witness construction for Π \ Π_core**: The 55 criteria outside the core lack witness schemas (§12.5)
- **Citation corrections**: The bibliography has been revised twice; errors may remain

## License

[MIT](LICENSE)
