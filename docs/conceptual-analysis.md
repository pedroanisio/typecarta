---
title: "Conceptual Codebase Analysis — typecarta"
version: "1.0.0"
date: "2026-04-04"
methodology: "Conceptual Codebase Analysis v1.0"
disclaimer: >
  NO INFORMATION WITHIN THIS DOCUMENT SHOULD BE TAKEN FOR GRANTED.
  Any statement or premise not backed by a real logical definition or a
  verifiable reference may be invalid, erroneous, or a hallucination.
  This analysis is a hypothesis about the system's intent and design,
  not a verified theorem. Claims carry evidence levels (high/medium/low).
---

# Conceptual Codebase Analysis — typecarta

---

## 1. System Thesis

typecarta is a **metrological instrument for type systems**. It answers one question: "When someone claims an IR 'supports' a type-system feature, what does that *actually* mean — and can we measure it?" The system works by defining a formal specification that treats types as predicates over a value universe, constructing a universal AST rich enough to represent any type-theoretic phenomenon observable in real schema languages, and then measuring each schema language against 70 orthogonal criteria via witness schemas that exercise one capability each. The result is a scorecard — not an opinion, but a reproducible, criterion-by-criterion measurement of what an IR can and cannot faithfully encode. A reader who grasps this should predict: any new feature request will be evaluated by asking "which criterion does this exercise?", any new schema language will be integrated by writing an adapter that maps to the shared AST, and any claim about expressiveness will be settled by checking whether the encoding preserves the relevant criterion's witness through a round-trip.

---

## 2. Concept Atlas

### Core Ontology (13 concepts)

| # | Concept | Classification | Purpose | Primary Location | Stability |
|---|---------|---------------|---------|-----------------|-----------|
| 1 | **TypeTerm** | Domain | Universal AST — the Rosetta Stone all schema languages are translated into | `core/src/ast/type-term.ts` | Frozen (ADR-002: 16 node kinds, change is breaking) |
| 2 | **Signature** | Domain | Identity card of a schema language: its base types, constructors, and arities | `core/src/ast/signature.ts` | Stable |
| 3 | **Extension** | Domain | The set of values a type admits — ⟦τ⟧ ⊆ 𝒱 — the ground truth for "what does this type mean?" | `core/src/semantics/value-universe.ts` | Stable |
| 4 | **CriterionPredicate** | Domain | A decidable yes/no test for a single type-system capability (e.g., "does this IR support recursion?") | `core/src/criteria/types.ts` | Growing (15 core + 70 expanded, families A–V) |
| 5 | **Witness Schema** | Domain | A minimal type expression that exercises exactly one criterion — the test probe | `witnesses/src/pi/`, `witnesses/src/pi-prime/` | Growing (mirrors criterion set) |
| 6 | **Encoding** | Domain | A translation function φ that maps source types to IR types — the thing being measured | `core/src/encoding/encoding.ts` | Stable |
| 7 | **Scorecard** | Domain | The measurement output — a per-criterion ✓/partial/✗ matrix for an adapter | `core/src/scorecard/` | Stable |
| 8 | **IRAdapter** | Control | The plug-in boundary — connects a real-world schema language to the framework | `core/src/adapter/interface.ts` | Frozen (ADR-005: 4 mandatory + 1 optional method) |
| 9 | **Encoding-Check (ρ)** | Domain | Relational properties testing whether an encoding preserves subtyping | `core/src/encoding-check/` | Stable |
| 10 | **Impossibility Boundary** | Domain | The theorem that no finite IR can model all schema languages — the fundamental limit | `core/src/universality/impossibility.ts` | Frozen (mathematical result) |
| 11 | **MetaTag** | Control | Classification of criteria requiring enriched semantics beyond basic denotation | `core/src/criteria/types.ts` | Stable |
| 12 | **RefinementPredicate** | Domain | Value-level constraints embedded in refinement types — the bridge between types and runtime | `core/src/ast/type-term.ts` (§4) | Stable |
| 13 | **Schema Class** | Domain | A family of schema languages grouped by shared expressiveness — the universality target | `core/src/universality/schema-class.ts` | Stable |

