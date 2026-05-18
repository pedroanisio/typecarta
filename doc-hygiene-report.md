---
generated_by: doc-hygiene
generated_at: 2026-05-18
status: remediated
disclaimer: "Generated from the live repository state. Verify findings before using them as release or compliance claims."
---

# Documentation Hygiene Report

## Executive Summary

TypeCarta's documentation is useful but split across several active sources of truth. The audit found drift between the formal spec, current witness layout, CLI behavior, and adapter scorecard assessment notes.

No documentation file has enough evidence to quarantine now. The repo has active docs that should be corrected, generated docs that should stay generated, and ignored output directories that should not be treated as maintained documentation.

## Remediation Status

Remediated on 2026-05-18:

- Updated the formal spec and spec changelog so §12.5 reflects the executable full witness set and 70-criterion scorecard mode.
- Updated README, architecture, contributing, scorecard-reading, and conceptual-analysis docs to use the unified criterion set, the derived core witness subset, current `pi-prime-NN` IDs, and `--filter all`.
- Expanded TypeDoc entrypoints and `tsconfig.docs.json` to include all concrete adapters and the CLI.
- Added `packages/cli/tests/documentation-consistency.test.ts` to guard the highest-risk drift surfaces.
- Updated benchmark scripts to use current `CORE_SCHEMAS`, `ALL_WITNESSES`, `CORE_CRITERIA`, and `CRITERIA` exports.

The original findings below are retained as audit history; they should now be read as resolved unless a regression test fails.

## Inventory

Discovered on 2026-05-18:

- 28 hand-maintained Markdown files, excluding `node_modules`, `dist`, `coverage`, and hidden directories.
- 308 ignored TypeDoc HTML files under `docs/api/`.
- 208 ignored coverage HTML files under `coverage/`.
- 13 workspace packages under `packages/*`, including 8 concrete adapters plus `_template`.
- 5 runnable example packages under `examples/*`.
- 1 benchmark workspace package under `benchmarks/`.

## Classification

| Class | Files / directories | Rationale |
|---|---:|---|
| Active | `README.md`, `PURPOSE.md`, `CLAUDE.md`, `DISCLAIMER.md`, `docs/CONTRIBUTING.md`, `docs/architecture.md`, `docs/faq.md`, `docs/glossary.md`, `docs/guides/*.md`, `benchmarks/README.md`, `examples/README.md`, `packages/adapters/_template/README.md` | Current project-facing and contributor-facing docs. Several are drifted but still active. |
| Active / architectural record | `docs/adr/*.md` | Decision records still explain current design choices. |
| Active / formal source | `spec/schema-ir-expressiveness-map.md`, `spec/changelog.md` | Formal specification and its changelog. The spec contains stale future-work text. |
| Active / future notes | `spec/future/*.md` | Explicitly scoped future work; no quarantine signal. |
| Generated / ignored | `docs/api/` | TypeDoc output. It is ignored by `.gitignore` and should be regenerated, not hand-edited. |
| Generated / ignored | `coverage/` | Test coverage output. It is ignored by `.gitignore` and should not be curated as documentation. |
| Drifted analysis doc | `docs/conceptual-analysis.md` | Still useful, but several file path and flow claims reflect an older layout. |
| Quarantine candidates | None | No discovered doc is clearly deprecated, orphaned, or unsafe to keep. |

## High Priority Findings (Resolved)

### 1. The formal spec still says the full witness set and 70-criterion scorecard are future work

Evidence:

- `spec/schema-ir-expressiveness-map.md:2029-2042` says a full diverse schema set covering all 70 criteria has not yet been constructed and that the full scorecard is missing.
- `README.md:233-235` says the 70-criterion `Pi'` witness set and scorecard are implemented and tested.
- `packages/witnesses/src/pi-prime/index.ts` aggregates the full witness list, and `packages/cli/src/commands/scorecard.ts:66-78` uses `ALL_WITNESSES` with `CRITERIA` for full mode.

Impact:

The spec is described elsewhere as sovereign, so stale "future work" language creates a direct trust problem. Users cannot tell whether the implementation has outrun the spec, or whether the implementation is claiming more than the spec permits.

Recommended fix:

