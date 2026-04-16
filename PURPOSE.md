---
disclaimer:
  notice: >-
    No information within this document should be taken for granted.
    Any statement or premise not backed by a real logical definition
    or verifiable reference may be invalid, erroneous, or a hallucination.
  generated_by: "GPT-5 via Codex"
  date: "2026-04-16"
---

# TypeCarta

## Why We Built This

We believe schema migrations, interoperability claims, and tooling promises should not depend on vibes. Teams move critical data through validators, code generators, registries, and API layers every day, yet they are still asked to trust vague claims like "supports unions" or "preserves meaning" without a rigorous way to inspect what survives translation and what is lost.

That gap creates avoidable risk. A system can appear compatible while quietly narrowing what data means, dropping distinctions, or making one schema language look stronger than it really is. TypeCarta exists to make those losses visible, discussable, and testable before they turn into broken contracts or false confidence.

---

## How We Approach This

- **Formal meaning before implementation** — We start from explicit semantics and named criteria, not marketing labels or intuition.
- **Comparison through evidence** — We use witness schemas, scorecards, and encoding checks so claims can be inspected instead of asserted.
- **Adapter neutrality** — The core framework should evaluate many schema languages without privileging one ecosystem's vocabulary.
- **Traceability over convenience** — The specification is the source of truth; implementation should be explainable against it.
- **Boundaries must be named** — We do not optimize for pretending every schema language can express everything. Limits and impossibility results are part of the product.

---

## What It Does

### Core Capabilities

- Defines a formal framework for reasoning about schema expressiveness across languages and intermediate representations.
- Evaluates adapters against shared criteria so teams can compare what different schema systems can represent.
- Checks whether translations preserve important relationships, making expressiveness loss easier to detect during migration or integration work.

### What This Is Not

This project does **not**:

- promise perfect translation between all schema languages
- replace domain-specific schema design or governance decisions
- treat scorecards as unquestionable truth independent of definitions, evidence, and review

---

## Who This Is For

- **Tool builders** — to justify what their adapters preserve, approximate, or cannot support.
- **Platform and data teams** — to evaluate migration risk before moving schemas between systems.
- **Researchers and standards-minded engineers** — to discuss schema expressiveness with shared definitions instead of loose terminology.