### Absent Concepts

These are things the domain requires but the codebase does not (yet) reify:

- **Migration path**: The spec discusses schema evolution (§12 future work: session types, linear/affine, gradual typing), but there is no concept of "how do you get from IR version N to N+1?" *(Evidence: `spec/future/` contains proposals but no migration machinery. Confidence: medium.)*
- **Confidence interval on scorecard cells**: Cells are ✓/partial/✗ with no quantified uncertainty, despite the spec's own disclaimer that entries are "estimates, not machine-verified." *(Evidence: `ScorecardCell` has only `CellValue` and optional `justification`, no numeric confidence. Confidence: high.)*
- **Composition operator**: No way to compose two encodings φ₁ ∘ φ₂ to reason about multi-hop translations (e.g., Zod → TypeScript → JSON Schema). *(Evidence: `Encoding` interface has `encode` but no `compose` or `chain`. Confidence: medium.)*

---

## 3. Capability Map

### What the system can do

| Capability | Trigger | Entry Point | Key Decision Point | Failure Path |
|---|---|---|---|---|
| **Evaluate an IR's expressiveness** | User runs `typecarta scorecard --adapter <name>` | `cli/src/commands/scorecard.ts` → `evaluateScorecard()` | For each witness: is the schema encodable? Does the criterion survive round-trip? | `isEncodable() → false` yields ✗; encode/parse throws yields "partial" |
| **Compare two IRs** | `typecarta compare <a> <b>` | `cli/src/commands/compare.ts` → `compare()` | Diff per-criterion cells between two scorecards | Adapters must both be registered |
| **Construct witness types** | `typecarta witness <criterion>` | `cli/src/commands/witness.ts` | Look up witness by criterion ID | Unknown criterion ID |
| **Profile an adapter** | `typecarta profile <adapter>` | `cli/src/commands/profile.ts` | Full scorecard + encoding-check suite | Adapter not found in registry |
| **Check encoding fidelity** | `typecarta check-encoding <source> <target>` | `cli/src/commands/check-encoding.ts` → ρ evaluators | Width/depth/generic preservation tests | Source/target subtyping doesn't hold |
| **Detect decidability hazards** | Any type term containing μ + ¬ + Λ | `checkDecidabilityHazard()` in `universality/impossibility.ts` | Presence of all three operators | Returns warning string; does not block |
| **Parse native schema to AST** | Adapter `.parse()` | Each adapter's `adapter.ts` | Schema-language-specific parsing logic | Unparseable input |
| **Encode AST to native schema** | Adapter `.encode()` | Each adapter's `adapter.ts` | Type-term-specific encoding logic | Unencodable node kind |

---

## 4. Flow Narratives

### Flow 1: Scorecard Evaluation (user-facing, integrity-critical)

A developer wants to know how well Zod represents the full spectrum of type-system features. They run `typecarta scorecard --adapter zod`.

The CLI resolves the adapter from the registry by name. For each of the 15 core witness schemas (S₁ through S₁₅), the evaluator asks three questions in sequence. First: *can this adapter encode this witness at all?* It calls `adapter.isEncodable(witness)`. If false, the cell is immediately ✗ — this IR cannot represent this concept. Second: *does the concept survive a round-trip?* It encodes the witness to Zod's native form via `adapter.encode()`, then parses it back via `adapter.parse()`, producing a new TypeTerm. Third: *does the criterion predicate still detect the concept in the round-tripped form?* It calls `criterion.evaluate(roundTripped)`. If the predicate returns "satisfied", the cell is ✓. If "not-satisfied", the encoding lost something — the cell is "partial". If "undecidable", also "partial". The final scorecard aggregates all cells into totals (satisfied/partial/not-satisfied) and renders to terminal, Markdown, or JSON.

