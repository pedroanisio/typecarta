---
title: "Schema IR Expressiveness Map — Changelog"
---

# Changelog

This file mirrors the `changelog:` frontmatter field of
[schema-ir-expressiveness-map.md](schema-ir-expressiveness-map.md). The spec
document's frontmatter is the source of truth; update it first, then
re-synchronize this file.

## v2.2.0 (2026-03-18)

- Resolve C34: replaced misattributed [Ref. 2, §6] with [Ref. 20] (Castagna
  & Xu, ICFP 2011) in §7 Remark 7.1.2 and §12 π₅₉ warning; removed
  corresponding TODO comments.
- Added Remark 5.1.2 (shared-V assumption).
- Added Remark 13.5 (reduced-product caveat for encoding-check properties).
- Added Ref. 20 (Castagna & Xu 2011).

## v2.1.0 (2026-03-18)

- Bibliographic fixes: Ref. 9 author corrected (Yallop & White, not
  Kiselyov); Ref. 15 year corrected (2009, not 2010); Ref. 10 misattribution
  in §7 Remark 7.1.2 replaced with [Ref. 2, §6].
- Added Ref. 16 (Rice 1953) and Ref. 17 (Xi, Chen & Chen 2003, GADTs).
- Orphaned Ref. 9 and Ref. 15 now cited inline at S₁₅ and π₃₂. Citations
  carried forward to §12 π₅₉ warning.
- Added provenance note in §1 marking §5–§13 as original contributions.
- Added Remark 6.3.1 (forward-reference to §7).
- Added Remark 3.3.3 (LFP vs GFP).
- Added equi-recursive vs iso-recursive remark at π₂₅.
- Integrated "faithfully partial" into §11 scorecard cell definitions
  (sub-cases a/b/c).
- Strengthened Theorem 10.2 with 4 explicit pairwise separation witnesses.
- Expanded Remark 7.1.1 with precise Rice-style impossibility argument.
- Added §11 remark distinguishing formal framework from non-verified
  scorecard estimates.
- Used "faithfully partial" explicitly in per-cell justifications (S₈ Zod,
  S₁₀ JSON Schema).
- Tightened Theorem 10.2 with schema-language-level separation witnesses.
- Added Remark 8.2.1 (observational basis analogy to behavioural
  equivalence) with Ref. 18 (Milner 1989) and Ref. 19 (Sangiorgi & Walker
  2001).
- Restored Ref. 10 (Kozen) in Remark 7.1.2 for O(n²) decidable baseline.
- Sharpened provenance note with explicit Cousot abstract-interpretation
  parallel for Defs. 5.2–5.3.
- Expanded Remark 3.3.3 to cite Haskell coinductive types alongside JS
  cycles.
- Added $ref (equi) vs z.lazy() (iso) note at π₂₅.
- Added finite-scope clarification to S₁₄ per-cell justification.
- Version metadata corrected.

## v2.0.1 (2026-03-18)

- Added §15 References (15 entries); inserted [Ref. N] inline citations
  throughout. Existing parenthetical citation converted.

## v2.0.0 (2026-03-18)

Initial formal release.

- 15 base criteria (Π): π₁ Bottom through π₁₅ HKT
- 70 expanded criteria (Π'): organized into 22 families (A–V)
- Encoding framework: soundness, completeness, faithfulness, structure preservation
- Scorecard system with ✓/partial/✗ evaluation
- Schema class definitions and universality bounds
- Decidability analysis (§7)
- Encoding-check properties: ρ_W (width), ρ_D (depth), ρ_G (generic)
- Meta-tag system: meta-op, meta-coerce, meta-multi, meta-annot
- Formal glossary (§14) with 80+ definitions
- 19 references
- Rejected proposals: Q₂ (derivable), X₂ (out of scope), F₃ (already
  covered), DNF/CNF (complexity-profile concern).
