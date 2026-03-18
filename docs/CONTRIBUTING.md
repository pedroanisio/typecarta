# Contributing to typecarta

## Getting Started

```bash
git clone <repo-url>
cd typecarta
pnpm install
pnpm build
pnpm test
```

## Development Workflow

1. Create a feature branch from `main`
2. Make changes in the relevant package(s)
3. Run `pnpm test` to verify all tests pass
4. Run `pnpm check` (biome) for lint/format
5. Open a PR against `main`

## Monorepo Structure

This project uses **pnpm workspaces** + **Turborepo** for build orchestration.

- `packages/core/` — Zero-dependency evaluation engine
- `packages/witnesses/` — Diverse schema sets
- `packages/adapters/<name>/` — Per-language adapters
- `packages/encoding-check/` — Encoding property evaluator
- `packages/cli/` — Command-line interface

## Writing an Adapter

See [docs/guides/writing-an-adapter.md](guides/writing-an-adapter.md) for a full guide. In short:

1. Copy `packages/adapters/_template/` to `packages/adapters/<name>/`
2. Implement the `IRAdapter<Sig, Native>` interface
3. Add conformance tests
4. Register your adapter in the CLI

## Adding a Criterion

All criteria live in `packages/core/src/criteria/`. Base criteria (Π) are in `pi/`, expanded (Π') are in `pi-prime/`.

Each criterion must:
- Have a unique ID (`pi-NN` or `pi-prime-NN`)
- Implement the `evaluate(term: TypeTerm)` method
- Return `{ status: "satisfied", witness }` or `{ status: "not-satisfied", reason }`

## Code Style

- TypeScript strict mode
- Biome for formatting (tabs, 100-char lines)
- No runtime dependencies in `@typecarta/core`
- Vitest for all tests

## Commit Messages

Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
