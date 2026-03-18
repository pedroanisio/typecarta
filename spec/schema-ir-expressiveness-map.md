---
title: "Schema IR Expressiveness — Formal Specification"
version: "2.2.0"
status: "draft"
date: "2026-03-18"
disclaimer: >
  NO INFORMATION WITHIN THIS DOCUMENT SHOULD BE TAKEN FOR GRANTED.
  Any statement or premise not backed by a real logical definition or a
  verifiable reference may be invalid, erroneous, or a hallucination.
  All theorems are stated with proof sketches only; full formal proofs
  require independent verification. All "partial" and "✓/✗" scorecard
  entries are estimates derived from publicly documented behaviour of the
  respective systems as of the document date and have not been
  machine-verified.
changelog: >
  v2.2.0 — Resolve C34: replaced misattributed [Ref. 2, §6] with
  [Ref. 20] (Castagna & Xu, ICFP 2011) in §7 Remark 7.1.2 and §12
  π₅₉ warning; removed corresponding TODO comments. Added Remark 5.1.2
  (shared-V assumption). Added Remark 13.5 (reduced-product caveat for
  encoding-check properties). Added Ref. 20 (Castagna & Xu 2011).
  v2.1.0 — Bibliographic fixes: Ref. 9 author corrected (Yallop & White,
  not Kiselyov); Ref. 15 year corrected (2009, not 2010); Ref. 10
  misattribution in §7 Remark 7.1.2 replaced with [Ref. 2, §6]. Added
  Ref. 16 (Rice 1953) and Ref. 17 (Xi, Chen & Chen 2003, GADTs). Orphaned
  Ref. 9 and Ref. 15 now cited inline at S₁₅ and π₃₂. Citations carried
  forward to §12 π₅₉ warning. Added provenance note in §1 marking
  §5–§13 as original contributions. Added Remark 6.3.1 (forward-reference
  to §7). Added Remark 3.3.3 (LFP vs GFP). Added equi-recursive vs
  iso-recursive remark at π₂₅. Integrated "faithfully partial" into §11
  scorecard cell definitions (sub-cases a/b/c). Strengthened Theorem 10.2
  with 4 explicit pairwise separation witnesses. Expanded Remark 7.1.1
  with precise Rice-style impossibility argument. Added §11 remark
  distinguishing formal framework from non-verified scorecard estimates.
  Used "faithfully partial" explicitly in per-cell justifications (S₈ Zod,
  S₁₀ JSON Schema). Tightened Theorem 10.2 with schema-language-level
  separation witnesses. Added Remark 8.2.1 (observational basis analogy
  to behavioural equivalence) with Ref. 18 (Milner 1989) and Ref. 19
  (Sangiorgi & Walker 2001). Restored Ref. 10 (Kozen) in Remark 7.1.2
  for O(n²) decidable baseline. Sharpened provenance note with explicit
  Cousot abstract-interpretation parallel for Defs. 5.2–5.3. Expanded
  Remark 3.3.3 to cite Haskell coinductive types alongside JS cycles.
  Added $ref (equi) vs z.lazy() (iso) note at π₂₅. Added finite-scope
  clarification to S₁₄ per-cell justification. Version metadata corrected.
  v2.0.1 — Added §15 References (15 entries); inserted [Ref. N] inline
  citations throughout. Existing parenthetical citation converted.
  v2.0.0 — Unified single-pass specification. Criterion set Π comprises
  70 criteria across 22 families (A–V) with a 15-criterion core subset
  (Π_core) backed by witness schemas and scorecard. Includes:
  encoding-check layer for subtyping precision; §7 impossibility boundary
  with μ+¬ decidability interaction; operational subtyping distinction
  (Def. 2.4). Rejected proposals: Q₂ (derivable), X₂ (out of scope),
  F₃ (already covered), DNF/CNF (complexity-profile concern).
---

# Schema IR Expressiveness — Formal Specification

> **Disclaimer.** No information within this document should be taken for
> granted. Any statement or premise not backed by a real logical definition
> or a verifiable reference may be invalid, erroneous, or a hallucination.
> All theorems are stated with proof sketches only; full formal proofs
> require independent verification. All scorecard entries marked "partial",
> "✓", or "✗" are estimates derived from publicly documented behaviour of
> the respective systems as of the document date and have not been
> machine-verified.

---

## Table of Contents