*(Evidence: `scorecard/evaluate.ts:66-115` implements this exact three-step protocol. `cli/src/commands/scorecard.ts` dispatches to it. Confidence: high.)*

### Flow 2: Encoding Soundness Verification (integrity-critical)

An adapter author wants to verify that their encoding φ doesn't admit values the source language would reject. The soundness checker iterates over test terms and test values. For each term, it encodes via φ, then checks: does the target evaluator accept any value that the source evaluator rejects? If so, the encoding over-approximates — it's unsound. Each violation records the term, encoded form, counterexample value, and reason.

This is a sampling-based heuristic, not a proof. The checker explicitly acknowledges this: exact equality of predicate-based extensions is undecidable. But it provides actionable feedback — "your JSON Schema encoding of refinement types accepts `{x: -1}` when the source Zod schema rejects negative numbers."

*(Evidence: `encoding/soundness.ts:39-65` implements the sample-based soundness check. `value-universe.ts:65-71` documents the heuristic limitation. Confidence: high.)*

### Flow 3: Decidability Hazard Detection (integrity-critical, most complex)

During any analysis that constructs or manipulates type terms, the system watches for a specific dangerous combination: a type containing fixpoint recursion (μ), complement (¬), and universal quantification (Λ) simultaneously. This combination, per §7 Remark 7.1.2, can render type equivalence undecidable.

The check is simple but architecturally significant: it traverses the TypeTerm AST via `collect()`, checking for the presence of each operator kind. If all three are present, it returns `isHazardous: true` with a warning referencing the spec section. The check does *not* block operations — it's advisory. This is a deliberate design choice: the system wants to measure expressiveness, not restrict it. But it ensures that anyone building encodings that combine these features knows they're in undecidable territory.

*(Evidence: `universality/impossibility.ts:17-41`. ADR-002 lines 61-62 explicitly state that first-class status for Complement enables this detection. Confidence: high.)*

### Flow 4: Width Subtyping Preservation Check (encoding-check layer)

When checking whether an encoding preserves width subtyping (ρ_W), the system takes a wide type (more fields) and a narrow type, encodes both through φ, evaluates their extensions in the target IR, and checks whether the subtyping relationship `⟦φ(wide)⟧ ⊆ ⟦φ(narrow)⟧` holds. If the encoding breaks this relationship, structural subtyping is lost — a record with more fields no longer substitutes for one with fewer.

*(Evidence: `encoding-check/rho-width.ts:21-41`. The pattern is replicated for depth (`rho-depth.ts`) and generic (`rho-generic.ts`) preservation. Confidence: high.)*

---

## 5. Boundary Contracts

### External Boundaries

| Boundary | Contract | Direction | Drift Risk |
|---|---|---|---|
| **Schema Language → Framework** | `IRAdapter<Sig, Native>` interface | Inbound | Low — frozen by ADR-005; 4+1 methods |
| **Framework → User** | CLI commands (scorecard, compare, witness, profile, check-encoding) | Outbound | Low — output formats are well-defined |
| **Framework → Spec** | TypeTerm AST maps to Def. 3.2; criteria map to §8/§12; encoding to §5 | Governing | Medium — spec is at v2.2.0, not yet peer-reviewed; changes could invalidate implementation |

### Internal Boundaries

| Boundary | Contract | Drift Risk |
|---|---|---|
| **AST ↔ Semantics** | TypeTerm nodes are input to `ExtensionEvaluator.evaluate()` and `inhabits()` | Low — types are structural |
| **Criteria ↔ Scorecard** | `CriterionPredicate.evaluate(TypeTerm) → CriterionResult` | Low — clean interface |
| **Core ↔ Witnesses** | Witnesses are plain TypeTerm values constructed via `core` builders | Low — data dependency only |
| **Core ↔ Adapters** | Adapters depend on `core` types but core knows nothing about adapters | Low — one-way dependency |
| **Encoding ↔ Encoding-Check** | Encoding-check takes an `Encoding` + `ExtensionEvaluator` | Low — explicit parameters |

