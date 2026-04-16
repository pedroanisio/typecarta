# Architecture

## Overview

typecarta is a monorepo toolkit for formally evaluating and comparing schema language expressiveness. It implements the framework described in the Schema IR Expressiveness Map specification (v2.2.0).

## Package Map

```
typecarta/
├── packages/
│   ├── core/                 @typecarta/core
│   │   ├── src/ast/          Type-term AST (Def. 3.1–3.3)
│   │   ├── src/semantics/    Value universe, extension, subtyping
│   │   ├── src/criteria/     Π (15) + Π' (70) criterion predicates
│   │   ├── src/encoding/     Encoding framework (Def. 5.1–5.6)
│   │   ├── src/scorecard/    Evaluation engine + renderers
│   │   ├── src/encoding-check/ Property evaluators (§13)
│   │   ├── src/universality/ Schema classes + bounds (§6–7)
│   │   └── src/adapter/      IRAdapter contract + registry
│   │
│   ├── witnesses/            @typecarta/witnesses
│   │   ├── src/pi/           15 base witness schemas (ℂ)
│   │   └── src/pi-prime/     70 expanded witness schemas (ℂ')
│   │
│   ├── adapters/             One package per schema language
│   │   ├── json-schema/      @typecarta/adapter-json-schema
│   │   ├── zod/              @typecarta/adapter-zod
│   │   ├── typescript/       @typecarta/adapter-typescript
│   │   ├── protobuf/         @typecarta/adapter-protobuf
│   │   ├── graphql/          @typecarta/adapter-graphql
│   │   ├── effect-schema/    @typecarta/adapter-effect-schema
│   │   ├── avro/             @typecarta/adapter-avro
│   │   └── _template/        Scaffold for new adapters
│   │
│   ├── encoding-check/       @typecarta/encoding-check
│   │   ├── src/runner.ts     Cross-adapter ρ evaluator
│   │   ├── src/report.ts     Report generator
│   │   └── src/strategies/   exact + sampling strategies
│   │
│   └── cli/                  @typecarta/cli → `typecarta`
│       ├── src/commands/     scorecard, compare, witness, profile, check-encoding
│       └── src/output/       terminal, markdown, json formatters
│
├── spec/                     Formal specification (CC-BY-SA-4.0)
├── docs/                     Documentation
├── benchmarks/               Performance benchmarks
├── bin/                      Repo-maintenance scripts
└── examples/                 Worked examples
```

## Design Principles

1. **Spec is sovereign** — The formal specification is the single source of truth. All implementation decisions trace back to numbered definitions.

2. **Core is adapter-agnostic** — `@typecarta/core` has zero runtime dependencies and knows nothing about specific schema languages. Adapters bridge the gap.

3. **Witnesses are data, not code** — Witness schemas are declarative TypeTerm values, not procedural test logic. They can be serialized, diffed, and composed.

## Data Flow

```
Schema Document → Adapter.parse() → TypeTerm AST
                                         │
                    ┌────────────────────┤
                    ↓                    ↓
            Criterion π(S)        Encoding φ(S)
                    │                    │
                    ↓                    ↓
            Scorecard Cell     Encoding-Check ρ
                    │                    │
                    └────────┬───────────┘
                             ↓
                     Render (MD/JSON/TTY)
```

## Key Abstractions

- **TypeTerm** — AST node representing any type expression (Def. 3.2)
- **Signature** — A schema language's base types + constructors (Def. 3.1)
- **IRAdapter** — Contract connecting a real-world schema language to the AST
- **CriterionPredicate** — Decidable predicate π : 𝒯(Σ) → {⊤, ⊥} (Def. 8.1)
- **Encoding** — Translation function φ : 𝒯(Σ) → 𝒩ᵣ (Def. 5.1)
- **Extension** — Set of values a type admits: ⟦τ⟧ ⊆ 𝒱 (Def. 2.2)