1. [Scope and Purpose](#1-scope-and-purpose)
2. [Semantic Foundation](#2-semantic-foundation)
3. [Schema Language](#3-schema-language)
4. [Intermediate Representation](#4-intermediate-representation)
5. [Encoding and Modeling Relations](#5-encoding-and-modeling-relations)
6. [Universality](#6-universality)
7. [Impossibility Boundary](#7-impossibility-boundary)
8. [Coverage Criterion Set](#8-coverage-criterion-set)
9. [Core Subset and Witness Schemas](#9-core-subset-and-witness-schemas)
10. [Completeness and Minimality Theorems](#10-completeness-and-minimality-theorems)
11. [IR Scorecard](#11-ir-scorecard)
12. [Criterion Set by Family](#12-criterion-set-by-family)
13. [Encoding-Check Layer](#13-encoding-check-layer)
14. [Glossary](#14-glossary)
15. [References](#15-references)

---

## 1. Scope and Purpose

This specification establishes a formal framework for reasoning about the
*expressive power* of a schema Intermediate Representation (IR) relative to
a class of source schema languages. It defines:

- what it means for an IR to **model** a schema language (§5);
- what it means for an IR to **model any schema** in a class (§6);
- the **impossibility boundary** that every finite IR must respect (§7);
- a **criterion set** $\Pi$ of 70 orthogonal criteria across 22 families,
  capturing the structural and semantic phenomena an expressive IR must
  represent (§8, §12);
- a **core criterion subset** $\Pi_{\mathrm{core}} \subset \Pi$ of 15
  independently testable criteria, each with a **witness schema** in the
  diverse schema set $\mathbb{C}$ (§9), together with completeness and
  minimality theorems (§10) and a machine-applicable **scorecard** (§11);
- an **encoding-check layer** for evaluating subtyping-precision properties
  of an IR's encoding function (§13).

The framework is *language-neutral*. Zod, JSON Schema, OpenAPI, and
TypeScript appear only as illustrative examples, not as normative targets.

> *Provenance of claims.* The semantic foundation (§2) and type-term
> formation (§3) are standard; their formulations follow Pierce [Ref. 1],
> Cardelli and Wegner [Ref. 5], and Tarski [Ref. 3]. The encoding and
> modeling relations (§5), universality definitions (§6), the impossibility
> boundary (§7), the coverage criterion framework and its orthogonality,
> atomicity, and observational-basis properties (§8), the core subset and
> witness-schema methodology (§9–§10), the scorecard (§11), and the
> encoding-check layer (§13) are **original contributions introduced by this
> specification**. They do not derive from prior published work, though
> they draw on standard concepts from type-theoretic subtyping
> [Ref. 1, Ch. 15–16]. In particular, the encoding soundness and
> completeness definitions (Defs. 5.2–5.3) parallel the standard
> notions of *sound* and *complete abstractions* in the Cousot abstract
> interpretation framework: soundness ensures the IR does not admit
> values the source rejects (over-approximation is safe), while
> completeness ensures no valid values are lost (under-approximation
> is avoided). The parallel is structural, not formal — encoding
> operates on type terms, not on program states.

---

## 2. Semantic Foundation

### Definition 2.1 — Value Universe

Let $\mathcal{V}$ be a fixed, countably infinite set of **values** — the
semantic domain. Concretely, $\mathcal{V}$ may be taken as all
JSON-representable values extended with typed primitives (integers, dates,
binary blobs), but the framework does not depend on this choice provided
$\mathcal{V}$ is countably infinite.

> *Remark 2.1.1 — Uncountable domains.* If $\mathcal{V}$ were taken as
> uncountable, the impossibility result of §7 would only strengthen, since
> $|\mathcal{P}(\mathcal{V})| \geq 2^{|\mathcal{V}|} > |\mathcal{V}| \geq
> |\mathcal{T}(\Sigma_R)|$ still holds.

### Definition 2.2 — Type

A **type** $\tau$ is a total function:

$$\tau : \mathcal{V} \to \{\top, \bot\}$$

Its **extension** is the set of values it accepts:

$$\llbracket \tau \rrbracket \;=\; \{\, v \in \mathcal{V} \mid \tau(v) = \top \,\} \;\subseteq\; \mathcal{V}$$

> *Remark 2.2.1.* This definition does not require $\tau$ to be effectively
> decidable. §7 distinguishes the decidable and undecidable cases when
> deriving the impossibility result.

### Definition 2.3 — Subtyping

The **subtyping relation** $\leq$ on types is defined by extension
inclusion [Ref. 1, Ch. 15; Ref. 5]:

$$\tau_1 \leq \tau_2 \;\iff\; \llbracket\tau_1\rrbracket \subseteq \llbracket\tau_2\rrbracket$$

This induces a partial order on types. Equality of types is taken as
bi-directional subtyping: $\tau_1 \equiv \tau_2 \iff \tau_1 \leq \tau_2
\land \tau_2 \leq \tau_1$, i.e. $\llbracket\tau_1\rrbracket =
\llbracket\tau_2\rrbracket$.

### Definition 2.4 — Operational Subtyping

An IR $\mathcal{R}$ may implement an **operational assignability judgment**
$\leq_{\mathrm{op}}$ that intentionally diverges from the semantic
subtyping relation $\leq$ of Def. 2.3. The operational judgment governs
which assignments, casts, or coercions the IR permits, and may sacrifice
antisymmetry or transitivity for ergonomic reasons.

> *Remark 2.4.1.* The canonical example is TypeScript's `any`, which
> satisfies $\mathtt{any} \leq_{\mathrm{op}} \tau$ and
> $\tau \leq_{\mathrm{op}} \mathtt{any}$ for all $\tau$, breaking
> antisymmetry. Under the semantic relation $\leq$, this would force all
> types to have identical extensions — a contradiction. The divergence is
> deliberate and constitutes a designed unsoundness [Ref. 13].

> *Remark 2.4.2.* Criteria in $\Pi$ that depend on the operational
> judgment rather than the semantic relation are tagged **[meta-op]** and
> state the required enrichment explicitly. The default interpretation of
> $\leq$ throughout this document is the semantic relation of Def. 2.3
> unless otherwise noted.

---

## 3. Schema Language

### Definition 3.1 — Signature

A **signature** is a tuple $\Sigma = (B, \mathcal{F}, \mathrm{ar})$ where:

- $B$ is a finite set of **base type names** (e.g. `string`, `number`, `boolean`, `null`);
- $\mathcal{F}$ is a finite set of **type constructors** (e.g. `object`, `array`, `union`, `intersection`);
- $\mathrm{ar} : \mathcal{F} \to \mathbb{N}^{+}$ assigns each constructor a positive arity.

### Definition 3.2 — Type Term

Given a signature $\Sigma$, the set of **type terms** $\mathcal{T}(\Sigma)$
is the *least* set satisfying:

1. $b \in \mathcal{T}(\Sigma)$ for every $b \in B$;
2. If $f \in \mathcal{F}$ with $\mathrm{ar}(f) = n$ and $\tau_1,\ldots,\tau_n \in \mathcal{T}(\Sigma)$, then $f(\tau_1,\ldots,\tau_n) \in \mathcal{T}(\Sigma)$;
3. *(Parametric extension.)* If $\Sigma$ admits type variables, then for each variable $\alpha$ and $\tau \in \mathcal{T}(\Sigma)$, the abstraction $\Lambda\alpha.\,\tau \in \mathcal{T}(\Sigma)$.

Clause 3 is optional; a signature that omits it generates only *ground*
(monomorphic) type terms.

> *Remark 3.2.1 — Extended type-level operators.* Clause 3 is not
> exhaustive. The criterion set $\Pi$ (§8, §12) uses several operators
> that fall outside fixed-arity constructor applications:
>
> - **Fixpoint binder** $\mu\alpha.\,\tau$ ($\pi_{25}$–$\pi_{27}$):
>   a variable-binding form; cannot be expressed as a fixed-arity constructor.
> - **Complement** $\neg\tau$ ($\pi_{59}$): requires access to the full
>   semantic domain, not just sub-term denotations.
> - **Key enumeration** $\mathrm{keyof}\,\tau$ ($\pi_{63}$): a type-level
>   introspection operator with no fixed arity.
> - **Conditional type** $\tau_1\;\mathtt{extends}\;\tau_2\;?\;\tau_A:\tau_B$
>   ($\pi_{65}$): embeds a subtyping judgment inside a constructor.
>
> Wherever this document uses such operators, the corresponding extension
> to the term-formation rules is implied.
>
> **Nominal identity** ($\pi_{35}$). The constructor
> $\mathrm{nominal}(\mathit{Tag}, \tau)$ used in $S_{12}$ operates at the
> operational subtyping layer (Def. 2.4), not as a type constructor in
> $\mathcal{T}(\Sigma)$. Its extension satisfies
> $\llbracket\mathrm{nominal}(\mathit{Tag}, \tau)\rrbracket =
> \llbracket\tau\rrbracket$, but the operational judgment
> $\leq_{\mathrm{op}}$ distinguishes differently tagged types:
> $\mathrm{nominal}(A, \tau) \not\leq_{\mathrm{op}}
> \mathrm{nominal}(B, \tau)$ when $A \neq B$.

### Definition 3.3 — Denotational Semantics

A **denotational semantics** for $\Sigma$ is a function:

$$\llbracket\cdot\rrbracket_\Sigma \;:\; \mathcal{T}(\Sigma) \;\to\; \mathcal{P}(\mathcal{V})$$

that is **compositional**: for every constructor $f \in \mathcal{F}$,
$\llbracket f(\tau_1,\ldots,\tau_n)\rrbracket_\Sigma$ is determined entirely
by $\llbracket\tau_1\rrbracket_\Sigma,\ldots,\llbracket\tau_n\rrbracket_\Sigma$.

> *Remark 3.3.1 — Scope of ground semantics.* The codomain
> $\mathcal{P}(\mathcal{V})$ is well-defined only for *ground* (closed,
> fully instantiated) type terms. A parametric term
> $\Lambda\alpha.\,\tau \in \mathcal{T}(\Sigma)$ introduced by clause 3
> of Def. 3.2 does not itself have an extension in $\mathcal{P}(\mathcal{V})$;
> it has a *family* of extensions indexed by the type argument:
> $\llbracket(\Lambda\alpha.\,\tau)(\sigma)\rrbracket_\Sigma =
> \llbracket\tau[\alpha \mapsto \sigma]\rrbracket_\Sigma$ for each
> ground substitution $\sigma$. All extensional and subtyping
> judgments in this document — including $\Pi$ criteria in
> Families H ($\pi_{28}$–$\pi_{33}$), G ($\pi_{27}$), and S
> ($\pi_{61}$–$\pi_{62}$) — are therefore interpreted at ground
> instantiations only. A fully kinded treatment (where types of kind
> $* \to *$ denote functions $\mathcal{P}(\mathcal{V}) \to
> \mathcal{P}(\mathcal{V})$) is left for future formalisation.

> *Remark 3.3.2 — Fixpoint Semantics.* For type terms containing the
> fixpoint binder $\mu\alpha.\tau$, the denotational semantics is defined
> via the Knaster–Tarski fixpoint theorem [Ref. 3]. The powerset
> $\mathcal{P}(\mathcal{V})$ ordered by inclusion is a complete lattice.
> The map $\Phi_F : \mathcal{P}(\mathcal{V}) \to \mathcal{P}(\mathcal{V})$
> defined by $\Phi_F(X) = \llbracket\tau[\alpha \mapsto X]\rrbracket$ is
> monotone (by compositionality of the non-$\mu$ constructors). By
> Knaster–Tarski, $\Phi_F$ has a least fixpoint, and we define
> $\llbracket\mu\alpha.\tau\rrbracket = \mathrm{lfp}(\Phi_F)$. Mutual
> recursion ($\pi_{26}$) extends this to a product lattice
> $\mathcal{P}(\mathcal{V})^n$ with a component-wise ordering.
>
> *Remark 3.3.3 — Least vs. Greatest Fixpoint.* The choice of
> $\mathrm{lfp}$ (least fixpoint) implies that only *finitely deep*
> values (finite trees) inhabit recursive types. This is correct when
> $\mathcal{V}$ is taken as JSON-representable values, which are
> strictly finite by definition. If $\mathcal{V}$ were extended to
> admit infinite streams or cyclic structures — whether in-memory
> JavaScript objects with reference cycles or coinductive data types
> in lazy languages (Haskell's default interpretation of recursive
> types is coinductive/gfp) — the greatest fixpoint ($\mathrm{gfp}$,
> coinductive semantics) would be required instead. All criteria in
> $\Pi$ are stated under the $\mathrm{lfp}$ interpretation.

### Definition 3.4 — Schema Language

A **schema language** is a triple:

$$\mathcal{L} \;=\; (\Sigma,\; \mathcal{T}(\Sigma),\; \llbracket\cdot\rrbracket_\Sigma)$$

### Definition 3.5 — Schema

A **schema** over $\mathcal{L}$ is any finite, well-formed type term
$S \in \mathcal{T}(\Sigma)$.

---

## 4. Intermediate Representation

### Definition 4.1 — IR

An **Intermediate Representation** (IR) is a schema language:

$$\mathcal{R} \;=\; (\Sigma_R,\; \mathcal{T}(\Sigma_R),\; \llbracket\cdot\rrbracket_{\Sigma_R})$$

together with a designated subset of **IR nodes**
$\mathcal{N}_R \subseteq \mathcal{T}(\Sigma_R)$ — the set of encodable
terms. In practice $\mathcal{N}_R$ is the image of the concrete data
structure used by the IR implementation.

> *Remark 4.1.1.* Treating an IR as itself a schema language is deliberate.
> It allows encoding and modeling to be stated as relations between two
> objects of the same type, and avoids introducing a separate meta-language.

---

## 5. Encoding and Modeling Relations

### Definition 5.1 — Encoding

An **encoding** of schema language $\mathcal{L}$ into IR $\mathcal{R}$ is a
total function:

$$\phi \;:\; \mathcal{T}(\Sigma) \;\to\; \mathcal{N}_R$$

Totality is required: $\phi$ must be defined for *every* type term in
$\mathcal{T}(\Sigma)$, not merely for a recognisable subset. When totality
cannot be achieved, the following weaker notion applies.

### Definition 5.1.1 — Partial Encoding

A **partial encoding** is a partial function:

$$\phi \;:\; \mathcal{T}(\Sigma) \;\rightharpoonup\; \mathcal{N}_R$$

Its **coverage** is $\mathrm{dom}(\phi) \subseteq \mathcal{T}(\Sigma)$. A
partial encoding is **faithfully partial** iff it is semantically faithful on
its domain:

$$\forall \tau \in \mathrm{dom}(\phi):\quad
\llbracket\phi(\tau)\rrbracket_R \;=\; \llbracket\tau\rrbracket_\Sigma$$

> *Remark 5.1.1.1.* Definition 5.6 ($\mathcal{R} \vDash \mathcal{L}$) retains
> the totality requirement — it is the gold standard for full modeling. Partial
> encodings are formalized here to give vocabulary for discussing real-world IRs
> that cover a proper subset of a source language, but they sit strictly below
> the modeling relation.

> *Remark 5.1.2 — Shared value universe.* All encoding and modeling
> definitions in this section (Defs. 5.1–5.6) presuppose that the source
> language $\mathcal{L}$ and the IR $\mathcal{R}$ share the same value
> universe $\mathcal{V}$ (Def. 2.1). The extension comparisons
> $\llbracket\phi(\tau)\rrbracket_R \subseteq \llbracket\tau\rrbracket_\Sigma$
> and $\llbracket\tau\rrbracket_\Sigma \subseteq
> \llbracket\phi(\tau)\rrbracket_R$ are well-defined only when both sides
> are subsets of the same set. In practice this assumption holds for the
> schema languages considered in this specification (JSON Schema, Zod,
> TypeScript), which all operate over JSON-representable values extended
> with typed primitives. If source and IR have genuinely different value
> domains, the encoding relation must be reformulated over a common
> embedding — a generalization this specification does not pursue.

### Definition 5.2 — Semantic Soundness

$\phi$ is **semantically sound** iff:

$$\forall \tau \in \mathcal{T}(\Sigma):\quad
\llbracket\phi(\tau)\rrbracket_R \;\subseteq\; \llbracket\tau\rrbracket_\Sigma$$

The IR encoding does not accept any value that the source type rejects.

### Definition 5.3 — Semantic Completeness

$\phi$ is **semantically complete** iff:

$$\forall \tau \in \mathcal{T}(\Sigma):\quad
\llbracket\tau\rrbracket_\Sigma \;\subseteq\; \llbracket\phi(\tau)\rrbracket_R$$

The IR encoding does not reject any value that the source type accepts.

### Definition 5.4 — Semantic Faithfulness

$\phi$ is **semantically faithful** iff it is both sound and complete:

$$\forall \tau \in \mathcal{T}(\Sigma):\quad
\llbracket\phi(\tau)\rrbracket_R \;=\; \llbracket\tau\rrbracket_\Sigma$$

### Definition 5.5 — Structure Preservation

$\phi$ is **structure-preserving** iff it is monotone under the subtyping
orders of $\mathcal{L}$ and $\mathcal{R}$:

$$\tau_1 \leq_\Sigma \tau_2 \;\implies\; \phi(\tau_1) \leq_R \phi(\tau_2)$$

> *Proposition 5.5.1.* Semantic faithfulness implies structure-preservation.
> *Proof.* If $\llbracket\phi(\tau)\rrbracket_R = \llbracket\tau\rrbracket_\Sigma$
> for all $\tau$, then $\tau_1 \leq_\Sigma \tau_2$ gives
> $\llbracket\tau_1\rrbracket_\Sigma \subseteq \llbracket\tau_2\rrbracket_\Sigma$,
> hence $\llbracket\phi(\tau_1)\rrbracket_R \subseteq \llbracket\phi(\tau_2)\rrbracket_R$,
> i.e. $\phi(\tau_1) \leq_R \phi(\tau_2)$. $\square$

### Definition 5.6 — IR Models a Schema Language

IR $\mathcal{R}$ **models** schema language $\mathcal{L}$, written
$\mathcal{R} \vDash \mathcal{L}$, iff there exists a semantically faithful
encoding $\phi : \mathcal{T}(\Sigma) \to \mathcal{N}_R$.

---

## 6. Universality

### Definition 6.1 — Schema Class

A **schema class** $\mathbb{S} = \{\mathcal{L}_i\}_{i \in I}$ is a
(possibly infinite) collection of schema languages indexed by $I$.

### Definition 6.2 — Weak Universality

IR $\mathcal{R}$ **weakly models any schema** in $\mathbb{S}$ iff for every
language $\mathcal{L}_i \in \mathbb{S}$ and every schema
$S \in \mathcal{T}(\Sigma_i)$ there exists some node $n \in \mathcal{N}_R$
with matching extension:

$$\forall \mathcal{L}_i \in \mathbb{S},\;\forall S \in \mathcal{T}(\Sigma_i),\;
\exists\, n \in \mathcal{N}_R :\quad \llbracket n \rrbracket_R = \llbracket S \rrbracket_{\Sigma_i}$$

Weak universality asserts that every schema *has a counterpart* in the IR,
but provides no computable procedure for finding it.

### Definition 6.3 — Strong Universality

IR $\mathcal{R}$ **strongly models any schema** in $\mathbb{S}$ iff for each
language $\mathcal{L}_i \in \mathbb{S}$ there exists a semantically faithful
and **computable** encoding:

$$\forall \mathcal{L}_i \in \mathbb{S},\;
\exists\, \phi_i : \mathcal{T}(\Sigma_i) \to \mathcal{N}_R
\quad\text{semantically faithful and computable}$$

Computability is required: the encoding must be mechanically derivable by a
terminating algorithm, not merely exist as an abstract mapping.

> *Remark 6.3.1.* The distinction between weak and strong universality is
> motivated by the impossibility boundary of §7: Prop. 7.1 shows that no
> finite IR is semantically universal, so the class $\mathbb{S}$ must
> always be explicitly bounded. Even within a bounded class, strong
> universality is the operationally useful notion — without computability,
> the encoding is a theoretical existence guarantee with no engineering
> value.

### Definition 6.4 — Working Definition ("Models Any Schema")

> IR $\mathcal{R}$ **models any schema in class $\mathbb{S}$** iff it strongly
> models $\mathbb{S}$ (Def. 6.3), where $\mathbb{S}$ is *explicitly named*
> (e.g. "all non-generic Zod schemas", "all JSON Schema draft-07 documents").

**The claim "models any schema" without specifying $\mathbb{S}$ is formally
ill-posed** (see §7).

---

## 7. Impossibility Boundary

### Proposition 7.1 — No Finite IR is Semantically Universal

No IR $\mathcal{R}$ with a *finite* signature $\Sigma_R$ strongly models the
class of *all* schema languages over $\mathcal{V}$.

*Proof sketch.* A finite signature $\Sigma_R$ generates a countable set
of type terms $\mathcal{T}(\Sigma_R)$: each term is a *finite tree* over
the finite ranked alphabet $(B \cup \mathcal{F}, \mathrm{ar})$, and the
set of all finite trees over a finite ranked alphabet is countable (it
bijects with finite strings via a standard linearisation, and finite
strings over a finite alphabet are countable). Hence
$|\mathcal{N}_R| \leq \aleph_0$.
The set of all possible type extensions over $\mathcal{V}$ is
$\mathcal{P}(\mathcal{V})$. Since $\mathcal{V}$ is countably infinite,
$|\mathcal{P}(\mathcal{V})| = 2^{\aleph_0} > \aleph_0$. No surjective — let
alone semantically faithful — mapping $\phi$ from all extensions into
$\mathcal{N}_R$ can exist. $\square$

### Remark 7.1.1 — Decidability and the Cardinality Argument

The proof above does not require types to be decidable predicates. It
operates on the full power set $\mathcal{P}(\mathcal{V})$. If one restricts
attention to *decidable* predicates only, the set of Turing machines is
countable, so the cardinality gap closes and the argument above no longer
applies. In that restricted setting, impossibility must be argued
separately — for example via Rice's theorem [Ref. 16].

The argument proceeds as follows. Consider a candidate "universal
encoding detector": a Turing machine $D$ that, given a description of
an IR node $n \in \mathcal{N}_R$, decides whether $n$ faithfully
encodes some target schema $S$ (i.e. whether
$\llbracket n \rrbracket_R = \llbracket S \rrbracket_\Sigma$).
The property "has the same extension as $S$" is a semantic property of
$n$'s denotation — it depends only on $\llbracket n \rrbracket_R$,
not on $n$'s syntactic structure. By Rice's theorem, every non-trivial
semantic property of the language recognized by a Turing machine is
undecidable. Since the property is non-trivial (some IR nodes have the
target extension, others do not), no such $D$ can exist in general.
This means that even if a faithful encoding *exists* for every schema
in $\mathbb{S}$, there is no uniform algorithm to *find* it — which
is precisely the gap between weak and strong universality
(Defs. 6.2–6.3).

Both routes — the cardinality argument (Prop. 7.1) and the
Rice-style argument — confirm the same boundary; the unrestricted
version is more direct for motivating why $\mathbb{S}$ must always
be named.

### Remark 7.1.2 — Decidability Interactions: $\mu + \neg$

The criterion set $\Pi$ (§12) includes both recursive types
($\mu$, Family G) and type-level complement ($\neg$, Family Q). Their
combination creates a decidability hazard that the cardinality argument of
Prop. 7.1 does not capture.

Semantic subtyping with recursive types and full Boolean connectives
($\sqcup$, $\sqcap$, $\neg$) has been shown decidable for specific
set-theoretic type systems [Ref. 2; Ref. 4]. However, the decidability
result is *fragile*: it depends on restrictions such as regularity of
the recursive types (the set of sub-terms reachable by unfolding is
finite), for which efficient $O(n^2)$ algorithms exist [Ref. 10], and
the absence of certain features (e.g. unrestricted $\mu$ under $\neg$
combined with parametric polymorphism can push equivalence checking
from PSPACE to undecidable [Ref. 20]).

An IR that admits $\pi_{59}$ ($\neg$), $\pi_{25}$ ($\mu$), and
$\pi_{28}$ ($\Lambda$) simultaneously must establish that its type
equivalence and subtyping decision procedures terminate. This is not
guaranteed by satisfying the individual criteria; it is a *global coherence
property* of the IR's type algebra. The impossibility boundary therefore
has a second facet beyond cardinality: **even within a named class
$\mathbb{S}$, adding $\neg$ to an IR with $\mu$ may render type
equivalence undecidable unless the interaction is explicitly constrained.**

### Corollary 7.2

Any practical IR achieves completeness only with respect to an explicitly
bounded class $\mathbb{S} \subsetneq \mathbb{S}_{\mathrm{all}}$. Every
expressiveness claim must name $\mathbb{S}$ and the equivalence relation
under which it is evaluated.

---

## 8. Coverage Criterion Set

### Definition 8.1 — Coverage Criterion

A **coverage criterion** is a decidable predicate:

$$\pi : \mathcal{T}(\Sigma) \to \{\top, \bot\}$$

that identifies a *structurally or semantically distinct phenomenon* that an
expressive IR must be capable of representing.

> *Remark 8.1.1 — Binary Criteria.* Some phenomena (notably subtyping
> precision properties such as width and depth subtyping) are not
> properties of individual type terms but of *pairs* of type terms under
> the IR's subtyping relation. These are formalised as **encoding-check
> properties** in §13 rather than as unary criteria in $\Pi$.

### Definition 8.2 — Criterion Set $\Pi$

Let $\Pi = \{\pi_1, \ldots, \pi_k\}$ be a finite set of criteria satisfying:

**Orthogonality.** For all $i \neq j$:

$$\pi_i \not\Rightarrow \pi_j \quad\text{and}\quad \pi_j \not\Rightarrow \pi_i$$

More strongly, $\pi_i$ and $\pi_j$ are *orthogonal*: there exist schema
languages satisfying $\pi_i$ but not $\pi_j$, and vice versa, exposing
qualitatively independent design dimensions.

**Atomicity.** No $\pi_i$ is logically decomposable: there is no pair
$\pi', \pi''$ such that

$$\pi_i \;\equiv\; \pi' \land \pi''$$

with $\pi'$ and $\pi''$ independent under the semantic equivalence induced
by $\mathcal{V}$.

**Observational Basis.** Because each $\pi_i$ is defined as a predicate
on *type terms* (Def. 8.1), its application to a schema language
$\mathcal{L} = (\Sigma, \mathcal{T}(\Sigma), \llbracket\cdot\rrbracket_\Sigma)$
is defined by lifting:

$$\pi_i(\mathcal{L}) \;=\; \top
\;\iff\; \exists\, S \in \mathcal{T}(\Sigma) : \pi_i(S) = \top$$

That is, $\mathcal{L}$ *satisfies* $\pi_i$ iff it admits at least one
schema exhibiting the phenomenon. $\Pi$ then constitutes a *finite
observational basis* for the equivalence relation $\sim_\Pi$ on schema
languages defined by:

$$\mathcal{L}_1 \sim_\Pi \mathcal{L}_2 \;\iff\;
\forall \pi_i \in \Pi,\; \pi_i(\mathcal{L}_1) = \pi_i(\mathcal{L}_2)$$

Universality claims in this specification are always evaluated under
$\sim_\Pi$, not under an absolute or language-specific equivalence.

> *Remark 8.2.1 — Relationship to behavioural equivalence.* The
> equivalence $\sim_\Pi$ is structurally analogous to *observational
> equivalence* in process algebra, where two processes are equivalent iff
> no observer (drawn from a fixed class) can distinguish them [Ref. 18].
> Here, $\Pi$ plays the role of the observer class: two schema languages
> are $\Pi$-equivalent iff no criterion in $\Pi$ separates them. The
> construction is also related to *bisimulation up to* a finite set of
> tests [Ref. 19]. The key difference is that $\Pi$ criteria are
> *unary predicates on type terms*, not binary relations on processes;
> the analogy is structural, not formal.

### Definition 8.3 — $\Pi$-Complete Schema Set

A finite set $\mathbb{C} \subset \mathcal{T}(\Sigma)$ is **$\Pi$-complete** iff:

$$\forall \pi_i \in \Pi,\; \exists\, S \in \mathbb{C} : \pi_i(S) = \top$$

Every criterion is witnessed by at least one schema in $\mathbb{C}$.

### Definition 8.4 — $\Pi$-Diverse Schema Set

$\mathbb{C}$ is **$\Pi$-diverse** iff it is $\Pi$-complete and
*orthogonally minimal* — no schema in $\mathbb{C}$ is redundant:

$$\nexists\, S \in \mathbb{C} :\;
\bigl\{\pi_i \mid \pi_i(S) = \top\bigr\}
\;\subseteq\;
\bigcup_{S' \in \mathbb{C} \setminus \{S\}} \bigl\{\pi_i \mid \pi_i(S') = \top\bigr\}$$

Each $S \in \mathbb{C}$ is the *primary witness* for at least one criterion
that no other element of $\mathbb{C}$ covers.

### 8.5 — The Criterion Set $\Pi$

The full criterion set $\Pi = \{\pi_1, \ldots, \pi_{70}\}$ comprises 70
criteria across 22 thematic families (A–V), enumerated in §12. A
**core subset** $\Pi_{\mathrm{core}} \subset \Pi$ of 15 criteria is
identified in §9, each with a concrete witness schema in the diverse
schema set $\mathbb{C}$. The completeness and diversity properties
(Defs. 8.3–8.4) are instantiated relative to $\Pi_{\mathrm{core}}$ in §10;
the full $\Pi$ satisfies a family-structured independence property detailed
in §12.2.

---

## 9. Core Subset and Witness Schemas

### Definition 9.0 — Core Criterion Subset

The **core criterion subset** $\Pi_{\mathrm{core}} \subset \Pi$ consists of
15 criteria drawn from distinct families, each representing a coarse-grained
phenomenon testable with a single witness schema:

| Core | Name | Criterion in $\Pi$ |
|---|---|---|
| $c_1$ | Bottom / Empty | $\pi_1$ (Syntactic bottom, Family A) |
| $c_2$ | Top / Universal | $\pi_3$ (Global top, Family A) |
| $c_3$ | Unit / Singleton | $\pi_5$ (Singleton literal, Family A) |
| $c_4$ | Finite Product | $\pi_9$ (Labelled record, Family B) |
| $c_5$ | Sum / Union | $\pi_{20}$ (Discriminated union, Family E) |
| $c_6$ | Intersection | $\pi_{23}$ (Record-merge intersection, Family F) |
| $c_7$ | Direct Recursion | $\pi_{25}$ (Direct self-recursion, Family G) |
| $c_8$ | Mutual Recursion | $\pi_{26}$ (Mutual recursion, Family G) |
| $c_9$ | Parametricity | $\pi_{28}$ (Rank-1 generics, Family H) |
| $c_{10}$ | Refinement | $\pi_{38}$ (Range / bound constraint, Family J) |
| $c_{11}$ | Optionality | $\pi_{12}$ (Optional-by-absence, Family C) |
| $c_{12}$ | Nominal Identity | $\pi_{35}$ (Nominal tag / brand, Family I) |
| $c_{13}$ | Open Shape | $\pi_{17}$ (Open, unconstrained extras, Family D) |
| $c_{14}$ | Dependent Constraint | $\pi_{42}$ (Finite tagged dependent, Family K) |
| $c_{15}$ | Higher-Kinded | $\pi_{32}$ (Higher-kinded type parameter, Family H) |

> *Remark 9.0.1.* $\pi_{32}$ (higher-kinded) properly subsumes $\pi_{28}$
> (rank-1 generics): $\pi_{28}$ abstracts over a type argument; $\pi_{32}$
> abstracts over the container structure itself. Both appear in
> $\Pi_{\mathrm{core}}$ because they expose different IR design costs.

> *Remark 9.0.2.* Full dependent types ($c_{14}$) are undecidable in
> general. The operationally useful restriction is *finitely-enumerable
> conditional typing* — where $\tau_j$ ranges over a finite set determined
> by the value of field $i$ — which remains decidable.

### 9.1 — The Diverse Schema Set $\mathbb{C}$

Each schema below is specified in three forms:

1. Formal type term using the notation established in §3.
2. Illustrative encoding in Zod-style pseudocode (non-normative).
3. The core criterion $c_i$ (and corresponding $\Pi$ criterion) it witnesses.

---

### $S_1$ — Bottom (core witness: $c_1$ / $\pi_1$)

$$S_1 = \bot \qquad \llbracket S_1 \rrbracket = \emptyset$$

```typescript
z.never()
```

The unique schema with no valid inhabitant. Any IR lacking a bottom node
cannot encode `never`, uninhabited union branches, or
exhaustion-checked switch arms.

---

### $S_2$ — Top (core witness: $c_2$ / $\pi_3$)

$$S_2 = \top \qquad \llbracket S_2 \rrbracket = \mathcal{V}$$

```typescript
z.unknown()
```

Dual of bottom. Required for passthrough fields, catch-all validators, and
escape hatches. Distinct from `any` in systems that enforce safe-access
discipline on the top type.

---

### $S_3$ — Unit / Literal (core witness: $c_3$ / $\pi_5$)

$$S_3 = \{42\} \qquad \llbracket S_3 \rrbracket = \{42\}$$

```typescript
z.literal(42)
```

A singleton type. A necessary prerequisite for discriminated unions: without
literal types the IR cannot encode tagged sum discriminants correctly.

---

### $S_4$ — Finite Product (core witness: $c_4$ / $\pi_9$)

$$S_4 = \prod\bigl\{\,\mathtt{id}:\mathbb{N},\;\mathtt{name}:\mathtt{string},\;\mathtt{active}:\mathbb{B}\,\bigr\}$$

```typescript
z.object({ id: z.number(), name: z.string(), active: z.boolean() })
```

The canonical labelled record. Tests field labelling, heterogeneous field
types, and closed-world assumption.

---

### $S_5$ — Discriminated Sum (core witness: $c_5$ / $\pi_{20}$)

$$S_5 = \bigl(\{"\mathtt{ok}"\} \times \tau_v\bigr)
        \sqcup
        \bigl(\{"\mathtt{err}"\} \times \tau_e\bigr)$$

```typescript
z.discriminatedUnion("tag", [
  z.object({ tag: z.literal("ok"),  value: z.string() }),
  z.object({ tag: z.literal("err"), error: z.string() }),
])
```

A tagged sum. Combines $S_3$ (literals as discriminants) with $\pi_{20}$
(discriminated union). The core witness for $c_5$ because the *discriminant
mechanism*, not merely set union, must be representable.

---

### $S_6$ — Intersection (core witness: $c_6$ / $\pi_{23}$)

$$S_6 = \tau_A \sqcap \tau_B
  \quad\text{where}\quad
  \tau_A = \{\mathtt{x}:\mathbb{N},\;\mathtt{y}:\mathtt{string}\},\;
  \tau_B = \{\mathtt{x}:\mathbb{Z},\;\mathtt{z}:\mathbb{B}\}$$

$$\llbracket S_6 \rrbracket
  = \bigl\{v \in \mathcal{V} \mid v.\mathtt{x} \in \mathbb{N}
    \land v.\mathtt{y} \in \mathtt{string}
    \land v.\mathtt{z} \in \mathbb{B}\bigr\}$$

```typescript
z.intersection(
  z.object({ x: z.number().int().nonnegative(), y: z.string() }),
  z.object({ x: z.number().int(), z: z.boolean() }),
)
```

Distinct from product: intersection requires a value to satisfy both
constituent types *independently*. The operands share field `x` with
overlapping but non-equal types ($\mathbb{N} \subsetneq \mathbb{Z}$);
the intersection must resolve to the tighter constraint ($\mathbb{N}$).
An IR that flattens intersection into a product merge cannot handle this
case without semantic loss, which is precisely what this witness tests.

---

### $S_7$ — Direct Recursion (core witness: $c_7$ / $\pi_{25}$)

$$S_7 = \mu\alpha.\;\bigl\{\mathtt{value}:\mathtt{string},\;\mathtt{children}:\alpha^{*}\bigr\}$$

```typescript
type Node = { value: string; children: Node[] }
const S7: z.ZodType<Node> = z.lazy(() =>
  z.object({ value: z.string(), children: z.array(S7) })
)
```

Self-referential. Requires the IR to represent a fixpoint or a named
back-reference.

---

### $S_8$ — Mutual Recursion (core witness: $c_8$ / $\pi_{26}$)

Defined as a simultaneous system of recursive equations (the standard
system-of-equations form for mutual recursion):

$$\begin{cases}
\alpha &= \{\mathtt{value}:\mathtt{string},\;\mathtt{next}:\beta\} \\
\beta  &= \{\mathtt{items}:\alpha^{*}\}
\end{cases}$$

The denotations $\llbracket S_8^A \rrbracket, \llbracket S_8^B \rrbracket$
are the components of the least fixpoint of the map
$\Phi : \mathcal{P}(\mathcal{V})^2 \to \mathcal{P}(\mathcal{V})^2$
over the product lattice with component-wise inclusion (see Remark 3.3.2).

```typescript
type A = { value: string; next: B }
type B = { items: A[] }
```

Strictly harder than direct recursion: the IR must resolve a cycle across
two *distinct* named nodes.

---

### $S_9$ — Parametric / Generic (core witness: $c_9$ / $\pi_{28}$)

$$S_9 = \Lambda\alpha.\;\{\mathtt{data}:\alpha,\;\mathtt{meta}:\mathtt{string}\}$$

```typescript
const Response = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({ data: inner, meta: z.string() })
```

A type constructor, not a ground type.

---

### $S_{10}$ — Refinement (core witness: $c_{10}$ / $\pi_{38}$)

$$S_{10} = \bigl\{v : \mathbb{N} \mid 0 \leq v \leq 100 \land v \bmod 5 = 0\bigr\}$$

```typescript
z.number().int().min(0).max(100).multipleOf(5)
```

A base type narrowed by a predicate.

---

### $S_{11}$ — Optionality (core witness: $c_{11}$ / $\pi_{12}$)

$$S_{11} = \bigl\{\mathtt{required}:\mathtt{string},\;\mathtt{optional}:\mathtt{string} \sqcup \mathtt{undefined}\bigr\}$$

```typescript
z.object({ required: z.string(), optional: z.string().optional() })
```

Distinct from nullable ($\tau \sqcup \mathtt{null}$). The IR must encode
*key absence* vs. *key present with null* as two separate states.

---

### $S_{12}$ — Nominal Identity (core witness: $c_{12}$ / $\pi_{35}$)

$$S_{12}^A = \mathrm{nominal}(\mathtt{UserId},\,\mathtt{string}), \quad
  S_{12}^B = \mathrm{nominal}(\mathtt{PostId},\,\mathtt{string})$$

$$\llbracket S_{12}^A \rrbracket = \llbracket S_{12}^B \rrbracket = \mathtt{string}
  \quad\text{but}\quad S_{12}^A \not\leq_{\mathrm{op}} S_{12}^B$$

> *Note.* The non-assignability condition is stated in terms of the
> operational judgment $\leq_{\mathrm{op}}$ (Def. 2.4), not semantic
> subtyping $\leq$ (Def. 2.3). Under $\leq$, equal extensions imply
> $S_{12}^A \equiv S_{12}^B$ by definition, making the criterion
> unsatisfiable. The nominal non-interchangeability is a property the IR
> enforces at its type-checking layer, above the semantic relation.

```typescript
type UserId = string & { readonly __brand: "UserId" }
type PostId = string & { readonly __brand: "PostId" }
```

Two structurally identical types that are not interchangeable.

---

### $S_{13}$ — Open Shape (core witness: $c_{13}$ / $\pi_{17}$)

$$S_{13} = \{\mathtt{id}:\mathbb{N}\} \times \mathcal{V}^{*}$$

```typescript
z.object({ id: z.number() }).passthrough()
```

The closed-world vs. open-world distinction.

---

### $S_{14}$ — Dependent Constraint (core witness: $c_{14}$ / $\pi_{42}$)

$$S_{14} = \bigl\{\mathtt{kind}:\{"\mathtt{int}"\}\sqcup\{"\mathtt{float}"\},\;
  \mathtt{value}:\tau(\mathtt{kind})\bigr\}$$

$$\text{where}\quad\tau(\mathtt{kind}) =
  \begin{cases}
    \mathbb{Z} & \text{if } \mathtt{kind} = \mathtt{"int"}  \\
    \mathbb{R} & \text{if } \mathtt{kind} = \mathtt{"float"}
  \end{cases}$$

```typescript
z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("int"),   value: z.number().int() }),
  z.object({ kind: z.literal("float"), value: z.number() }),
])
```

The type of one field is constrained by the *value* of another.

---

### $S_{15}$ — Higher-Kinded (core witness: $c_{15}$ / $\pi_{32}$)

$$S_{15} = \Lambda(F : {*} \to {*}).\;F(\mathtt{string})$$

```typescript
// Inexpressible in Zod; requires HKT simulation (e.g. fp-ts)
interface Schema<F extends URIS> {
  readonly value: Kind<F, string>
}
```

Abstraction over type constructors [Ref. 9; Ref. 15]. No production
schema IR as of this document's date satisfies $\pi_{32}$ natively.

---

## 10. Completeness and Minimality Theorems

### Theorem 10.1 — $\mathbb{C}$ is $\Pi_{\mathrm{core}}$-Complete

*Statement.* The set $\mathbb{C} = \{S_1, \ldots, S_{15}\}$ is
$\Pi_{\mathrm{core}}$-complete.

*Proof.* By construction: each $S_i$ is defined as the canonical witness for
core criterion $c_i$, so $c_i(S_i) = \top$ for all
$i \in \{1,\ldots,15\}$. $\square$

### Theorem 10.2 — $\mathbb{C}$ is $\Pi_{\mathrm{core}}$-Diverse

*Statement.* $\mathbb{C}$ is $\Pi_{\mathrm{core}}$-diverse (Def. 8.4).

*Proof.* We must show that no $S_i \in \mathbb{C}$ is redundant — i.e.
for each $S_i$, there exists a core criterion $c_i$ that $S_i$ witnesses
and no other $S_j$ ($j \neq i$) witnesses. By Def. 8.2 (orthogonality),
this requires exhibiting, for representative pairs $(c_i, c_j)$, a
schema language $\mathcal{L}$ that satisfies $c_i$ but not $c_j$.
We exhibit four such separation witnesses:

- **$c_1$ (bottom) vs. $c_2$ (top).** Let $\mathcal{L}_1$ be JSON
  Schema draft-07 restricted to the `false` schema and object schemas
  (no `true` schema). Then $\pi_1(\mathcal{L}_1) = \top$ (the `false`
  schema has $\llbracket S \rrbracket = \emptyset$) but
  $\pi_3(\mathcal{L}_1) = \bot$ (no term denotes $\mathcal{V}$). The
  converse language $\mathcal{L}_2$ (admitting `true` but not `false`)
  separates symmetrically. Since $S_1$ is the only schema in
  $\mathbb{C}$ with empty extension, removing it leaves $c_1$ uncovered.

- **$c_7$ (direct recursion) vs. $c_8$ (mutual recursion).** Let
  $\mathcal{L}_7$ be the Zod fragment supporting `z.lazy()` with
  self-back-references but no cross-node cycles. Then
  $\pi_{25}(\mathcal{L}_7) = \top$ ($\mu\alpha.\,F(\alpha)$ is
  expressible) but $\pi_{26}(\mathcal{L}_7) = \bot$ (the simultaneous
  system $(\alpha, \beta)$ cannot be formed). Since $S_8$ is the only
  schema in $\mathbb{C}$ exhibiting mutual recursion, removing it
  leaves $c_8$ uncovered.

- **$c_9$ (parametric) vs. $c_{15}$ (higher-kinded).** Let
  $\mathcal{L}_9$ be TypeScript 5.x (which has rank-1 generics
  $\Lambda\alpha.\,F(\alpha)$ but no kind system). Then
  $\pi_{28}(\mathcal{L}_9) = \top$ but
  $\pi_{32}(\mathcal{L}_9) = \bot$. The converse requires a language
  with HKT but no rank-1 generics, which is degenerate; the relevant
  claim is that no other $S_j \in \mathbb{C}$ exercises rank-1
  parametricity, so removing $S_9$ leaves $c_9$ uncovered.

- **$c_{12}$ (nominal) vs. $c_4$ (product).** Let $\mathcal{L}_{12}$
  be JSON Schema draft-07, which is purely structural. Then
  $\pi_9(\mathcal{L}_{12}) = \top$ (labelled records expressible) but
  $\pi_{35}(\mathcal{L}_{12}) = \bot$ (no branding mechanism). Since
  $S_{12}$ is the only schema in $\mathbb{C}$ requiring
  $\leq_{\mathrm{op}}$ non-interchangeability, removing it leaves
  $c_{12}$ uncovered.

The remaining 11 criteria are separated by analogous arguments: each
$c_i$ identifies a phenomenon whose absence is witnessed by at least
one concrete schema language in common use. $\square$

### Theorem 10.3 — $\Pi_{\mathrm{core}}$-Completeness Does Not Imply IR Universality

*Statement.* If an IR $\mathcal{R}$ admits a semantically faithful encoding
of every $S_i \in \mathbb{C}$, it does not follow that $\mathcal{R}$
strongly models all schema languages.

*Proof.* $\mathbb{C}$ is complete relative to $\Pi_{\mathrm{core}}$, a
15-element core of the full 70-criterion set $\Pi$. An IR scoring 15/15 on
the scorecard (§11) has demonstrated coverage of 15 *named* phenomena; it
has not demonstrated coverage of the remaining 55 criteria in $\Pi$, let
alone universality with respect to any strictly larger class. $\square$

---

## 11. IR Scorecard

An IR $\mathcal{R}$ is scored against the core witness set $\mathbb{C}$
(§9) by attempting to construct a semantically faithful encoding
$\phi(S_i)$ for each core criterion $c_i$. Each cell admits three values:

| Symbol | Meaning |
|---|---|
| ✓ | Faithful encoding exists and is computable (Def. 5.4 + Def. 6.3) |
| partial | Encoding exists but is not fully faithful. Sub-cases: **(a)** *faithfully partial* — faithful on $\mathrm{dom}(\phi) \subsetneq \mathcal{T}(\Sigma)$ but undefined on some type terms (Def. 5.1.1); **(b)** *lossy* — total but only sound, not complete ($\llbracket\phi(\tau)\rrbracket_R \subsetneq \llbracket\tau\rrbracket_\Sigma$ for some $\tau$); **(c)** *convention-dependent* — faithful only under a non-first-class encoding pattern (e.g. phantom-property branding) |
| ✗ | No encoding exists within the IR's current signature |

> *Remark.* The scorecard is an **engineering heuristic** layered over the
> formal criterion framework of §8. Cell values are estimates derived from
> publicly documented behaviour of the evaluated systems as of the document
> date and have not been machine-verified. The formal framework (§8–§10)
> provides the theoretical grounding; the scorecard provides a practical,
> falsifiable snapshot.

### Scorecard Table

| Schema | Phenomenon | JSON Schema (draft-07) | Zod IR (est.) | TypeScript 5.x |
|---|---|:---:|:---:|:---:|
| $S_1$ | Bottom | ✓ (`false`) | ✓ (`never`) | ✓ (`never`) |
| $S_2$ | Top | ✓ (`true`) | ✓ (`unknown`) | ✓ (`unknown`) |
| $S_3$ | Unit | ✓ (`const`) | ✓ (`literal`) | ✓ |
| $S_4$ | Product | ✓ | ✓ | ✓ |
| $S_5$ | Sum | partial | ✓ | ✓ |
| $S_6$ | Intersection | partial | ✓ | ✓ |
| $S_7$ | Direct recursion | ✓ (`$ref`) | ✓ (`lazy`) | ✓ |
| $S_8$ | Mutual recursion | ✓ (`$ref`) | partial | ✓ |
| $S_9$ | Parametric | ✗ | ✗ | ✓ |
| $S_{10}$ | Refinement | partial | ✓ | partial |
| $S_{11}$ | Optionality | partial | ✓ | ✓ |
| $S_{12}$ | Nominal identity | ✗ | partial | partial |
| $S_{13}$ | Open shape | ✓ | ✓ | ✓ |
| $S_{14}$ | Dependent constraint | partial | ✓ | ✓ |
| $S_{15}$ | Higher-kinded | ✗ | ✗ | ✗ |

### Totals

| IR | ✓ | partial | ✗ |
|---|:---:|:---:|:---:|
| JSON Schema (draft-07) | 7 | 5 | 3 |
| Zod IR (est.) | 11 | 2 | 2 |
| TypeScript 5.x | 12 | 2 | 1 |

### Per-Cell Justifications

**$S_5$ — Sum — JSON Schema: partial.** JSON Schema `anyOf`/`oneOf`
[Ref. 12] provides set-union semantics but no first-class discriminant
annotation in draft-07. The `discriminator` keyword was added later in
OpenAPI 3.x [Ref. 14] and JSON Schema draft 2020-12 vocabulary extensions.

**$S_6$ — Intersection — JSON Schema: partial.** `allOf` provides
conjunction semantics, but flattening `allOf` into a merged schema is not
always possible without semantic loss (e.g. when branches define conflicting
constraints on the same field).

**$S_8$ — Mutual Recursion — Zod: partial (faithfully partial, Def. 5.1.1).**
`z.lazy()` handles self-references but requires manual type annotations
for cross-reference cycles and loses type inference. Where the manual
annotations are provided, the encoding is faithful; the partiality is in
$\mathrm{dom}(\phi)$, not in semantic loss.

**$S_9$ — Parametric — JSON Schema / Zod: ✗.** Neither has type-level
abstraction. Both require monomorphisation at the meta-language level.

**$S_{10}$ — Refinement — JSON Schema: partial (faithfully partial, Def. 5.1.1).**
Supports `minimum`, `maximum`, `multipleOf`, `pattern` [Ref. 11; Ref. 12]
— faithful on the covered predicate classes — but cannot express arbitrary
boolean combinations of refinements within the schema vocabulary.
**TypeScript: partial.** No runtime predicate language; branded types
and assertion functions provide partial compile-time narrowing only.

**$S_{11}$ — Optionality — JSON Schema: partial.** Distinguishes required
vs. not-required fields, but `nullable` is not a first-class concept in
draft-07 (it was added in OpenAPI 3.0). The absent-vs-null distinction
is representable but not syntactically prominent.
**TypeScript: ✓.** Distinguishes `key?: T` (key may be absent) from
`key: T | null` (key present, value may be null), especially with
`exactOptionalPropertyTypes`.

**$S_{12}$ — Nominal — JSON Schema: ✗.** Purely structural; no branding.
**Zod: partial.** `.brand()` produces a `ZodBranded` node carrying the
tag, but branding is enforced only at the TypeScript type level; the
validator accepts identical values for differently branded schemas.
**TypeScript: partial.** Branded types use a phantom-property intersection
pattern (`string & { readonly __brand: "X" }`) to enforce non-assignability
at type-check time [Ref. 13]. This is a convention, not a first-class
nominal feature: the compiler accepts structurally identical but differently
branded types if the phantom field is bypassed (e.g. via `as unknown as`).

**$S_{13}$ — Open Shape — JSON Schema: ✓.** Objects are open by default.
**Zod: ✓.** `.passthrough()` faithfully encodes open shapes.
**TypeScript: ✓.** Object types are structurally open by default.

**$S_{14}$ — Dependent — JSON Schema: partial.** `if`/`then`/`else` can
encode finite dependent choices, but the field-to-field dependency is
implicit.
**Zod: ✓.** `z.discriminatedUnion()` explicitly names the discriminant.
**TypeScript: ✓.** Discriminated unions with control-flow narrowing.
Note: the ✓ rating applies to the *finite tagged* dependent case
witnessed by $S_{14}$ ($\pi_{42}$), where the discriminant ranges over
a finite literal set. TypeScript's support degrades for non-finite
dependent constraints (e.g. arbitrary arithmetic relationships between
fields), which would require a more expressive criterion beyond $\pi_{42}$.

**$S_{15}$ — Higher-kinded — all ✗.** No production schema IR or type
system as of this date supports HKTs as a first-class feature. TypeScript's
`fp-ts`-style simulation [Ref. 9; Ref. 15] is a convention the compiler
does not validate.

---

## 12. Criterion Set by Family

### 12.0. Structure

This section enumerates all 70 criteria of $\Pi$ organised by thematic
**family** (A–V). Each criterion is given a formal characterisation and
assigned to one of 22 families. Within each family, criteria range from
coarse phenomena (typically corresponding to core criteria with witness
schemas in §9) to finer sub-dimensions that expose qualitatively different
IR design costs.

Where the purely extensional semantics of §2
($\tau : \mathcal{V} \to \{\top, \bot\}$) is insufficient, the criterion is
tagged **[meta]** with one of four sub-tags identifying the required
enrichment:

| Tag | Enrichment required |
|---|---|
| **[meta-op]** | Operational assignability judgment $\leq_{\mathrm{op}}$ (Def. 2.4) — criteria that depend on the IR's nominal or intentional type-checking layer rather than set-theoretic extension. |
| **[meta-coerce]** | Validation-with-coercion domain — the semantic function maps values to $\mathcal{V} \cup \{\bot\}$ (rejection) or a coerced value, not a Boolean. |
| **[meta-multi]** | Multi-instance semantic domain — the criterion is a predicate on *collections* of values across multiple schema instances, requiring a relational extension of the single-value domain. |
| **[meta-annot]** | Pure annotation — the criterion attaches metadata with no effect on $\llbracket S \rrbracket$; it constrains tooling, code generation, or documentation, not validity judgments. |

**Convention.** Each criterion is numbered $\pi_n$. Criteria
$\pi_1$–$\pi_{49}$ are numbered sequentially within their families;
$\pi_{59}$–$\pi_{70}$ are interleaved into earlier families in the body
but sorted numerically in the summary table (§12.1). Readers should use
§12.1 as the canonical reference for family membership. The "Core" column
in §12.1 indicates which criteria have a witness schema $S_i$ in the
core test set $\mathbb{C}$ (§9).

---

### Family A — Cardinality and Base-Set Structure

---

#### $\pi_1$ — Syntactic Bottom
$$\llbracket S \rrbracket = \emptyset \quad\text{and}\quad
  S \text{ is a designated nullary constructor } \bot \in B$$

The IR carries an explicit, named bottom node. Distinguished from semantic
emptiness ($\pi_2$) because an IR may *derive* emptiness via
unsatisfiable constraints but lack a first-class `never` node.

**Separation witness:** A refinement-capable IR without a `never` node
satisfies $\pi_2$ but not $\pi_1$. An IR with `never` but no refinement
predicates satisfies $\pi_1$ but not $\pi_2$.

---

#### $\pi_2$ — Semantic Emptiness
$$\llbracket S \rrbracket = \emptyset \quad\text{and}\quad
  S \text{ is a compound term whose emptiness follows from constraint interaction}$$

Example: $S = \{v : \mathtt{string} \mid \mathtt{length}(v) < 0\}$.

---

#### $\pi_3$ — Global Top
$$\llbracket S \rrbracket = \mathcal{V}$$

---

#### $\pi_4$ — Sort-Restricted Top
$$\llbracket S \rrbracket = \mathcal{V}_b \subsetneq \mathcal{V}
  \quad\text{where } \mathcal{V}_b = \llbracket b \rrbracket
  \text{ for some base type } b \in B$$

"Top within a sort": all strings, all numbers. Distinguished from global
top because many IRs express "any string" but treat the cross-sort
universal as a separate concept.

---

#### $\pi_5$ — Singleton Literal
$$|\llbracket S \rrbracket| = 1 \quad\text{and}\quad
  S = \ell \text{ for a literal constant } \ell \in \mathcal{V}$$

---

#### $\pi_6$ — Finite Homogeneous Enum
$$\llbracket S \rrbracket = \{v_1, \ldots, v_k\},\quad k \geq 2,\quad
  \exists\, b \in B : \forall i,\; v_i \in \llbracket b \rrbracket$$

Example: `"red" | "green" | "blue"`.

---

#### $\pi_7$ — Finite Heterogeneous Enum
$$\llbracket S \rrbracket = \{v_1, \ldots, v_k\},\quad k \geq 2,\quad
  \nexists\, b \in B : \forall i,\; v_i \in \llbracket b \rrbracket$$

Example: `1 | "one" | true`.

---

### Family B — Products, Records, and Tuples

---

#### $\pi_8$ — Positional Tuple
$$S = (\tau_1, \tau_2, \ldots, \tau_n) \quad\text{(ordered, index-addressed)}$$

---

#### $\pi_9$ — Labelled Record
$$S = \prod\{l_1 : \tau_1,\; \ldots,\; l_n : \tau_n\}$$

Order of declaration is not semantically significant.

---

#### $\pi_{10}$ — Variadic / Rest Element
$$S = (\tau_1, \ldots, \tau_n, \ldots\tau_r^{*})$$

A tuple with a fixed prefix and a variable-length homogeneous tail.
TypeScript: `[string, number, ...boolean[]]`.

---

### Family C — Field Modality

---

#### $\pi_{11}$ — Required Field
$$\forall v \in \llbracket S \rrbracket,\; l_i \in \mathrm{dom}(v)$$

---

#### $\pi_{12}$ — Optional-by-Absence
$$\exists\, v, v' \in \llbracket S \rrbracket :\;
  l_i \in \mathrm{dom}(v) \;\land\; l_i \notin \mathrm{dom}(v')$$

---

#### $\pi_{13}$ — Nullable-by-Value
$$\forall v \in \llbracket S \rrbracket,\; l_i \in \mathrm{dom}(v)
  \quad\text{and}\quad \mathtt{null} \in \llbracket \tau_i \rrbracket$$

Key always present; "missing data" carried in-band as a value.

---

#### $\pi_{14}$ — Default Value **[meta-coerce]**
$S$ associates field $l_i$ with a default value $d_i \in \llbracket \tau_i \rrbracket$. Requires extending the semantic foundation to $\tau : \mathcal{V} \to \mathcal{V} \cup \{\bot\}$ (validation with coercion).

---

#### $\pi_{15}$ — Read-Only / Immutability Marker **[meta-annot]**
$S$ annotates field $l_i$ as read-only: $\mathrm{mut}(l_i) = \bot$. No
effect on extension; constrains usage contexts. Requires a semantic domain
modelling mutability permissions.

---

### Family D — Shape Closure

---

#### $\pi_{16}$ — Closed Record
$$\forall v \in \llbracket S \rrbracket :\;
  \mathrm{dom}(v) = \{l_1, \ldots, l_n\}$$

---

#### $\pi_{17}$ — Open Record, Unconstrained Extras
$$\{l_1, \ldots, l_n\} \subseteq \mathrm{dom}(v);\quad
  \text{extra keys unconstrained}$$

---

#### $\pi_{18}$ — Open Record, Typed Extras
$$\forall l \notin \{l_1, \ldots, l_n\} :\;
  l \in \mathrm{dom}(v) \implies v(l) \in \llbracket \tau_{\mathrm{rest}} \rrbracket$$

JSON Schema: `additionalProperties: { "type": "string" }`.

---

### Family E — Sum and Union Structure

---

#### $\pi_{19}$ — Untagged Union
$$S = \tau_1 \sqcup \tau_2 \quad\text{with no distinguished discriminant field}$$

---

#### $\pi_{20}$ — Discriminated Union, Literal Tag
$$S = \bigsqcup_{i=1}^{k}\bigl(\{d_i\} \times \tau_i\bigr)$$

The IR carries both the tag field name and the mapping $d_i \mapsto \tau_i$.

---

#### $\pi_{21}$ — Shape-Discriminated Union
$$S = \tau_1 \sqcup \tau_2
  \quad\text{where shapes are disjoint on key sets, no shared literal tag}$$

---

#### $\pi_{22}$ — Exhaustive / Closed Union **[meta-annot]**
$$S = \tau_1 \sqcup \cdots \sqcup \tau_k
  \quad\text{with a meta-assertion that the case set is complete}$$

Enables exhaustiveness checking. "Closedness" constrains schema evolution,
not the current extension.

---

### Family F — Intersection

---

#### $\pi_{23}$ — Record-Merge Intersection
$$S = \tau_A \sqcap \tau_B
  \quad\text{where both operands contribute structural fields}$$

---

#### $\pi_{24}$ — Refinement Intersection
$$S = \tau \sqcap \{v : \tau \mid P(v)\}
  \quad\text{where } \tau \text{ is structural and }
  P : \llbracket \tau \rrbracket \to \{\top,\bot\} \text{ is a decidable predicate}$$

The second operand is a refinement type term (per $\pi_{38}$, Def. 3.2
clause 2 with a refinement constructor); it contributes no new fields —
only a narrowing constraint on the values already in $\llbracket\tau\rrbracket$.
Distinguished from $\pi_{23}$ (record-merge intersection) where both
operands contribute structural fields.

---

### Family G — Recursion

---

#### $\pi_{25}$ — Direct Self-Recursion
$$S = \mu\alpha.\,F(\alpha)$$

> *Remark.* This criterion is evaluated under **equi-recursive**
> equivalence: the recursive type $\mu\alpha.\,F(\alpha)$ and its
> one-step unfolding $F(\mu\alpha.\,F(\alpha))$ are semantically
> identical ($\llbracket\mu\alpha.\,F(\alpha)\rrbracket =
> \llbracket F(\mu\alpha.\,F(\alpha))\rrbracket$). This is standard
> for structural schema validation. An IR using **iso-recursive**
> treatment (requiring explicit fold/unfold operations) satisfies
> this criterion only if the unfolding is transparent to the
> validation layer [Ref. 1, Ch. 20]. Among evaluated systems: JSON
> Schema's `$ref` is inherently equi-recursive (the validator resolves
> references transparently during validation), while Zod's `z.lazy()`
> is closer to iso-recursive (the programmer must explicitly introduce
> the indirection point). Both satisfy $\pi_{25}$ because unfolding
> is ultimately transparent to the validation result.

---

#### $\pi_{26}$ — Mutual Recursion
$$S_A = \mu(\alpha, \beta).\,F(\alpha, \beta),\quad
  S_B = \mu(\alpha, \beta).\,G(\alpha, \beta)$$

---

#### $\pi_{27}$ — Recursive Generic
$$S = \Lambda\alpha.\,\mu\beta.\,F(\alpha, \beta)$$

Example: `type Tree<T> = { value: T; children: Tree<T>[] }`. The IR must
handle fixpoint binding *inside* a type-level lambda.

---

### Family H — Parametricity and Higher Kinds

---

#### $\pi_{28}$ — Rank-1 Generics
$$S = \Lambda\alpha.\,F(\alpha)
  \quad\text{with } \alpha \text{ universally quantified at outermost position}$$

---

#### $\pi_{29}$ — Bounded Generics
$$S = \Lambda(\alpha \leq \tau_B).\,F(\alpha)$$

TypeScript: `<T extends Serializable>`. The IR must encode and check the
bound.

---

#### $\pi_{30}$ — Generic Default **[meta-annot]**
$$S = \Lambda(\alpha = \tau_D).\,F(\alpha)$$

TypeScript: `<T = string>`. The default affects instantiation ergonomics,
not the extension of any particular instantiation.

---

#### $\pi_{31}$ — Higher-Rank Polymorphism
$$S \text{ contains a quantifier nested under a constructor: }
  f(\ldots, \forall\alpha.\,\tau, \ldots)$$

Requires quantifiers at arbitrary depth. Strictly stronger than $\pi_{28}$.

---

#### $\pi_{32}$ — Higher-Kinded Type Parameter
$$S = \Lambda(F : \kappa_1 \to \kappa_2).\,G(F)$$

Abstraction over type constructors [Ref. 9; Ref. 15]. The IR must
represent kinds.

---

#### $\pi_{33}$ — Variance Annotation **[meta-op]**
$$S = \Lambda(\alpha^{+}).\,F(\alpha)
  \quad\text{or}\quad
  S = \Lambda(\alpha^{-}).\,F(\alpha)$$

Variance affects the subtyping relation on instantiated types, not the
extension of any single instantiation.

---

### Family I — Nominal Identity and Branding

---

#### $\pi_{34}$ — Structural Identity Only
$$S_1 \equiv S_2 \;\iff\; \llbracket S_1 \rrbracket = \llbracket S_2 \rrbracket$$

Baseline: no mechanism to distinguish structurally identical types.

---

#### $\pi_{35}$ — Nominal Tag / Brand **[meta-op]**
$$\llbracket S_1 \rrbracket = \llbracket S_2 \rrbracket
  \;\text{but}\; \mathrm{name}(S_1) \neq \mathrm{name}(S_2)
  \;\implies\; S_1 \not\leq_{\mathrm{op}} S_2$$

Tagged **[meta-op]** because under the semantic subtyping relation $\leq$
(Def. 2.3), equal extensions entail $S_1 \leq S_2$ by definition. The
non-assignability condition is meaningful only under the IR's operational
judgment $\leq_{\mathrm{op}}$ (Def. 2.4), consistent with the base
criterion $\pi_{35}$.

---

#### $\pi_{36}$ — Opaque / Newtype Wrapper **[meta-op]**
$$S = \mathrm{opaque}(\mathtt{Tag},\, \tau_{\mathrm{under}});\quad
  \llbracket S \rrbracket = \llbracket \tau_{\mathrm{under}} \rrbracket
  \;\text{but}\; S \not\leq_{\mathrm{op}} \tau_{\mathrm{under}} \;\land\;
  \tau_{\mathrm{under}} \not\leq_{\mathrm{op}} S$$

Nominal wrapper with no implicit conversion in either direction. Tagged
**[meta-op]** because equal extensions entail mutual $\leq$ under semantic
subtyping; the bidirectional non-assignability is enforced only by the
operational judgment (Def. 2.4).

---

#### $\pi_{37}$ — Explicit Coercion Edge **[meta-op]**
$$S_1 \not\leq S_2
  \;\text{but the IR declares a coercion } c : S_1 \to S_2$$

The IR must represent coercions as first-class edges in the type graph.

---

### Family J — Refinement and Predicate Structure

---

#### $\pi_{38}$ — Range / Bound Constraint
$$S = \{v : \tau \mid a \leq v \leq b\}$$

---

#### $\pi_{39}$ — Pattern / Regex Constraint
$$S = \{v : \mathtt{string} \mid v \in L(r)\}$$

Membership in a regular language. Operates on string structure, not numeric
ordering.

---

#### $\pi_{40}$ — Modular / Divisibility Constraint
$$S = \{v : \mathbb{Z} \mid v \bmod m = 0\}$$

---

#### $\pi_{41}$ — Compound Decidable Predicate
$$S = \{v : \tau \mid P_1(v) \land P_2(v)\}
  \quad\text{or}\quad
  \{v : \tau \mid P_1(v) \lor P_2(v)\}$$

Boolean combinations of atomic refinements.

---

#### $\pi_{68}$ — String Concatenation Closure
$$S = S_1 \cdot S_2
  \quad\text{where}\quad
  \llbracket S \rrbracket = \{s_1 s_2 \mid s_1 \in \llbracket S_1 \rrbracket, s_2 \in \llbracket S_2 \rrbracket\}$$

A type constructor that produces the concatenation of two string types.
TypeScript template literal types: `` `${string}@${string}` ``.
Distinguished from regex ($\pi_{39}$) because this is a *type-level
constructor* that composes structurally, not merely a membership filter.

---

#### $\pi_{69}$ — String Pattern Decomposition **[meta-op]**
Given $v \in \llbracket S_1 \cdot S_2 \rrbracket$, the IR can infer the
types of the sub-parts. This is an inference-engine property: the IR
supports *type-level string deconstruction* (TypeScript's `infer` in
template literal positions). Tagged **[meta]** because the decomposition
capability is a property of the IR's inference algorithm, not of any
single type's extension.

---

### Family K — Value Dependency

---

#### $\pi_{42}$ — Finite Tagged Dependent Choice
$$\tau_j = f(v_i)
  \quad\text{where } f \text{ ranges over a finite set of cases}$$

---

#### $\pi_{43}$ — Intra-Object Cross-Field Constraint
$$S = \prod\{l_1 : \tau_1, l_2 : \tau_2\}
  \quad\text{subject to } P(v.l_1, v.l_2)$$

Example: `start ≤ end`. Neither field's type changes; their joint value
space is restricted.

---

#### $\pi_{44}$ — Inter-Object Referential Constraint **[meta-multi]**
A foreign-key constraint: $S_1$ contains a field whose value must appear
in an instance of $S_2$. Requires a multi-instance semantic domain.

---

#### $\pi_{67}$ — Path-Navigating Constraint
$$P(\mathrm{path}_1(v),\, \mathrm{path}_2(v))
  \quad\text{where } \mathrm{path}_i \text{ is a compound accessor expression}$$

Constraints that navigate through nested structure. SHACL property paths,
JSONPath-based validation, JSON Schema `$data` references. Orthogonal to
$\pi_{43}$ because the constraint traverses structural depth, requiring the
IR to represent *path expressions* into nested records.

**Separation witness:** SHACL `sh:path ( sh:inversePath ex:parent )` —
an inverse-path traversal that no flat sibling-field predicate can express.

---

### Family L — Collection Types

---

#### $\pi_{45}$ — Homogeneous Array / List
$$S = \tau^{*}$$

Variable-length, element-type homogeneous.

---

#### $\pi_{46}$ — Set / Unique Collection
$$S = \mathcal{P}_{\mathrm{fin}}(\tau)
  \quad\text{with } \forall i \neq j,\; v_i \neq v_j$$

The IR must encode and validate uniqueness.

---

#### $\pi_{47}$ — Map / Dictionary
$$S = \tau_K \to_{\mathrm{fin}} \tau_V$$

Finite partial function from keys to values. Key set not statically known.

---

### Family M — Computation Types

---

#### $\pi_{48}$ — Function / Arrow Type
$$S = \tau_1 \to \tau_2$$

---

#### $\pi_{49}$ — Overloaded Function / Intersection of Arrows
$$S = (\tau_{1a} \to \tau_{1b}) \;\sqcap\; (\tau_{2a} \to \tau_{2b})$$

Multiple call signatures with call-site resolution semantics.

---

### Family N — Modularity and Scoping **[meta-annot]**

---

#### $\pi_{50}$ — Named Type Alias / Definition **[meta-annot]**
$$S = \mathrm{let}\; n = \tau \;\mathrm{in}\; \ldots$$

Extensionally equivalent to inlining; the name exists for tooling and
human comprehension.

---

#### $\pi_{51}$ — Module / Namespace Scoping **[meta-annot]**
$$\mathrm{module}\; M = \{n_1 : \tau_1,\; \ldots,\; n_k : \tau_k\}$$

Hierarchical grouping with independent name scopes.

---

#### $\pi_{52}$ — Visibility / Export Control **[meta-annot]**
Public vs. private definitions within a module.

---

### Family O — Evolution and Compatibility **[meta-annot]**

---

#### $\pi_{53}$ — Deprecation Annotation **[meta-annot]**
Mark a type or field as deprecated with optional metadata.

---

#### $\pi_{54}$ — Versioned Schema Identity **[meta-annot]**
Associate a version identifier with a schema definition.

---

#### $\pi_{55}$ — Backward Compatibility Relation **[meta-annot]**
Assert $\llbracket S_{v1} \rrbracket \subseteq \llbracket S_{v2} \rrbracket$
across versions.

> *Remark $\pi_{55}$.1 — Binary nature.* Backward compatibility is
> inherently a property of a *pair* of schema versions, not of a single
> type term. It is therefore more naturally an encoding-check property
> (Def. 13.1). It is retained here as a unary criterion by treating the
> *versioned schema pair* $(S_{v1}, S_{v2})$ as the atomic object under
> test — the criterion asks whether the IR can *express and decide* the
> compatibility relation, not whether a single schema satisfies it. The
> corresponding encoding-check formulation is given as $\rho_B$ in §13.

---

### Family P — Meta-Annotation **[meta-annot]**

---

#### $\pi_{56}$ — Description / Documentation **[meta-annot]**
Attach human-readable description to any node.

---

#### $\pi_{57}$ — Example Values **[meta-annot]**
Attach example values with informal expectation $e_i \in \llbracket S \rrbracket$.

---

#### $\pi_{58}$ — Custom Extension Metadata **[meta-annot]**
Arbitrary key-value metadata on any node. JSON Schema `x-` keywords.

---

### Family Q — Type-Level Negation and Complement

---

#### $\pi_{59}$ — Type-Level Complement
$$S = \neg\tau \qquad \llbracket \neg\tau \rrbracket = \mathcal{V} \setminus \llbracket \tau \rrbracket$$

The operand is a *type term*, not a value predicate over a fixed base sort.
JSON Schema `not`, TypeScript `Exclude<T, U>`. Distinguished from predicate
negation inside a refinement ($\pi_{41}$): an IR can support
$\{v : \mathtt{number} \mid \neg(v > 5)\}$ without being able to express
$\neg\mathrm{object}(\{\mathtt{id}: \mathbb{N}\})$.

> **Warning (§7, Remark 7.1.2).** Combining $\pi_{59}$ with $\pi_{25}$
> ($\mu$) and $\pi_{28}$ ($\Lambda$) creates a decidability hazard
> [Ref. 2; Ref. 4; Ref. 20]. An IR satisfying all three must establish
> termination of its type equivalence decision procedure.

---

### Family R — Unsound / Bivariant Types

---

#### $\pi_{60}$ — Unsound Bivariant Type **[meta-op]**
$$\exists\, S \in \mathcal{N}_R : \forall \tau \in \mathcal{N}_R,\;
  S \leq_{\mathrm{op}} \tau \;\land\; \tau \leq_{\mathrm{op}} S
  \quad\text{where } \leq_{\mathrm{op}} \neq \leq$$

A type that is simultaneously assignable to and from all other types under
the IR's operational judgment, breaking antisymmetry. TypeScript's `any` is
the canonical instance.

Tagged **[meta]** because this criterion depends on the operational
assignability judgment $\leq_{\mathrm{op}}$ (Def. 2.4), not on the
semantic subtyping relation $\leq$ (Def. 2.3). Under $\leq$, the criterion
is unsatisfiable by construction (it would force all types to have
identical extensions).

---

### Family S — Phantom and Indexed Types

---

#### $\pi_{61}$ — Phantom Type Parameter **[meta-op]**
$$S = \Lambda\alpha.\, \tau_0 \quad \text{where } \alpha \notin \mathrm{FTV}(\tau_0),\quad
\text{but } S(\tau_1) \not\leq_{\mathrm{op}} S(\tau_2) \text{ for } \tau_1 \neq \tau_2$$

The parameter does not appear in the structural body, yet instantiations
are non-interchangeable under the IR's operational assignability judgment.
Used for type-safe state machines, units of measure, and access-control
markers.

Tagged **[meta-op]** because under the semantic subtyping relation $\leq$
(Def. 2.3) the enforcement condition is unsatisfiable: since
$\alpha \notin \mathrm{FTV}(\tau_0)$, we have
$\llbracket S(\tau_1) \rrbracket = \llbracket \tau_0 \rrbracket =
\llbracket S(\tau_2) \rrbracket$, so $S(\tau_1) \leq S(\tau_2)$ holds
unconditionally. Non-interchangeability must therefore be enforced by the
IR's operational judgment $\leq_{\mathrm{op}}$ (Def. 2.4) — i.e. a
nominal mechanism that distinguishes instantiations even when their
extensions coincide. The required enrichment is exactly that of $\pi_{60}$.

Distinguished from $\pi_{28}$–$\pi_{33}$ (where the parameter *occurs*
in the body) and from $\pi_{50}$ (named alias, where distinct names do not
affect subtyping under most IRs). The enforcement condition
($S(\tau_1) \not\leq_{\mathrm{op}} S(\tau_2)$) is essential: without it,
a purely structural IR erases phantoms and the criterion collapses.

---

#### $\pi_{62}$ — GADT / Indexed Type
$$S = \Lambda\alpha.\,\bigsqcup_{i \in I}\bigl(\{\alpha \equiv c_i\} \Rightarrow \tau_i\bigr)$$

where $I$ is a finite index set, $c_i$ are distinct type-level constants
(constructor identifiers), $\{\alpha \equiv c_i\}$ is a type-level
equality constraint on the index parameter $\alpha$, and each $\tau_i$
is a (possibly distinct) product type. The index $\alpha$ determines the
*structural shape* of the type — which fields and constructors are
available — not merely an element type or a single field's value.

The index determines the *shape* of the type (which constructors are
available), not just the element type or a single field's type [Ref. 17].
Strictly stronger than $\pi_{29}$ (bounded generics) + $\pi_{42}$ (finite
dependent choice): the dependency is from a *type-level* index to the
structural shape of the product, not from a value-level tag to a
branch-local type. A concrete IR encoding this criterion must be able to
represent the constraint $\{\alpha \equiv c_i\}$ and narrow the
available constructors at each branch accordingly.

---

### Family T — Type-Level Computation

---

#### $\pi_{63}$ — Structural Key Enumeration
$$\mathrm{keyof}\,\tau \;:\; \text{the type of all label names in record type } \tau$$

A type-level operator taking a type as input and producing the union of its
key literals. TypeScript: `keyof T`. Cannot be expressed as a fixed type
term; it is a *type-level function*.

---

#### $\pi_{64}$ — Mapped Type
$$\{[K \in \mathrm{keyof}\,\tau]: F(K, \tau[K])\}$$

Transforms each field of a source type through a type-level function.
Strictly above HKT ($\pi_{32}$) because it requires structural
*introspection* of the source type, not just abstraction over a
constructor.

**Independence from $\pi_{63}$:** Mapped types can iterate over an
explicit key set without `keyof`. An IR satisfying $\pi_{64}$ need not
support $\pi_{63}$ if it provides the key set by other means.

---

#### $\pi_{65}$ — Conditional Type
$$S = \tau_1 \;\mathtt{extends}\; \tau_2\; ?\; \tau_A : \tau_B$$

A type-level case expression requiring the IR to embed a subtyping test
inside a type constructor. Fundamentally different from value-level
dependent choices ($\pi_{42}$) because the branch condition is a
*type-level* judgment, not a runtime value.

**Independence from $\pi_{63}$ and $\pi_{64}$:** Conditional types
operate on arbitrary types, not only on record field sets. No logical
dependency on `keyof` or mapped types.

---

### Family U — Row Polymorphism

---

#### $\pi_{66}$ — Row-Polymorphic Record
$$S = \Lambda\rho.\,\prod\{l_1 : \tau_1,\; \ldots,\; l_n : \tau_n \mid \rho\}$$

A record type parameterised by a *row variable* $\rho$ abstracting over the
"rest" of the fields [Ref. 6; Ref. 7]. OCaml polymorphic variants and
Rémy-style row types are the canonical examples; Castagna & Peyrot extend
this to set-theoretic types with union, intersection, and negation [Ref. 8].

Distinguished from open records ($\pi_{17}$), which allow any extra fields
but don't abstract over them parametrically, and from rank-1 generics
($\pi_{28}$), which abstract over element types but not over field sets. An
IR supporting both $\pi_{17}$ and $\pi_{28}$ but lacking row variables
cannot express "a function that works on any record with at least field
`id: number`, preserving all other fields."

---

### Family V — Temporal / Stateful Types

---

#### $\pi_{70}$ — State-Machine Type **[meta-op]**
A type whose valid inhabitant at time $t+1$ depends on the inhabitant at
time $t$ — a *transition relation* encoded in the type. Relevant for UML
statecharts, lifecycle APIs, and workflow schemas.

Tagged **[meta]** because it requires enriching the semantic domain beyond
single-value predicates to a domain with *transition functions* or
*state-indexed type families*.

---

### 12.1. Summary Table

| Id | Name | Family | Core | [meta] tag |
|---|---|---|:---:|:---:|
| $\pi_1$ | Syntactic bottom | A | $S_1$ | |
| $\pi_2$ | Semantic emptiness | A | — | |
| $\pi_3$ | Global top | A | $S_2$ | |
| $\pi_4$ | Sort-restricted top | A | — | |
| $\pi_5$ | Singleton literal | A | $S_3$ | |
| $\pi_6$ | Finite homogeneous enum | A | — | |
| $\pi_7$ | Finite heterogeneous enum | A | — | |
| $\pi_8$ | Positional tuple | B | — | |
| $\pi_9$ | Labelled record | B | $S_4$ | |
| $\pi_{10}$ | Variadic / rest element | B | — | |
| $\pi_{11}$ | Required field | C | — | |
| $\pi_{12}$ | Optional-by-absence | C | $S_{11}$ | |
| $\pi_{13}$ | Nullable-by-value | C | — | |
| $\pi_{14}$ | Default value | C | — | coerce |
| $\pi_{15}$ | Read-only marker | C | — | annot |
| $\pi_{16}$ | Closed record | D | — | |
| $\pi_{17}$ | Open, unconstrained extras | D | $S_{13}$ | |
| $\pi_{18}$ | Open, typed extras | D | — | |
| $\pi_{19}$ | Untagged union | E | — | |
| $\pi_{20}$ | Discriminated union | E | $S_5$ | |
| $\pi_{21}$ | Shape-discriminated union | E | — | |
| $\pi_{22}$ | Exhaustive / closed union | E | — | annot |
| $\pi_{23}$ | Record-merge intersection | F | $S_6$ | |
| $\pi_{24}$ | Refinement intersection | F | — | |
| $\pi_{25}$ | Direct self-recursion | G | $S_7$ | |
| $\pi_{26}$ | Mutual recursion | G | $S_8$ | |
| $\pi_{27}$ | Recursive generic | G | — | |
| $\pi_{28}$ | Rank-1 generics | H | $S_9$ | |
| $\pi_{29}$ | Bounded generics | H | — | |
| $\pi_{30}$ | Generic default | H | — | annot |
| $\pi_{31}$ | Higher-rank polymorphism | H | — | |
| $\pi_{32}$ | Higher-kinded type parameter | H | $S_{15}$ | |
| $\pi_{33}$ | Variance annotation | H | — | op |
| $\pi_{34}$ | Structural identity only | I | — | |
| $\pi_{35}$ | Nominal tag / brand | I | $S_{12}$ | op |
| $\pi_{36}$ | Opaque / newtype wrapper | I | — | op |
| $\pi_{37}$ | Explicit coercion edge | I | — | op |
| $\pi_{38}$ | Range / bound constraint | J | $S_{10}$ | |
| $\pi_{39}$ | Pattern / regex constraint | J | — | |
| $\pi_{40}$ | Modular / divisibility constraint | J | — | |
| $\pi_{41}$ | Compound decidable predicate | J | — | |
| $\pi_{42}$ | Finite tagged dependent choice | K | $S_{14}$ | |
| $\pi_{43}$ | Cross-field constraint | K | — | |
| $\pi_{44}$ | Inter-object referential constraint | K | — | multi |
| $\pi_{45}$ | Homogeneous array / list | L | — | |
| $\pi_{46}$ | Set / unique collection | L | — | |
| $\pi_{47}$ | Map / dictionary | L | — | |
| $\pi_{48}$ | Function / arrow type | M | — | |
| $\pi_{49}$ | Overloaded function | M | — | |
| $\pi_{50}$ | Named type alias | N | — | annot |
| $\pi_{51}$ | Module / namespace | N | — | annot |
| $\pi_{52}$ | Visibility / export control | N | — | annot |
| $\pi_{53}$ | Deprecation annotation | O | — | annot |
| $\pi_{54}$ | Versioned schema identity | O | — | annot |
| $\pi_{55}$ | Backward compatibility | O | — | annot |
| $\pi_{56}$ | Description / documentation | P | — | annot |
| $\pi_{57}$ | Example values | P | — | annot |
| $\pi_{58}$ | Custom extension metadata | P | — | annot |
| $\pi_{59}$ | Type-level complement | Q | — | |
| $\pi_{60}$ | Unsound bivariant type | R | — | op |
| $\pi_{61}$ | Phantom type parameter | S | — | op |
| $\pi_{62}$ | GADT / indexed type | S | — | |
| $\pi_{63}$ | Structural key enumeration | T | — | |
| $\pi_{64}$ | Mapped type | T | — | |
| $\pi_{65}$ | Conditional type | T | — | |
| $\pi_{66}$ | Row-polymorphic record | U | — | |
| $\pi_{67}$ | Path-navigating constraint | K | — | |
| $\pi_{68}$ | String concatenation closure | J | — | |
| $\pi_{69}$ | String pattern decomposition | J | — | op |
| $\pi_{70}$ | State-machine type | V | — | op |

**Totals:** 70 criteria across 22 families. 48 extensional, 22 meta-structural.

---

### 12.2. Orthogonality Notes

$\Pi$ satisfies a *family-structured independence* property rather than
strict pairwise orthogonality across all 70 criteria.

**Inter-family independence.** Criteria from distinct families are
orthogonal: they target different syntactic and semantic dimensions.

**Intra-family independence.** Within each family, criteria are *pairwise
separable*: for each pair, there exists an IR or schema language satisfying
one but not the other. Separation witnesses are provided in the criterion
definitions.

**Acknowledged subsumption edges:**

- $\pi_{31}$ (higher-rank) strictly subsumes $\pi_{28}$ (rank-1).
- $\pi_{32}$ (higher-kinded) strictly subsumes $\pi_{28}$ (rank-1).
- $\pi_{41}$ (compound predicate) subsumes $\pi_{38}$–$\pi_{40}$
  individually.
- $\pi_{36}$ (opaque wrapper) implies $\pi_{35}$ (nominal tag) but
  not vice versa.

These are retained because the subsumed criteria represent lower IR design
costs. An IR scoring ✓ on $\pi_{38}$ but ✗ on $\pi_{41}$ conveys
useful information.

To recover strict orthogonality, quotient $\Pi$ by subsumption edges,
yielding approximately 62–64 independent criteria.

---

### 12.3. Deferred Phenomena (v2 Candidates)

The following phenomena were identified during review but deferred:

| Phenomenon | Reason for Deferral |
|---|---|
| Gradual typing with consistency relation ($\pi_{S1}$–$\pi_{S3}$) | Requires substantially enriched semantic domain; not present in target languages (TS `any` is modelled by $\pi_{60}$ instead) |
| Linear / affine types ($\pi_{V1}$–$\pi_{V3}$) | Requires usage-multiplicity judgments; relevant for Rust/Haskell, not current targets |
| Session types ($\pi_{W1}$–$\pi_{W3}$) | Requires protocol duality semantics; relevant for streaming/messaging, deferred to protocol-layer extensions |
| Invariant preservation under update ($\pi_{X2}$) | Hoare-logic–style assertion on execution traces; out of scope for type-theoretic criterion set |
| Cardinality-typed collection dependency ($\pi_{K4}$) | Independence from existing criteria not established; needs separation witness |

---

### 12.4. Rejected Proposals

| Proposal | Rejection Rationale |
|---|---|
| $\pi_{Q2}$ — Difference type | Derivable as $\tau_A \sqcap \neg\tau_B$ from $\pi_{59} + \pi_{23}$; not independent |
| $\pi_{F3}$ — Method intersection with `this` | Already covered by $\mu$ ($\pi_{25}$/$\pi_{26}$) + function type ($\pi_{48}$) + record-merge intersection ($\pi_{23}$); conflates syntactic pattern with semantic phenomenon |
| $\pi_{X2}$ — Invariant under update | Predicate on execution traces, not on types or values; requires Hoare-logic framework, not type-theoretic criteria |
| DNF/CNF normalizability | Property of the IR's algorithms (decidability/complexity), not of its type language expressiveness; belongs in a complexity-profile companion document |

### 12.5. Future Work: Full Witness Set and 70-Criterion Scorecard

The core subset $\Pi_{\mathrm{core}}$ has a corresponding
$\Pi_{\mathrm{core}}$-diverse schema set
$\mathbb{C} = \{S_1,\ldots,S_{15}\}$ (§9) and a machine-applicable
scorecard (§11). A full diverse schema set covering all 70 criteria has not
yet been constructed.

**Missing $\mathbb{C}_{\mathrm{full}}$.** A diverse schema set
$\mathbb{C}_{\mathrm{full}} = \{S'_1,\ldots,S'_{70}\}$ analogous to
$\mathbb{C}$ — one schema per criterion, each the primary witness for at
least one $\pi_i$ that no other element covers — would enable direct
scorecard evaluation against the full $\Pi$. Without it, the 55 criteria
outside $\Pi_{\mathrm{core}}$ serve as a taxonomy and IR design reference,
not as a plug-in test suite.

**Missing full scorecard.** §11 scores three IRs against
$\Pi_{\mathrm{core}}$ (15 criteria). An analogous 70-criterion scorecard
requires constructing $\mathbb{C}_{\mathrm{full}}$ first.

Both are deferred to a future revision. Candidates contributing
$\mathbb{C}_{\mathrm{full}}$ witnesses should verify:
(1) $\pi_i(S'_i) = \top$ for the claimed primary witness,
(2) $S'_i$ is distinct from $S'_j$ in the sense of Def. 8.4, and
(3) [meta-op] witnesses explicitly state the operational enrichment
being tested.

---

## 13. Encoding-Check Layer

### 13.0. Motivation

Some schema phenomena — notably subtyping-precision properties — are not
properties of individual type terms but of *pairs* of type terms under the
IR's encoding function. These cannot be formalised as unary criteria
$\pi : \mathcal{T}(\Sigma) \to \{\top, \bot\}$ per Def. 8.1. This section
defines a complementary evaluation layer operating on the encoding $\phi$.

### Definition 13.1 — Encoding-Check Property

An **encoding-check property** is a decidable predicate on the encoding
function $\phi$ evaluated against a pair of witness schemas:

$$\rho : (\mathcal{T}(\Sigma)^2 \times (\mathcal{T}(\Sigma) \to \mathcal{N}_R)) \to \{\top, \bot\}$$

The property $\rho(S_1, S_2, \phi) = \top$ asserts that $\phi$ preserves
a specific subtyping relationship between $S_1$ and $S_2$.

### Definition 13.2 — Subtyping Precision Properties

The following encoding-check properties evaluate how faithfully $\phi$
preserves the structure of the subtyping relation:

**$\rho_W$ — Width Subtyping Preservation.** Given witness schemas
$S_{\mathrm{wide}} = \{a:\tau_1, b:\tau_2, \ldots\mathcal{V}^*\}$ and
$S_{\mathrm{narrow}} = \{a:\tau_1, \ldots\mathcal{V}^*\}$ — both
*open* records (satisfying $\pi_{17}$) — where
$S_{\mathrm{wide}} \leq S_{\mathrm{narrow}}$ (a record with more known
fields is a subtype of one with fewer, under open-record semantics):

$$\rho_W(S_{\mathrm{wide}}, S_{\mathrm{narrow}}, \phi) = \top
  \;\iff\; \phi(S_{\mathrm{wide}}) \leq_R \phi(S_{\mathrm{narrow}})$$

**$\rho_D$ — Depth Subtyping Preservation.** Given witness schemas
$S_{\mathrm{deep}} = \{a:\tau_1\}$ and
$S_{\mathrm{shallow}} = \{a:\tau_2\}$ where $\tau_1 \leq \tau_2$:

$$\rho_D(S_{\mathrm{deep}}, S_{\mathrm{shallow}}, \phi) = \top
  \;\iff\; \phi(S_{\mathrm{deep}}) \leq_R \phi(S_{\mathrm{shallow}})$$

**$\rho_G$ — Subtyping Under Generics.** Given witness schemas
$S_1 = F(\tau_1)$ and $S_2 = F(\tau_2)$ where $\tau_1 \leq \tau_2$ and
$F$ is a type constructor:

$$\rho_G(F(\tau_1), F(\tau_2), \phi) = \top
  \;\iff\; \phi(F(\tau_1)) \leq_R \phi(F(\tau_2))$$

Note: $\rho_G$ should hold when $F$ is covariant; it should *fail* when $F$
is contravariant (and the inequality should reverse). The encoding-check
evaluates whether $\phi$ respects the variance declaration.

**$\rho_B$ — Backward Compatibility Preservation.** Given witness schemas
$S_{v1}$ (old version) and $S_{v2}$ (new version) where
$\llbracket S_{v1} \rrbracket \subseteq \llbracket S_{v2} \rrbracket$
(every value valid under the old schema remains valid under the new):

$$\rho_B(S_{v1}, S_{v2}, \phi) = \top
  \;\iff\; \llbracket\phi(S_{v1})\rrbracket_R \subseteq \llbracket\phi(S_{v2})\rrbracket_R$$

This is the encoding-check formulation of $\pi_{55}$. It verifies that
the encoding preserves the backward-compatibility inclusion across versions,
and makes explicit that compatibility is a binary property on schema pairs.

### Remark 13.3 — Relationship to $\Pi$

The encoding-check layer is architecturally parallel to the unary criterion
set $\Pi$. Both evaluate the IR, but at different levels: $\Pi$ asks
"can the IR *represent* this type term?"; the encoding-check layer asks
"does the IR's encoding *preserve* this subtyping relationship?"

An IR may score ✓ on all relevant $\Pi$ criteria yet fail encoding-check
properties — e.g. an IR that represents both $S_{\mathrm{wide}}$ and
$S_{\mathrm{narrow}}$ faithfully but whose internal subtyping judgment
does not relate them correctly.

### Remark 13.4 — Witness Pairs

Evaluating the encoding-check layer requires concrete witness pairs for
each property. These are analogous to the diverse schema set $\mathbb{C}$
but are pairs rather than individual schemas:

| Property | $S_1$ (subtype) | $S_2$ (supertype) | System examples |
|---|---|---|---|
| $\rho_W$ | $\{a:\mathbb{N}, b:\mathtt{string}, \ldots\}$ (open) | $\{a:\mathbb{N}, \ldots\}$ (open) | TypeScript, SHACL |
| $\rho_D$ | $\{a:\{x:\mathbb{N}\}\}$ | $\{a:\{x:\mathbb{Z}\}\}$ | TypeScript, Java |
| $\rho_G$ | $\mathtt{Array}\langle\mathbb{N}\rangle$ | $\mathtt{Array}\langle\mathbb{Z}\rangle$ | Covariant only; Java arrays (unsound), TS `readonly` arrays |
| $\rho_B$ | $S_{v1}$ (old version) | $S_{v2}$ (new version, additive) | Protobuf field-addition, JSON Schema draft evolution |

### Remark 13.5 — Independence of Encoding-Check Properties

The four encoding-check properties $\rho_W, \rho_D, \rho_G, \rho_B$ are
evaluated independently. An encoding $\phi$ may satisfy each property
individually yet fail a *conjunctive* property that combines two or more
dimensions — for example, an IR that correctly preserves width subtyping
and depth subtyping in isolation but breaks the subtyping relationship
when width and depth variations occur simultaneously in the same schema
pair. In abstract-interpretation terminology, the individual properties
correspond to separate abstract domains, and their independent
satisfaction does not guarantee the precision of their *reduced product*
(Cousot & Cousot [Ref. 4, §4]). A full reduced-product analysis of the
encoding-check layer is left for future work.

---

## 14. Glossary

All definitions reference the section where they are formally introduced.
Symbols are listed first, followed by terms in alphabetical order.

### Symbols

| Symbol | Name | Definition |
|---|---|---|
| $\mathcal{V}$ | Value universe | The countably infinite set of all values in the semantic domain (Def. 2.1) |
| $\tau$ | Type | A total function $\mathcal{V} \to \{\top, \bot\}$ classifying values (Def. 2.2) |
| $\llbracket \tau \rrbracket$ | Extension | The set of values accepted by $\tau$: $\{v \mid \tau(v) = \top\}$ (Def. 2.2) |
| $\leq$ | Subtyping | Extension inclusion: $\tau_1 \leq \tau_2 \iff \llbracket\tau_1\rrbracket \subseteq \llbracket\tau_2\rrbracket$ (Def. 2.3) |
| $\leq_{\mathrm{op}}$ | Operational subtyping | IR's assignability judgment, may diverge from $\leq$ (Def. 2.4) |
| $\equiv$ | Type equality | Bi-directional subtyping: $\llbracket\tau_1\rrbracket = \llbracket\tau_2\rrbracket$ (Def. 2.3) |
| $\Sigma$ | Signature | Tuple $(B, \mathcal{F}, \mathrm{ar})$ (Def. 3.1) |
| $\mathcal{T}(\Sigma)$ | Type terms | Least set of well-formed terms over $\Sigma$ (Def. 3.2) |
| $\llbracket \cdot \rrbracket_\Sigma$ | Denotational semantics | Compositional mapping from terms to extensions (Def. 3.3) |
| $\mathcal{L}$ | Schema language | Triple $(\Sigma, \mathcal{T}(\Sigma), \llbracket\cdot\rrbracket_\Sigma)$ (Def. 3.4) |
| $\mathcal{R}$ | IR | Schema language + IR nodes $\mathcal{N}_R$ (Def. 4.1) |
| $\mathcal{N}_R$ | IR nodes | Encodable subset of $\mathcal{T}(\Sigma_R)$ (Def. 4.1) |
| $\phi$ | Encoding | Total function $\mathcal{T}(\Sigma) \to \mathcal{N}_R$ (Def. 5.1) |
| $\vDash$ | Models | $\mathcal{R} \vDash \mathcal{L}$: faithful encoding exists (Def. 5.6) |
| $\mathbb{S}$ | Schema class | Collection of schema languages (Def. 6.1) |
| $\Pi$ | Criterion set | 70 criteria across 22 families (§8, §12) |
| $\Pi_{\mathrm{core}}$ | Core criterion subset | 15 independently testable criteria with witness schemas (§9) |
| $\mathbb{C}$ | Diverse schema set | $\Pi_{\mathrm{core}}$-diverse test set $\{S_1, \ldots, S_{15}\}$ (§9) |
| $\sim_\Pi$ | $\Pi$-equivalence | Agreement on all criteria in $\Pi$ (Def. 8.2) |
| $\rho$ | Encoding-check property | Binary predicate on witness pairs under $\phi$ (Def. 13.1) |
| $\bot$ | Bottom type | $\llbracket\bot\rrbracket = \emptyset$ ($\pi_1$) |
| $\top$ | Top type | $\llbracket\top\rrbracket = \mathcal{V}$ ($\pi_3$) |
| $\neg$ | Complement | $\llbracket\neg\tau\rrbracket = \mathcal{V} \setminus \llbracket\tau\rrbracket$ ($\pi_{59}$) |
| $\prod$ | Product | Labelled finite product ($\pi_9$) |
| $\sqcup$ | Union / Sum | Set-theoretic union or disjoint sum ($\pi_{20}$) |
| $\sqcap$ | Intersection | Set-theoretic intersection ($\pi_{23}$) |
| $\mu$ | Fixpoint | Recursive type binder ($\pi_{25}$) |
| $\Lambda$ | Type abstraction | Universal type-level abstraction ($\pi_{28}$, $\pi_{32}$) |

### Terms

**Atomicity (of a criterion).** The property that $\pi_i$ is not
decomposable into a conjunction of independent sub-criteria (Def. 8.2).

**Backward compatibility.** $\llbracket S_{v1} \rrbracket \subseteq
\llbracket S_{v2} \rrbracket$: every value valid under the old schema
remains valid under the new one ($\pi_{55}$).

**Bounded generics.** A parametric type with an upper-bound constraint on
its type parameter: $\Lambda(\alpha \leq \tau_B).\,F(\alpha)$ ($\pi_{29}$).
TypeScript: `<T extends Serializable>`.

**Computability (of an encoding).** The requirement that $\phi$ be
implementable by a terminating algorithm (Def. 6.3).

**Conditional type.** A type-level case expression:
$\tau_1 \;\mathtt{extends}\; \tau_2 \;?\; \tau_A : \tau_B$ ($\pi_{65}$).

**Coverage criterion.** A decidable predicate identifying a structurally
or semantically distinct phenomenon (Def. 8.1).

**Dependent constraint.** A schema in which the type of one field is
determined by the *value* of another field ($\pi_{42}$).

**Direct recursion.** $S = \mu\alpha.\,F(\alpha)$ ($\pi_{25}$).

**Encoding.** A total function $\phi : \mathcal{T}(\Sigma) \to \mathcal{N}_R$
(Def. 5.1).

**Encoding-check property.** A decidable predicate on the encoding function
evaluated against a pair of witness schemas (Def. 13.1).

**Extension.** $\llbracket\tau\rrbracket = \{v \mid \tau(v) = \top\}$
(Def. 2.2).

**GADT / Indexed type.** A type where a type-level index refines the
available constructors or fields ($\pi_{62}$).

**Higher-kinded type.** Abstraction over type constructors
($\pi_{32}$).

**Intermediate Representation (IR).** Schema language $\mathcal{R}$ +
IR nodes $\mathcal{N}_R$ (Def. 4.1).

**Mapped type.** $\{[K \in \mathrm{keyof}\,\tau]: F(K, \tau[K])\}$ —
structural transformation of a source type ($\pi_{64}$).

**Mutual recursion.** A cycle involving two or more distinct named types
($\pi_{26}$).

**Nominal identity.** Structurally identical types distinguished by name
under the operational judgment ($\pi_{35}$).

**Observational basis.** A finite set of criteria inducing $\sim_\Pi$
(Def. 8.2).

**Open shape.** A record admitting additional properties
($\pi_{17}$).

**Operational subtyping.** An IR's assignability judgment, which may
diverge from semantic subtyping (Def. 2.4).

**Optionality.** Key-absence semantics ($\pi_{12}$).

**Orthogonality (of criteria).** Neither implies the other; independent
schema languages witness each (Def. 8.2).

**Parametricity.** Type-level abstraction: $\Lambda\alpha.\,F(\alpha)$
($\pi_{28}$).

**Path-navigating constraint.** A constraint traversing nested structure
via compound accessor expressions ($\pi_{67}$).

**Phantom type parameter.** A type parameter not occurring in the
structural body, yet semantically relevant under nominal interpretation
($\pi_{61}$).

**$\Pi$-Complete.** Every criterion witnessed by at least one schema
(Def. 8.3).

**$\Pi$-Diverse.** $\Pi$-complete and orthogonally minimal (Def. 8.4).

**Refinement type.** $\{v : \tau \mid P(v)\}$ ($\pi_{38}$ff).

**Row polymorphism.** Record types parameterised by a row variable
abstracting over unspecified fields ($\pi_{66}$) [Ref. 6; Ref. 7].

**Row variable.** A type-level variable $\rho$ ranging over sets of
record fields, used in row-polymorphic record types
$\prod\{l_1:\tau_1,\ldots,l_n:\tau_n \mid \rho\}$ ($\pi_{66}$).
Distinct from ordinary type variables ($\alpha$) which range over
element types, not field sets.

**Schema.** A finite, well-formed type term $S \in \mathcal{T}(\Sigma)$
(Def. 3.5).

**Schema class.** A collection of schema languages (Def. 6.1).

**Schema language.** $(\Sigma, \mathcal{T}(\Sigma), \llbracket\cdot\rrbracket_\Sigma)$ (Def. 3.4).

**Semantic completeness.** $\llbracket\tau\rrbracket_\Sigma \subseteq
\llbracket\phi(\tau)\rrbracket_R$ (Def. 5.3).

**Semantic faithfulness.** $\llbracket\phi(\tau)\rrbracket_R =
\llbracket\tau\rrbracket_\Sigma$ (Def. 5.4).

**Semantic soundness.** $\llbracket\phi(\tau)\rrbracket_R \subseteq
\llbracket\tau\rrbracket_\Sigma$ (Def. 5.2).

**Shape-discriminated union.** A union $\tau_1 \sqcup \tau_2$ where the
branches are distinguished by their structural key sets rather than a
shared literal-tagged field ($\pi_{21}$).

**Signature.** $(B, \mathcal{F}, \mathrm{ar})$ (Def. 3.1).

**Sort-restricted top.** A top type restricted to a single base sort:
$\llbracket S \rrbracket = \mathcal{V}_b$ for some $b \in B$ ($\pi_4$).
For example, "any string" or "any number" rather than the global
$\mathcal{V}$.

**State-machine type.** A type whose valid inhabitant depends on the prior
state via a transition relation ($\pi_{70}$).

**String concatenation closure.** A type constructor producing
$\{s_1 s_2 \mid s_1 \in \llbracket S_1 \rrbracket, s_2 \in \llbracket S_2 \rrbracket\}$ ($\pi_{68}$).

**Strong universality.** Faithful and *computable* encoding for each
language in $\mathbb{S}$ (Def. 6.3).

**Structure preservation.** Monotonicity of $\phi$ under $\leq$ (Def. 5.5).

**Template literal type.** A string type constructed by concatenating
fixed string segments with typed slots, producing a regular or
context-free language of string values. Related to $\pi_{68}$ (string
concatenation closure) and $\pi_{69}$ (string pattern decomposition).
TypeScript: `` `${'GET' | 'POST'} /${string}` ``.

**Type term.** Element of $\mathcal{T}(\Sigma)$ (Def. 3.2).

**Typed extras.** Additional fields in an open record constrained to a
specific type: $\forall l \notin \{l_1,\ldots,l_n\} : v(l) \in
\llbracket\tau_{\mathrm{rest}}\rrbracket$ ($\pi_{18}$). JSON Schema:
`additionalProperties: { "type": "string" }`.

**Unit / Singleton type.** $|\llbracket S \rrbracket| = 1$
($\pi_5$).

**Unsound bivariant type.** A type satisfying $S \leq_{\mathrm{op}} \tau$
and $\tau \leq_{\mathrm{op}} S$ for all $\tau$ under operational subtyping,
breaking antisymmetry ($\pi_{60}$).

**Value universe.** The countably infinite set $\mathcal{V}$ (Def. 2.1).

**Variadic / rest element.** A tuple type with a fixed-length prefix and
a variable-length homogeneous tail: $(\tau_1,\ldots,\tau_n,\ldots\tau_r^*)$
($\pi_{10}$). TypeScript: `[string, number, ...boolean[]]`.

**Weak universality.** Every schema has a matching IR node, without
computability requirement (Def. 6.2).

---

## 15. References

1. **Pierce.** *Types and Programming Languages.* MIT Press, 2002.

2. **Frisch, Castagna, Benzaken.** "Semantic Subtyping: Dealing
   Set-theoretically with Function, Union, Intersection, and Negation
   Types." *Journal of the ACM* 55(4), 2008.
   DOI: `10.1145/1391289.1391293`.

3. **Tarski.** "A Lattice-Theoretical Fixpoint Theorem and its
   Applications." *Pacific Journal of Mathematics* 5(2), 1955.

4. **Castagna, Frisch.** "A Gentle Introduction to Semantic Subtyping."
   *ICALP/PPDP joint invited paper*, 2005.

5. **Cardelli, Wegner.** "On Understanding Types, Data Abstraction, and
   Polymorphism." *Computing Surveys* 17(4), 1985.
   DOI: `10.1145/6041.6042`.

6. **Rémy.** "Type Checking Records and Variants in a Natural Extension
   of ML." *POPL*, 1989. DOI: `10.1145/75277.75284`.

7. **Wand.** "Complete Type Inference for Simple Objects." *LICS*, 1987,
   pp. 37–44.

8. **Castagna, Peyrot.** "Polymorphic Records for Dynamic Languages."
   *OOPSLA*, 2025.

9. **Yallop, White.** "Lightweight Higher-Kinded Polymorphism."
   *FLOPS*, 2014. LNCS 8475, pp. 119–135.
   DOI: `10.1007/978-3-319-07151-0_8`.

10. **Kozen, Palsberg, Schwartzbach.** "Efficient Recursive Subtyping."
    *Mathematical Structures in Computer Science* 5(1), 1995.
    DOI: `10.1017/S0960129500000645`.

11. **Pezoa, Reutter, Suarez, Ugarte, Vrgoč.** "Foundations of JSON
    Schema." *WWW*, 2016. DOI: `10.1145/2872427.2883029`.

12. **Wright et al.** "JSON Schema: A Media Type for Describing JSON
    Documents." Draft-07, 2018.
    `https://json-schema.org/draft-07/json-schema-release-notes`.

13. **TypeScript Handbook.** "Type Compatibility." Microsoft.
    `https://www.typescriptlang.org/docs/handbook/type-compatibility.html`.

14. **OpenAPI Initiative.** "OpenAPI Specification 3.1.0 — Discriminator
    Object." 2021.
    `https://spec.openapis.org/oas/v3.1.0#discriminator-object`.

15. **Yorgey.** "The Typeclassopedia." *The Monad.Reader*, Issue 13,
    2009.

16. **Rice.** "Classes of Recursively Enumerable Sets and Their Decision
    Problems." *Transactions of the AMS* 74(2), 1953.
    DOI: `10.1090/S0002-9947-1953-0053041-6`.

17. **Xi, Chen, Chen.** "Guarded Recursive Datatype Constructors."
    *POPL*, 2003. DOI: `10.1145/604131.604150`.

18. **Milner.** *Communication and Concurrency.* Prentice Hall, 1989.

19. **Sangiorgi, Walker.** *The π-Calculus: A Theory of Mobile
    Processes.* Cambridge University Press, 2001.

20. **Castagna, Xu.** "Set-Theoretic Foundation of Parametric
    Polymorphism and Subtyping." *ICFP*, 2011.
    DOI: `10.1145/2034773.2034788`.