### Contract Drift Assessment

The most significant drift risk is between the **formal specification** and the **implementation**. The spec is at v2.2.0 with 28 definitions, but the codebase disclaimer warns scorecard entries are "estimates, not machine-verified." The spec defines encoding soundness and completeness via universal quantification over all values and types; the implementation uses sampling. This is an acknowledged, deliberate gap — not drift — but it means the scorecard's claims are weaker than the spec's definitions.

*(Evidence: Spec v2.2.0 disclaimer; `value-universe.ts:65-71` "Heuristic only — exact equality is undecidable"; `soundness.ts` samples rather than proves. Confidence: high.)*

---

## 6. Tension Report

### Tension 1: Sampling vs. Exactness

**Source: Conflicting requirements.**

The spec defines soundness, completeness, and subtyping via universal quantification over 𝒱 (a countably infinite set). The implementation *must* terminate, so it samples. This creates an irreducible gap: the scorecard can detect *some* violations but cannot prove absence of violations.

The system partially addresses this via the `encoding-check/strategies/` module, which offers both `exact` and `sampling` strategies — but "exact" is only exact over a finite enumeration, not over 𝒱.

*(Evidence: Spec Def. 2.1 defines 𝒱 as countably infinite; `extensionsEqualBySampling()` in `value-universe.ts:65-71` is explicitly heuristic; `encoding-check/src/strategies/` offers exact and sampling. Confidence: high.)*

### Tension 2: AST Stability vs. Criterion Growth

**Source: Historical accretion (anticipated).**

ADR-002 froze the TypeTerm at 16 node kinds to prevent visitor breakage. But the criterion set is designed to grow (the spec already has `spec/future/` with session types, linear/affine types, gradual typing). Any new criterion that exercises a type-theoretic phenomenon not expressible via the current 16 kinds + Extension escape hatch will require either (a) an Extension-node encoding that loses type safety, or (b) a breaking change to the AST.

The `Extension` node is the designed pressure valve, but it's explicitly opaque to traversal, free-variable analysis, and substitution — which means Extension-encoded phenomena cannot participate in soundness/completeness checking with the same rigor as first-class nodes.

*(Evidence: ADR-002 "Adding a node kind later is a breaking change"; `Extension` node in `type-term.ts:195-201` is opaque; `spec/future/` contains three proposed extensions. Confidence: high.)*

### Tension 3: Adapter Burden vs. Measurement Completeness

**Source: Conflicting requirements.**

The IRAdapter contract requires `parse`, `encode`, `isEncodable`, and `inhabits` — four non-trivial methods for each of 7 schema languages, across 16 AST node kinds. Simpler IRs (Protobuf, Avro) will map many node kinds to `Extension` or return false from `isEncodable`, which accurately reflects their limited expressiveness but also means large portions of the scorecard will be ✗ by definition, not by failure.

The tension is between measurement precision (requiring adapters to handle every node kind) and practical adoption (making it feasible to add new adapters). The `_template` scaffold and the guides (`docs/guides/writing-an-adapter.md`) are the mitigation.

*(Evidence: ADR-002 "Adapters for simpler IRs will map many kinds to Extension or return encoding errors"; 7 adapters + 1 template exist; ADR-005 documents the design choice. Confidence: high.)*

### Tension 4: Specification Sovereignty vs. Implementation Pragmatism

**Source: Design bet.**

The architecture document states "Spec is sovereign" — the formal specification is the single source of truth. But the spec contains proof *sketches*, not formal proofs; its scorecard entries are *estimates*, not machine-verified measurements; and the encoding/soundness definitions require universal quantification that the implementation can only approximate.

This is a conscious bet: the spec provides the mathematical ideal, and the implementation converges toward it over time. The risk is that users treat scorecard output as proven fact when it's actually a best-effort approximation.

*(Evidence: Architecture.md "Spec is sovereign"; spec disclaimer "proof sketches only"; `soundness.ts` implements sampling not proof. Confidence: high.)*

