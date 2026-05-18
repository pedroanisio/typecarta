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

All criteria live in `packages/core/src/criteria/pi-prime/`. The canonical 15-criterion core subset is identified by `core: true` on a criterion, not by a separate directory or ID namespace.

Each criterion must:
- Have a unique ID (`pi-prime-NN`, zero-padded)
- Implement the `evaluate(term: TypeTerm)` method
- Return `{ status: "satisfied", witness }`, `{ status: "not-satisfied", reason }`, or `{ status: "undecidable", reason }`

Use `not-satisfied` when the term lacks the phenomenon. Use `undecidable` when the predicate cannot decide with the information available to the criterion.

## Code Style

- TypeScript strict mode
- Biome for formatting (tabs, 100-char lines)
- No runtime dependencies in `@typecarta/core`
- Vitest for all tests

## Commit Messages

Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
