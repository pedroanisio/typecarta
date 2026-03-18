# typecarta

A formal framework for reasoning about the **expressive power** of schema
Intermediate Representations (IRs) relative to a class of source schema
languages.

typecarta implements the theory described in the
[Schema IR Expressiveness Specification](spec/schema-ir-expressiveness-map.md)
(v2.1.0) as a TypeScript monorepo with zero runtime dependencies in the
core package.

## What it does

- Defines a **16-kind AST** (`TypeTerm`) covering every type-level operator
  from the spec (Def. 3.2 + Remark 3.2.1), including fixpoint, complement,
  keyof, conditional, mapped, and row-polymorphic types.
- Evaluates IRs against **70 criteria** (set $\Pi$, §8 + §12) across
  22 families (A–V), with a **15-criterion core subset** $\Pi_{\mathrm{core}}$ (§9).
- Checks **encoding properties** (Defs. 5.1-5.6): soundness, completeness,
  faithfulness, and structure preservation.
- Evaluates **subtyping precision** via the encoding-check layer (§13):
  width ($\rho_W$), depth ($\rho_D$), generic ($\rho_G$), and backward
  compatibility ($\rho_B$) preservation.
- Produces **scorecards** comparing IRs side-by-side in Markdown, JSON, or
  terminal output — supports both the 15-criterion core and the full
  70-criterion $\Pi'$ evaluation.
- Ships with both diverse schema sets: $\mathbb{C} = \{S_1, \ldots, S_{15}\}$
  (§9, core) and $\mathbb{C}_{\mathrm{full}} = \{S'_1, \ldots, S'_{70}\}$
  (§12.5, full) as declarative TypeScript constants.

## Packages

| Package | Description | Dependencies |
|---|---|---|
| `@typecarta/core` | AST, semantics, criteria, encoding, scorecard, adapter interface | none |
| `@typecarta/witnesses` | Diverse schema sets ($\mathbb{C}$, witness pairs) | core |
| `@typecarta/adapter-json-schema` | JSON Schema draft-07 adapter | core |
| `@typecarta/encoding-check` | Relational property evaluator ($\rho$ checks) | core |
| `@typecarta/cli` | Command-line interface | core, witnesses |

## Quick start

```bash
# Prerequisites: Node.js >= 20, pnpm >= 9

# Install dependencies
pnpm install

# Build all packages (topological order via turborepo)
pnpm build

# Run all tests
pnpm test

# Run tests with coverage
pnpm --filter @typecarta/core exec vitest run --coverage

# Generate API docs (output: docs/api/)
pnpm docs
```

## CLI usage

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

## Architecture

```
typecarta/
├── packages/
│   ├── core/                  @typecarta/core
│   │   ├── src/ast/           TypeTerm (16 node kinds), Signature, traversal
│   │   ├── src/semantics/     Value universe, extension, subtyping, denotation
│   │   ├── src/criteria/
│   │   │   ├── pi/            15 core criteria (π₁–π₁₅), core subset Π_core (§9)
│   │   │   └── pi-prime/      70 expanded criteria (π'₁–π'₇₀), 22 families (A–V)
│   │   ├── src/encoding/      Soundness, completeness, faithfulness, models
│   │   ├── src/scorecard/     Evaluate, compare, render
│   │   ├── src/encoding-check/  ρ_W, ρ_D, ρ_G, ρ_B subtyping precision
│   │   ├── src/universality/  Schema class, impossibility boundary
│   │   └── src/adapter/       IRAdapter<Sig, Native> interface, registry
│   ├── witnesses/             Diverse schema sets C (15) and C_full (70)
│   ├── adapters/json-schema/  JSON Schema draft-07 adapter
│   ├── encoding-check/        Encoding-check runner and report
│   └── cli/                   Command-line interface
├── docs/api/                  Generated API docs (typedoc)
└── docs/adr/                  Architecture Decision Records
```

## Key design decisions

- **Discriminated union AST** with exhaustive `TypeTermVisitor<R>` — adding
  a node kind is a compile-time error everywhere (ADR-002).
- **Generic adapter interface** `IRAdapter<Sig, Native>` — type-safe at the
  boundary between source format and AST.
- **Knaster-Tarski fixpoint** for $\mu$ node denotation — addresses the
  compositionality gap noted in the spec review.
- **Decidability hazard detection** — statically flags $\mu + \neg + \Lambda$
  combinations per §7 Remark 7.1.2.
- **Spec is sovereign** — every type, function, and constant traces back to
  a numbered definition in the formal specification.

## Criterion coverage

| Set | Criteria | Families | Witnesses | Scorecard | Status |
|---|---|---|---|---|---|
| $\Pi_{\mathrm{core}}$ | 15 | — | $\mathbb{C}$ (15 schemas) | §11 (3 IRs) | Implemented + tested |
| $\Pi'$ | 70 | 22 (A–V) | $\mathbb{C}_{\mathrm{full}}$ (70 schemas) | §11.1 (3 IRs) | Implemented + tested |
| $\rho$ (encoding-check) | 4 | — | 3 witness pairs | — | Implemented + tested |

## Test coverage

| Metric | Value |
|---|---|
| Test files | 21 |
| Tests | 756 |
| Statements | > 94% (core src/) |
| Branches | > 82% (core src/) |
| Functions | 100% (core src/) |

## Spec traceability

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
| §12.5 Full Witness Set | `witnesses/src/pi-prime/` ($\mathbb{C}_{\mathrm{full}}$) |
| §13 Encoding-Check | `core/src/encoding-check/` |

## Writing an adapter

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

## License

MIT