### Tension 5: Monorepo Coherence vs. Adapter Independence

**Source: Leaky abstractions (mild).**

Adapters are separate packages with their own `package.json` and `tsconfig.json`, suggesting independence. But they all depend on `@typecarta/core` and must handle the same 16+1 node kinds. A change to `TypeTerm` (even a non-breaking annotation change) requires updating all 7 adapters. The monorepo structure with Turborepo manages this, but the coupling is real.

*(Evidence: All adapter `package.json` files depend on `@typecarta/core`; `turbo.json` has `"dependsOn": ["^build"]` ensuring build order. Confidence: high.)*

---

## 7. Onboarding Path

For someone who wants to *understand* this system (not just use it):

| Order | File | Why read this first |
|---|---|---|
| 1 | `spec/schema-ir-expressiveness-map.md` §1–§3 | Establishes the problem: types as predicates, extensions, subtyping. Without this, the code is meaningless. |
| 2 | `docs/adr/002-ast-design.md` | The single most important design decision: *why* 16 node kinds, *why* not more, *why* not fewer. |
| 3 | `packages/core/src/ast/type-term.ts` | The central data structure. Every other file in the codebase either produces, consumes, or transforms TypeTerms. |
| 4 | `packages/core/src/criteria/types.ts` | The measurement interface — what a "criterion" is and how it produces results. |
| 5 | `packages/core/src/adapter/interface.ts` | The plug-in boundary — how the outside world connects. |
| 6 | `packages/core/src/scorecard/evaluate.ts` | The evaluation engine — the core algorithm that produces the system's primary output. |
| 7 | `packages/witnesses/src/pi/s01-bottom.ts` | One concrete witness schema to see what the data looks like in practice. |
| 8 | `packages/core/src/encoding/soundness.ts` | The verification layer — how the system checks its own claims. |
| 9 | `docs/adr/005-adapter-contract.md` | Why the adapter interface looks the way it does. |
| 10 | `packages/adapters/json-schema/src/adapter.ts` | A concrete adapter — the bridge from theory to practice. |

---

## 8. Change Impact Guide

### Scenario 1: "Add a new node kind to TypeTerm"

**What breaks:** Everything that exhaustively matches on `TypeTerm["kind"]`.

**Propagation path:**
1. `type-term.ts` — add the new interface + union member
2. `TypeTermVisitor<R>` — every implementation must add a case (compile error)
3. `traversal.ts` — visitor/fold implementations
4. `free-vars.ts`, `substitution.ts`, `print.ts` — AST operations
5. `semantics/denotation.ts` — must define ⟦newKind⟧
6. All 15 core criterion predicates (`pi/*.ts`) — must handle or ignore
7. All 70 expanded criterion predicates (`pi-prime/*.ts`)
8. All 7 adapter implementations — must decide: encode, Extension, or error
9. All conformance tests

**Estimated blast radius:** ~80+ files. This is why ADR-002 exists.

### Scenario 2: "Add a new schema language adapter (e.g., Prisma)"

**What breaks:** Nothing — purely additive.

**Propagation path:**
1. Copy `_template/` to `adapters/prisma/`
2. Implement `IRAdapter<PrismaSig, PrismaNative>` — 4 mandatory + 1 optional method
3. Register in adapter registry
4. Write conformance tests
5. Add to CLI adapter resolution

**Estimated blast radius:** 5-7 new files, 0 existing files modified.

### Scenario 3: "The spec is updated from v2.2.0 to v3.0.0 with new criteria"

**What breaks:** Depends on whether new criteria fit existing node kinds.

**Propagation path (if criteria fit existing nodes):**
1. Add new `CriterionPredicate` implementations in `criteria/pi-prime/`
2. Add new witness schemas in `witnesses/src/pi-prime/`
3. Update `PI_PRIME_CRITERIA` registry
4. Scorecard automatically picks them up

**Propagation path (if criteria require new node kinds):**
See Scenario 1 — full AST breakage.

