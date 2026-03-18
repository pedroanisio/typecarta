# Reading the Scorecard

## Structure

A scorecard is a 15-row table (one per base criterion π₁–π₁₅) with three possible cell values:

| Value | Meaning |
|---|---|
| ✓ | The criterion is fully satisfied — the adapter can parse, encode, and evaluate the witness schema |
| partial | The criterion is partially supported — some operations succeed but not all |
| ✗ | The criterion is not satisfied — the adapter cannot represent the required type construct |

## Base Criteria (Π)

| # | Criterion | What it tests |
|---|---|---|
| π₁ | Bottom | Can the IR express an uninhabited type (∅)? |
| π₂ | Top | Can the IR express the universal type (𝒱)? |
| π₃ | Unit | Can the IR express a singleton type (|⟦S⟧| = 1)? |
| π₄ | Product | Labeled record/struct with named fields? |
| π₅ | Sum | Tagged or untagged union? |
| π₆ | Intersection | Structural intersection of types? |
| π₇ | Direct Recursion | Self-referential type (μ X. F(X))? |
| π₈ | Mutual Recursion | Two types referring to each other? |
| π₉ | Parametric | Generic/polymorphic type (∀α. T(α))? |
| π₁₀ | Refinement | Predicate-constrained type (e.g., number > 0)? |
| π₁₁ | Optionality | Optional/nullable fields? |
| π₁₂ | Nominal | Opaque or branded type identity? |
| π₁₃ | Open Shape | Extensible record allowing extra fields? |
| π₁₄ | Dependent | Value-dependent typing? |
| π₁₅ | HKT | Higher-kinded types (∀F: * → *. ...)? |

## Interpreting Results

A scorecard with all ✓ means the schema language can express every fundamental type construct. In practice, most languages have a mix:

- **JSON Schema** typically scores well on π₁–π₇, π₁₀–π₁₁ but ✗ on π₉, π₁₂, π₁₄–π₁₅
- **TypeScript** covers most criteria but may show partial for π₁₄ (dependent types)
- **Protobuf** tends to ✗ on π₆ (intersection), π₁₀ (refinement), π₁₅ (HKT)

## Comparison Mode

Use `typecarta compare --left <a> --right <b>` to see a side-by-side diff. Differences are highlighted, making it easy to identify expressiveness gaps when choosing or migrating between schema languages.