Update `spec/schema-ir-expressiveness-map.md` section 12.5 and the related changelog to distinguish the formal framework from the now-implemented machine-applicable witness set. Keep any remaining caveats about scorecard estimates and adapter correctness.

### 2. Several docs point to deleted witness and criterion paths

Evidence:

- `README.md:248` maps the core witness set to `witnesses/src/pi/`, but that directory is absent. The live replacement is `packages/witnesses/src/core/index.ts`.
- `docs/architecture.md:23-24` documents `src/pi/` and `src/pi-prime/`; `src/pi/` is absent.
- `docs/conceptual-analysis.md:34` and `docs/conceptual-analysis.md:197` reference `witnesses/src/pi/` and `packages/witnesses/src/pi/s01-bottom.ts`; both are absent.
- `docs/CONTRIBUTING.md:42` says base criteria live in `packages/core/src/criteria/pi/`, but that directory is absent. The live criterion set is under `packages/core/src/criteria/pi-prime/`.

Impact:

New contributors will follow broken paths, and the docs obscure the current model: the 15 core criteria are now a flagged subset of the unified 70-criterion set, not a separate `pi/` tree.

Recommended fix:

Replace path references to `packages/witnesses/src/pi/` with `packages/witnesses/src/core/index.ts` for the derived core set, and describe `packages/witnesses/src/pi-prime/` as the physical source for all witness terms. Replace `packages/core/src/criteria/pi/` references with `packages/core/src/criteria/pi-prime/` plus the `core: true` flag.

### 3. README CLI examples contain an invalid witness criterion ID

Evidence:

- `README.md:98-100` shows `typecarta witness --criterion pi-07`.
- `packages/cli/src/commands/witness.ts:15-21` accepts `pi-prime-01 .. pi-prime-70`.
- `packages/cli/src/index.ts:48` also documents `typecarta witness --criterion <pi-prime-NN>`.

Impact:

The quick-start path includes a command that will fail for users.

Recommended fix:

Change the example to a real ID, for example `typecarta witness --criterion pi-prime-25` for direct recursion, or another core-flagged criterion from the unified ID set.

### 4. Scorecard docs mix old 15-row framing with the current core/full CLI model

Evidence:

- `docs/guides/reading-the-scorecard.md:5` says a scorecard is a 15-row table.
- The same guide later mentions full 70-criterion mode at `docs/guides/reading-the-scorecard.md:43-48`.
- `packages/cli/src/index.ts:46,54-55` documents `--filter core|all` and the legacy `--mode core/full` alias.
- `packages/cli/src/commands/scorecard.ts:1-7` describes the unified criterion set and legacy mode alias.

Impact:

The guide is directionally correct but structurally confusing: 15 rows is the default core filter, not the definition of a scorecard.

Recommended fix:

Rewrite the opening to define a scorecard as "a filtered view over the criterion set," with `core` producing 15 rows and `all` producing 70 rows.

### 5. TypeDoc output is ignored and stale relative to HEAD

Evidence:

- `.gitignore` ignores `docs/api/`.
- `typedoc.json:3-10` generates `docs/api` from only four entry points: core, witnesses, JSON Schema adapter, and encoding-check.
- Existing generated pages link to source commit `58e8267dca33a6d19ebb5e8137722de543a6f4e8`; current `HEAD` during the audit was `99843253fc15c56dcfa2afaab25b439010e68c5a`.
- `typedoc.json` does not include the CLI or the additional adapter packages.

Impact:

The local generated docs are useful for browsing, but should not be treated as current source documentation. The entrypoint list also means most adapters are omitted by design.

Recommended fix:

Decide whether `docs/api/` is a local generated artifact only or a publishable doc site. If it is publishable, add a freshness check: run `pnpm docs` and fail CI when `docs/api` changes. If it is local only, keep it ignored and document that readers should regenerate it.

## Medium Priority Findings (Resolved)

### 6. `docs/conceptual-analysis.md` is valuable but stale in multiple flow details

Evidence:

