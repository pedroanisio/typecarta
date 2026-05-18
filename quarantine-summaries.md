---
generated_by: doc-hygiene
generated_at: 2026-05-18
status: quarantine-summary
disclaimer: "Generated from the live repository state. Verify before moving or deleting documentation."
---

# Quarantine Summaries

No documentation files are recommended for quarantine.

The drift findings from `doc-hygiene-report.md` were remediated in place on 2026-05-18. The no-quarantine decision still stands.

## Why This Is A No-Op

The audit found drift, but not dead documentation. The stale files are still active entry points or formal records, so moving them would hide useful context and make the repository harder to repair.

## Not Quarantined

| Path | Reason |
|---|---|
| `spec/schema-ir-expressiveness-map.md` | Formal source document. It needs targeted updates where future-work claims are stale. |
| `README.md` | Main project entry point. It needs CLI and witness-path corrections. |
| `docs/architecture.md` | Active architecture overview. It needs path updates after witness consolidation. |
| `docs/conceptual-analysis.md` | Useful conceptual map. It needs a refresh, not archival. |
| `docs/guides/reading-the-scorecard.md` | Active user guide. It needs to distinguish `core` and `all` scorecard filters earlier. |
| `docs/api/` | Ignored TypeDoc output. Regenerate or clear as build output; do not quarantine as source docs. |
| `coverage/` | Ignored coverage output. Regenerate or clear as build output; do not quarantine as source docs. |
| `spec/future/*.md` | Explicitly future-scoped proposal notes. |
| `docs/adr/*.md` | Architecture decision records are historical by design. |

## Follow-Up

Prioritize correcting the drift findings in `doc-hygiene-report.md` before considering any archival action.
