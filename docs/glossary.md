# Glossary

Quick reference derived from the formal specification (§14).

| Term | Symbol | Definition |
|---|---|---|
| Value Universe | 𝒱 | The set of all runtime values (Def. 2.1) |
| Extension | ⟦τ⟧ | The set of values inhabiting type τ (Def. 2.2) |
| Subtyping | ≤ | Extension inclusion: τ ≤ σ ⟺ ⟦τ⟧ ⊆ ⟦σ⟧ (Def. 2.3) |
| Operational Subtyping | ≤_op | The IR's built-in assignability judgment (Def. 2.4) |
| Signature | Σ | Base types B + constructors C with arities (Def. 3.1) |
| Type Term | 𝒯(Σ) | AST of type expressions over Σ (Def. 3.2) |
| Denotation | ⟦·⟧_Σ | Compositional mapping from terms to extensions (Def. 3.3) |
| Encoding | φ | Translation function: 𝒯(Σ) → 𝒩ᵣ (Def. 5.1) |
| Soundness | — | φ preserves extensions: ⟦φ(τ)⟧ ⊆ ⟦τ⟧ (Def. 5.2) |
| Completeness | — | φ reflects extensions: ⟦τ⟧ ⊆ ⟦φ(τ)⟧ (Def. 5.3) |
| Faithfulness | — | Sound ∧ Complete (Def. 5.4) |
| Structure Preservation | — | Monotonicity: τ ≤ σ ⟹ φ(τ) ≤ φ(σ) (Def. 5.5) |
| Models | ℛ ⊨ ℒ | R models L if every L-schema has a faithful encoding in R (Def. 5.6) |
| Schema Class | 𝕊 | Subset of 𝒯(Σ) closed under relevant operations (Def. 6.1) |
| Criterion | π | Decidable predicate: π : 𝒯(Σ) → {⊤, ⊥} (Def. 8.1) |
| Diverse Set | ℂ | A set of schemas that is Π-diverse (Def. 8.4) |
| Scorecard | — | Tabular result of evaluating criteria against an adapter (§11) |
| Meta-Tag | — | Annotation for criteria needing enriched semantics (§9) |
| Encoding-Check | ρ | Property of the encoding function evaluated on witness pairs (§13) |
| Width Preservation | ρ_W | Subtyping preserved under record widening (Def. 13.2) |
| Depth Preservation | ρ_D | Subtyping preserved under nesting (Def. 13.3) |
| Generic Preservation | ρ_G | Subtyping preserved under generic instantiation (Def. 13.4) |