---

## 9. Architecture Map

*See `docs/conceptual-analysis-architecture.svg` (generated alongside this document).*

---

## 10. Compression Ratio

| Category | Count |
|---|---|
| Core concepts | 13 |
| Absent concepts | 3 |
| Capabilities | 8 |
| Flow narratives | 4 |
| Boundary contracts | 8 |
| Tensions | 5 |
| **Total conceptual items** | **41** |

Slightly above the 40-item target. The system's dual nature (mathematical framework + engineering toolkit) makes further compression lossy. The 13 core concepts could theoretically be reduced to ~10 by merging Encoding + Encoding-Check and Signature + Schema Class, but this would obscure real architectural boundaries.

---

## Boilerplate Subtracted

The following were identified as plumbing and excluded from conceptual analysis:

- **Build/deploy configuration:** `turbo.json`, `biome.json`, `pnpm-workspace.yaml`, `tsconfig.*.json`, `typedoc.json` — standard monorepo tooling
- **Output formatting:** `cli/src/output/` (json.ts, markdown.ts, terminal.ts) — presentation layer only
- **Index/barrel files:** All `index.ts` files — re-export plumbing
- **Template scaffold:** `adapters/_template/` — a copy-paste starter, not architecture
- **Generated docs:** `docs/api/` — TypeDoc output
- **Coverage reports:** `coverage/` — CI artifacts
- **`.repo/` and `.iande/`:** Agent configuration, not functional code

---

## Computational Model Assessment (Lens 2)

typecarta is a **pure dataflow pipeline** with no event-driven, stateful, or actor components. Data flows in one direction:

```
Native Schema → parse → TypeTerm → criterion/encode → CriterionResult/Encoding → scorecard/ρ-check → Report
```

There is no mutable state, no message passing, no background processing. The only control flow complexity is the per-criterion iteration in the scorecard evaluator. The CLI is a thin command dispatcher over this pipeline.

This computational simplicity is a strength — it makes the system predictable, testable, and easy to reason about. The trade-off is that interactive or incremental evaluation (e.g., "re-evaluate only criteria affected by this adapter change") is not supported.

*(Evidence: No event emitters, no state machines, no async operations, no pub/sub patterns anywhere in the codebase. All functions are synchronous. Confidence: high.)*

---

## Invariants (Lens 3)

### Explicit Invariants

1. **TypeTerm exhaustiveness:** The `TypeTermVisitor<R>` type forces compile-time coverage of all 17 discriminants. *(Enforcement: TypeScript compiler. Location: `type-term.ts:234-236`.)*

2. **Criterion orthogonality:** Each criterion tests exactly one type-system capability. *(Enforcement: by construction — each `pi-*.ts` file checks a single structural property. Verification: `diversity-check.test.ts` confirms witness distinctness.)*

3. **Adapter contract completeness:** Every adapter must implement `parse`, `encode`, `isEncodable`, `inhabits`. *(Enforcement: TypeScript interface. Location: `adapter/interface.ts:9-36`.)*

4. **Extension as escape hatch only:** `Extension` nodes are opaque to core traversal. *(Enforcement: ADR-002 §5. Code: traversal.ts treats Extension children as opaque.)*

### Implicit Invariants

5. **Round-trip fidelity:** `parse(encode(term))` should preserve criterion-relevant structure. *(Not enforced — tested heuristically in conformance tests.)*

6. **Sampling representativeness:** Test value sets used in soundness/completeness checking should be diverse enough to catch violations. *(Not enforced — depends on adapter authors choosing good test values.)*

### Violations

7. **No violated invariants detected.** The codebase is young (v0.1.0) and appears internally consistent. The main risk is the spec/implementation gap (sampling vs. universal quantification), which is acknowledged rather than violated.

---

*Analysis produced by Conceptual Codebase Analysis methodology, Mode A (conversational). Codebase: typecarta v0.1.0, ~200 source files, ~15K LOC estimated. Analysis date: 2026-04-04.*
