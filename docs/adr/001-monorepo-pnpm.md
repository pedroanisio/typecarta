# ADR 001: Monorepo with pnpm Workspaces

## Status

Accepted

## Context

typecarta consists of multiple packages: a core evaluation engine, adapters for each schema language, a witness set library, an encoding-check evaluator, and a CLI. These packages have interdependencies but are published independently.

## Decision

Use a pnpm workspace monorepo with Turborepo for build orchestration and Biome for linting/formatting.

## Rationale

- **pnpm workspaces** — Strict dependency resolution prevents phantom dependencies. `workspace:*` protocol ensures cross-package references use local sources during development.
- **Turborepo** — Incremental builds with caching. The `build` task depends on `^build` (topological ordering), so changes propagate correctly.
- **Biome** — Single tool for both linting and formatting, faster than ESLint + Prettier.

## Alternatives Considered

- **npm/yarn workspaces** — Less strict dependency hoisting; pnpm's approach catches more issues pre-publish.
- **Nx** — More powerful but heavier; Turborepo's simplicity suits this project's scale.
- **Separate repos** — Cross-package changes would require coordinated PRs and version pinning.

## Consequences

- All packages share a single CI pipeline
- Version bumps will use changesets for independent publishing (tooling not
  yet installed — no `.changeset/` directory exists at time of writing)
- Contributors must use pnpm (enforced via `packageManager` field)
