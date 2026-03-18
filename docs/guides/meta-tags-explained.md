# Meta-Tags Explained

## What Are Meta-Tags?

Some criteria require information beyond the pure extension ⟦τ⟧ ⊆ 𝒱. Meta-tags mark these criteria so adapters and tooling can handle them appropriately.

## The Four Meta-Tags

| Tag | Meaning | Example |
|---|---|---|
| `meta-op` | Requires operational subtyping (≤_op) | Nominal subtyping: two types may have the same extension but different identities |
| `meta-coerce` | Requires coercion semantics | Implicit widening: `int → float` is allowed even though ⟦int⟧ ⊈ ⟦float⟧ |
| `meta-multi` | Requires multi-phase evaluation | Template literals: resolved at type-checking time, not at value level |
| `meta-annot` | Requires annotation/metadata inspection | Deprecation markers, documentation, serialization hints |

## How They Affect Scoring

When a criterion carries a meta-tag, the scorecard evaluator may need additional information from the adapter:

- **meta-op**: The adapter must implement `operationalSubtype(a, b)` for accurate scoring
- **meta-coerce**: Extension-based checks alone are insufficient; the adapter signals coercion support
- **meta-multi**: Multi-phase resolution is approximated or requires adapter-specific hooks
- **meta-annot**: The criterion checks for annotation presence, not value-level semantics

## Impact on Adapters

An adapter that only implements `parse`, `encode`, `isEncodable`, and `inhabits` can still score all non-meta criteria correctly. Meta-tagged criteria default to "partial" if the adapter lacks the required capability.

To fully support meta-tagged criteria, implement the optional `operationalSubtype` method and ensure `parse` preserves annotation metadata in the AST's `annotations` field.
