# Reading the Scorecard

## Structure

A scorecard is a filtered view over TypeCarta's criterion set. The default `core` filter has 15 rows; `--filter all` evaluates all 70 criteria across families A-V. The legacy alias `--mode full` is accepted for `--filter all`.

Each cell has one of three values:

| Value | Meaning |
|---|---|
| ✓ | The criterion is fully satisfied — the adapter can parse, encode, and evaluate the witness schema |
| partial | The criterion is partially supported — some operations succeed but not all |
| ✗ | The criterion is not satisfied — the adapter cannot represent the required type construct |

## Core Filter

The `core` filter contains the 15 canonical criteria formerly described as Π. In the current implementation these rows keep stable `pi-prime-NN` identifiers and are selected by a `core: true` flag.

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

Treat scorecards as adapter-backed evidence, not standalone proof that a language matches the formal specification. The evaluator checks whether each witness can be encoded, parsed back, and still satisfy the criterion predicate. It does not prove semantic faithfulness for the whole schema language.

For full 70-criterion mode, distinguish two claims:

- **Language capability**: whether the schema language can express the phenomenon under the specification.
- **Adapter capability**: whether the current TypeCarta adapter preserves that phenomenon through `encode -> parse`.

Use [Scorecard Spec Assessment](./scorecard-spec-assessment.md) when validating a scorecard against the specification.

## Comparison Mode

Use `typecarta compare --left <a> --right <b>` to see a side-by-side diff. Differences are highlighted, making it easy to identify expressiveness gaps when choosing or migrating between schema languages.