- `docs/conceptual-analysis.md:20` frames claims as settled by checking the relevant witness through round-trip; the newer assessment guide correctly cautions that scorecards are adapter-backed evidence, not full spec proof.
- `docs/conceptual-analysis.md:60-64` still describes 15-witness scorecard flow and profile behavior in ways that need checking against the current CLI.
- `docs/conceptual-analysis.md:197` recommends a deleted witness file as a reading path.

Impact:

This document is likely read as an orientation document. It should not teach old paths or oversell scorecard certainty.

Recommended fix:

Refresh it after the criterion/witness consolidation. Preserve the conceptual framing, but update source paths, CLI modes, and the adapter-vs-language correctness caveat.

### 7. Contributor guidance omits the `undecidable` criterion result

Evidence:

- `docs/CONTRIBUTING.md:45-47` lists only `satisfied` and `not-satisfied`.
- `packages/core/src/criteria/pi-prime/types.ts:126-129` defines `satisfied`, `not-satisfied`, and `undecidable`.

Impact:

Criterion authors may not know the third result exists and may encode uncertainty as a failure.

Recommended fix:

Update the criterion authoring section to include `undecidable`, and explain when it should be used versus `not-satisfied`.

### 8. Root contribution priorities conflict with implemented full witnesses

Evidence:

- `README.md:281` says the 55 criteria outside core lack witness schemas.
- The live witness package exposes all expanded witnesses through `packages/witnesses/src/pi-prime/index.ts` and derives `CORE_SCHEMAS` from `ALL_WITNESSES` in `packages/witnesses/src/core/index.ts`.

Impact:

The contribution list points contributors at work that appears already done.

Recommended fix:

Replace this with more precise work: adapter correctness audits, spec-cell adjudication, and regression tests that pin adapter-vs-language verdicts.

## Healthy Areas

- `benchmarks/README.md` correctly says the benchmark suite uses fixed fixtures and is not proof of formal coverage.
- `docs/guides/examples-and-benchmarks.md` correctly distinguishes smoke validation from semantic proof.
- `docs/guides/scorecard-spec-assessment.md` is the strongest current guide for interpreting scorecard output, especially its distinction between adapter holes and real language gaps.
- `examples/README.md` matches the current example package set.
- `packages/adapters/_template/README.md` remains a useful scaffold entry point.

## Quarantine Decision

No quarantine actions are recommended.

Reasoning:

- The stale files are still active documentation surfaces.
- The generated `docs/api/` and `coverage/` directories are already ignored and should be regenerated or deleted as build artifacts, not quarantined as historical docs.
- `spec/future/*.md` files are explicitly scoped as future proposals, so they are not orphaned.
- ADRs are historical records by nature and should not be moved just because implementation details changed.

See `quarantine-manifest.json`, `quarantine-summaries.md`, and `doc-quarantine.sh` for the explicit no-op quarantine proposal.

## Implemented Guardrails

1. Added a doc consistency test for high-risk deleted path references and README CLI examples.
2. Added a spec/implementation consistency test for the implemented full witness set claim.
3. Linked `docs/guides/scorecard-spec-assessment.md` from the README scorecard documentation table.
4. Expanded TypeDoc configuration to cover all concrete adapter packages and the CLI. `docs/api/` remains ignored generated output that should be regenerated with `pnpm docs`.

## Commands Used

```bash
find . -type f \( -name '*.md' -o -name '*.mdx' \) -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/coverage/*' -not \( -path '*/.*' -not -path './.github/*' \) | sort
find docs/api -type f -name '*.html' | wc -l
find coverage -type f \( -name '*.html' -o -name '*.md' \) | wc -l
find packages/witnesses/src packages/core/src/criteria -maxdepth 3 -type f | sort
find packages -maxdepth 3 -name package.json | sort
rg -n "DIVERSE_SCHEMAS|DIVERSE_PRIME_SCHEMAS|CORE_SCHEMAS|src/pi|src/core|witnesses/src/pi|witnesses/src/core|evaluateScorecard|evaluatePrimeScorecard" packages docs README.md benchmarks examples spec --glob '!docs/api/**' --glob '!coverage/**'
rg -n "scorecard|compare|witness|profile|check-encoding|adapters|default" packages/cli/src README.md docs examples --glob '!docs/api/**' --glob '!coverage/**'
git status --short
git rev-parse HEAD
```
