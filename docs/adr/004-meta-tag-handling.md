# ADR 004: Meta-Tag Handling

## Status

Accepted

## Context

Some criteria require information beyond pure set-theoretic extensions (⟦τ⟧ ⊆ 𝒱). For example, nominal type identity depends on operational subtyping (≤_op), not extension inclusion.

## Decision

Criteria that need enriched semantics carry a `meta` tag from the set `{meta-op, meta-coerce, meta-multi, meta-annot}`. The scorecard evaluator checks for adapter support of the required capability and falls back to "partial" if unavailable.

## Rationale

- Keeps the core evaluation model (extension-based) clean and simple
- Explicitly marks where the model's assumptions break down
- Adapters opt into richer semantics incrementally via `operationalSubtype` and annotation preservation

## Consequences

- Non-meta criteria can be scored with any adapter that implements the base IRAdapter contract
- Meta-tagged criteria may produce "partial" for adapters that lack the required hook
- The meta taxonomy is extensible; new tags can be added as new semantic dimensions are identified
