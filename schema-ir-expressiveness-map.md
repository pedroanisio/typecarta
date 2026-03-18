---
title: "Schema IR Expressiveness — Formal Specification"
version: "2.0.0"
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
  v2.0.0 — Consolidated revision incorporating: completed §11 scorecard;
  expanded criterion set Π' (70 criteria across 22 families); accepted
  additions from two review rounds (Families Q, S₀, T, U, X₁, K₅, J₅,
  row polymorphism); encoding-check layer for subtyping precision
  (Family R); updated §7 impossibility boundary with μ+¬ decidability
  interaction; extended §2 semantic foundation with operational subtyping
  distinction. Rejected proposals: Q₂ (derivable), X₂ (out of scope),
  F₃ (already covered), DNF/CNF (complexity-profile concern, not
  expressiveness criterion).
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
9. [The Diverse Schema Set C](#9-the-diverse-schema-set-c)
10. [Completeness and Minimality Theorems](#10-completeness-and-minimality-theorems)
11. [IR Scorecard](#11-ir-scorecard)
12. [Expanded Criterion Set Π'](#12-expanded-criterion-set-π)
13. [Encoding-Check Layer](#13-encoding-check-layer)
14. [Glossary](#14-glossary)

---

## 1. Scope and Purpose

This specification establishes a formal framework for reasoning about the
*expressive power* of a schema Intermediate Representation (IR) relative to
a class of source schema languages. It defines:

- what it means for an IR to **model** a schema language (§5);
- what it means for an IR to **model any schema** in a class (§6);
- the **impossibility boundary** that every finite IR must respect (§7);
- a **finite, orthogonally minimal test set** $\mathbb{C}$ that witnesses 15
  independent schema phenomena, together with the criterion set $\Pi$ that
  motivates it (§8–§9);
- a machine-applicable **scorecard** for evaluating real IRs against
  $\mathbb{C}$ (§11);
- an **expanded criterion set** $\Pi'$ of 70 granular criteria across 22
  families, refined from $\Pi$ through two rounds of adversarial review
  (§12);
- an **encoding-check layer** for evaluating subtyping-precision properties
  of an IR's encoding function (§13).

The framework is *language-neutral*. Zod, JSON Schema, OpenAPI, and
TypeScript appear only as illustrative examples, not as normative targets.

---

## 2. Semantic Foundation

### Definition 2.1 — Value Universe

Let $\mathcal{V}$ be a fixed, countably infinite set of **values** — the
semantic domain. Concretely, $\mathcal{V}$ may be taken as all
JSON-representable values extended with typed primitives (integers, dates,
binary blobs), but the framework does not depend on this choice provided
$\mathcal{V}$ is countably infinite.

### Definition 2.2 — Type

A **type** $\tau$ is a total function:

$$\tau : \mathcal{V} \to \{\top, \bot\}$$

Its **extension** is the set of values it accepts:

$$\llbracket \tau \rrbracket \;=\; \{\, v \in \mathcal{V} \mid \tau(v) = \top \,\} \;\subseteq\; \mathcal{V}$$

> *Remark 2.2.1.* This definition does not require $\tau$ to be effectively
> decidable. §7 distinguishes the decidable and undecidable cases when
> deriving the impossibility result.

### Definition 2.3 — Subtyping

The **subtyping relation** $\leq$ on types is defined by extension inclusion:

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
> deliberate and constitutes a designed unsoundness.

> *Remark 2.4.2.* Criteria in $\Pi'$ that depend on the operational
> judgment rather than the semantic relation are tagged **[meta]** and
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

> *Remark 3.2.1 — Extended type-level operators.* The term-formation
> rules above cover only nullary base types and $n$-ary constructor
> applications $f(\tau_1,\ldots,\tau_n)$. Several type-level operators
> used in the expanded criterion set $\Pi'$ fall outside this grammar:
>
> - **Fixpoint binder** $\mu\alpha.\,\tau$ ($\pi_7$, $\pi'_{25}$–$\pi'_{27}$):
>   a variable-binding form; cannot be expressed as a fixed-arity constructor.
> - **Complement** $\neg\tau$ ($\pi'_{59}$): unary, but its semantics
>   ($\llbracket\neg\tau\rrbracket = \mathcal{V}\setminus\llbracket\tau\rrbracket$)
>   require access to the full semantic domain, not just sub-term denotations.
> - **Key enumeration** $\mathrm{keyof}\,\tau$ ($\pi'_{63}$): a type-level
>   introspection operator with no fixed arity.
> - **Conditional type** $\tau_1\;\mathtt{extends}\;\tau_2\;?\;\tau_A:\tau_B$
>   ($\pi'_{65}$): embeds a subtyping judgment inside a constructor.
>
> The definition of $\mathcal{T}(\Sigma)$ here is therefore *illustrative*:
> it defines the core grammar sufficient for the base criterion set $\Pi$.
> Concrete schema languages and IRs may extend the term-formation rules
> with additional binders or type-level operators; wherever this document
> uses such operators, the corresponding extension is implied.

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
> judgments in this document — including $\Pi'$ criteria in
> Families H ($\pi'_{28}$–$\pi'_{33}$), G ($\pi'_{27}$), and S
> ($\pi'_{61}$–$\pi'_{62}$) — are therefore interpreted at ground
> instantiations only. A fully kinded treatment (where types of kind
> $* \to *$ denote functions $\mathcal{P}(\mathcal{V}) \to
> \mathcal{P}(\mathcal{V})$) is left for future formalisation.

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
$\mathcal{T}(\Sigma)$, not merely for a recognisable subset.

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
applies. In that restricted setting, impossibility must be argued separately
— for example via Rice's theorem applied to non-trivial semantic properties
of IR encodings. Both routes confirm the same boundary; the unrestricted
version is more direct for motivating why $\mathbb{S}$ must always be named.

### Remark 7.1.2 — Decidability Interactions: $\mu + \neg$

The expanded criterion set $\Pi'$ (§12) includes both recursive types
($\mu$, Family G) and type-level complement ($\neg$, Family Q). Their
combination creates a decidability hazard that the cardinality argument of
Prop. 7.1 does not capture.

Semantic subtyping with recursive types and full Boolean connectives
($\sqcup$, $\sqcap$, $\neg$) has been shown decidable for specific
set-theoretic type systems (Frisch, Castagna, Benzaken, 2008). However,
the decidability result is *fragile*: it depends on restrictions such as
regularity of the recursive types (the set of sub-terms reachable by
unfolding is finite) and the absence of certain features (e.g. unrestricted
$\mu$ under $\neg$ combined with parametric polymorphism can push
equivalence checking from PSPACE to undecidable).

An IR that admits $\pi'_{59}$ ($\neg$), $\pi'_{25}$ ($\mu$), and
$\pi'_{28}$ ($\Lambda$) simultaneously must establish that its type
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
> properties** in §13 rather than as unary criteria in $\Pi$ or $\Pi'$.

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

### Table 8.5 — The Criterion Set $\Pi$ (15 Criteria)

| Id | Name | Formal Characterisation |
|---|---|---|
| $\pi_1$ | **Bottom / Empty** | $\llbracket S \rrbracket = \emptyset$ |
| $\pi_2$ | **Top / Universal** | $\llbracket S \rrbracket = \mathcal{V}$ |
| $\pi_3$ | **Unit / Singleton** | $\lvert\llbracket S \rrbracket\rvert = 1$ |
| $\pi_4$ | **Finite Product** | $S = \prod_{i=1}^{n}\tau_i$, $n < \infty$ |
| $\pi_5$ | **Sum / Union** | $S = \tau_1 \sqcup \tau_2$ (discriminated or not) |
| $\pi_6$ | **Intersection** | $S = \tau_1 \sqcap \tau_2$ with $\llbracket\tau_1\rrbracket \cap \llbracket\tau_2\rrbracket \neq \emptyset, \mathcal{V}$ |
| $\pi_7$ | **Direct Recursion** | $S = \mu\alpha.\,F(\alpha)$ for some type functor $F$ |
| $\pi_8$ | **Mutual Recursion** | $S_1 = \mu(\alpha,\beta).\,F(\alpha,\beta)$; $S_2 = \mu(\alpha,\beta).\,G(\alpha,\beta)$ |
| $\pi_9$ | **Parametricity** | $S = \Lambda\alpha.\,F(\alpha)$ — type-level abstraction |
| $\pi_{10}$ | **Refinement** | $S = \{\,v:\tau \mid P(v)\,\}$ — base type plus predicate |
| $\pi_{11}$ | **Optionality** | $S = \tau \sqcup \mathtt{undefined}$ with observable key-absence semantics |
| $\pi_{12}$ | **Nominal Identity** | $\llbracket S_1\rrbracket = \llbracket S_2\rrbracket$ yet $S_1 \not\leq_{\mathrm{op}} S_2$ — same extension, distinct under the IR's operational judgment **[meta-op]** |
| $\pi_{13}$ | **Open Shape** | $S = \prod_{\mathrm{known}}\tau_i \times \mathcal{V}^{*}$ — extensible record |
| $\pi_{14}$ | **Dependent Constraint** | $S = \prod_i \tau_i$ where $\tau_j$ is determined by $v_i$ |
| $\pi_{15}$ | **Higher-Kinded** | $S = \Lambda(F : {*} \to {*}).\,F(\tau)$ — abstraction over type constructors |

**Remark on $\pi_{14}$.** Full dependent types are undecidable in general.
The operationally useful restriction is *finitely-enumerable conditional
typing* — where $\tau_j$ ranges over a finite set determined by the value of
field $i$ — which remains decidable.

**Remark on $\pi_{15}$.** $\pi_{15}$ properly subsumes $\pi_9$: $\pi_9$
abstracts over a type argument; $\pi_{15}$ abstracts over the container
structure (type constructor) itself. Both criteria are retained because they
expose different IR design costs.

---

## 9. The Diverse Schema Set $\mathbb{C}$

Each schema below is specified in three forms:

1. Formal type term using the notation established in §3.
2. Illustrative encoding in Zod-style pseudocode (non-normative).
3. The primary criterion $\pi_i$ it witnesses.

---

### $S_1$ — Bottom (primary witness: $\pi_1$)

$$S_1 = \bot \qquad \llbracket S_1 \rrbracket = \emptyset$$

```typescript
z.never()
```

The unique schema with no valid inhabitant. Any IR lacking a bottom node
cannot encode `never`, uninhabited union branches, or
exhaustion-checked switch arms.

---

### $S_2$ — Top (primary witness: $\pi_2$)

$$S_2 = \top \qquad \llbracket S_2 \rrbracket = \mathcal{V}$$

```typescript
z.unknown()
```

Dual of bottom. Required for passthrough fields, catch-all validators, and
escape hatches. Distinct from `any` in systems that enforce safe-access
discipline on the top type.

---

### $S_3$ — Unit / Literal (primary witness: $\pi_3$)

$$S_3 = \{42\} \qquad \llbracket S_3 \rrbracket = \{42\}$$

```typescript
z.literal(42)
```

A singleton type. A necessary prerequisite for discriminated unions: without
literal types the IR cannot encode tagged sum discriminants correctly.

---

### $S_4$ — Finite Product (primary witness: $\pi_4$)

$$S_4 = \prod\bigl\{\,\mathtt{id}:\mathbb{N},\;\mathtt{name}:\mathtt{string},\;\mathtt{active}:\mathbb{B}\,\bigr\}$$

```typescript
z.object({ id: z.number(), name: z.string(), active: z.boolean() })
```

The canonical labelled record. Tests field labelling, heterogeneous field
types, and closed-world assumption.

---

### $S_5$ — Discriminated Sum (primary witness: $\pi_5$)

$$S_5 = \bigl(\{"\mathtt{ok}"\} \times \tau_v\bigr)
        \sqcup
        \bigl(\{"\mathtt{err}"\} \times \tau_e\bigr)$$

```typescript
z.discriminatedUnion("tag", [
  z.object({ tag: z.literal("ok"),  value: z.string() }),
  z.object({ tag: z.literal("err"), error: z.string() }),
])
```

A tagged sum. Combines $S_3$ (literals as discriminants) with $\pi_5$
(union). The primary witness for $\pi_5$ because the *discriminant
mechanism*, not merely set union, must be representable.

---

### $S_6$ — Intersection (primary witness: $\pi_6$)

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

### $S_7$ — Direct Recursion (primary witness: $\pi_7$)

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

### $S_8$ — Mutual Recursion (primary witness: $\pi_8$)

$$S_8^A = \mu(\alpha,\beta).\;\{\mathtt{value}:\mathtt{string},\;\mathtt{next}:\beta\}$$
$$S_8^B = \mu(\alpha,\beta).\;\{\mathtt{items}:\alpha^{*}\}$$

```typescript
type A = { value: string; next: B }
type B = { items: A[] }
```

Strictly harder than direct recursion: the IR must resolve a cycle across
two *distinct* named nodes.

---

### $S_9$ — Parametric / Generic (primary witness: $\pi_9$)

$$S_9 = \Lambda\alpha.\;\{\mathtt{data}:\alpha,\;\mathtt{meta}:\mathtt{string}\}$$

```typescript
const Response = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({ data: inner, meta: z.string() })
```

A type constructor, not a ground type.

---

### $S_{10}$ — Refinement (primary witness: $\pi_{10}$)

$$S_{10} = \bigl\{v : \mathbb{N} \mid 0 \leq v \leq 100 \land v \bmod 5 = 0\bigr\}$$

```typescript
z.number().int().min(0).max(100).multipleOf(5)
```

A base type narrowed by a predicate.

---

### $S_{11}$ — Optionality (primary witness: $\pi_{11}$)

$$S_{11} = \bigl\{\mathtt{required}:\mathtt{string},\;\mathtt{optional}:\mathtt{string} \sqcup \mathtt{undefined}\bigr\}$$

```typescript
z.object({ required: z.string(), optional: z.string().optional() })
```

Distinct from nullable ($\tau \sqcup \mathtt{null}$). The IR must encode
*key absence* vs. *key present with null* as two separate states.

---

### $S_{12}$ — Nominal Identity (primary witness: $\pi_{12}$)

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

### $S_{13}$ — Open Shape (primary witness: $\pi_{13}$)

$$S_{13} = \{\mathtt{id}:\mathbb{N}\} \times \mathcal{V}^{*}$$

```typescript
z.object({ id: z.number() }).passthrough()
```

The closed-world vs. open-world distinction.

---

### $S_{14}$ — Dependent Constraint (primary witness: $\pi_{14}$)

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

### $S_{15}$ — Higher-Kinded (primary witness: $\pi_{15}$)

$$S_{15} = \Lambda(F : {*} \to {*}).\;F(\mathtt{string})$$

```typescript
// Inexpressible in Zod; requires HKT simulation (e.g. fp-ts)
interface Schema<F extends URIS> {
  readonly value: Kind<F, string>
}
```

Abstraction over type constructors. No production schema IR as of this
document's date satisfies $\pi_{15}$ natively.

---

## 10. Completeness and Minimality Theorems

### Theorem 10.1 — $\mathbb{C}$ is $\Pi$-Complete

*Statement.* The set $\mathbb{C} = \{S_1, \ldots, S_{15}\}$ is $\Pi$-complete.

*Proof.* By construction: each $S_i$ is defined as the canonical witness for
$\pi_i$, so $\pi_i(S_i) = \top$ for all $i \in \{1,\ldots,15\}$. $\square$

### Theorem 10.2 — $\mathbb{C}$ is $\Pi$-Diverse

*Statement.* $\mathbb{C}$ is $\Pi$-diverse (Def. 8.4).

*Proof.* Each $S_i$ is designed so that $\pi_i$ is its *unique* primary
witness criterion. By the orthogonality requirement on $\Pi$ (Def. 8.2),
removing any $S_i$ from $\mathbb{C}$ leaves $\pi_i$ uncovered. $\square$

### Theorem 10.3 — $\Pi$-Completeness Does Not Imply IR Universality

*Statement.* If an IR $\mathcal{R}$ admits a semantically faithful encoding
of every $S_i \in \mathbb{C}$, it does not follow that $\mathcal{R}$
strongly models all schema languages.

*Proof.* $\mathbb{C}$ is complete relative to $\Pi$, which is a finite
observational basis for the equivalence $\sim_\Pi$. There may exist schema
phenomena outside $\Pi$ — e.g. gradual typing, session types, linear types —
for which $\mathbb{C}$ contains no witness. An IR scoring 15/15 on the
scorecard (§11) has demonstrated coverage of 15 *named* phenomena under
$\sim_\Pi$; it has not demonstrated universality with respect to any
strictly larger class. $\square$

---

## 11. IR Scorecard

An IR $\mathcal{R}$ is scored against $\mathbb{C}$ by attempting to
construct a semantically faithful encoding $\phi(S_i)$ for each $i$.
Each cell admits three values:

| Symbol | Meaning |
|---|---|
| ✓ | Faithful encoding exists and is computable |
| partial | Encoding is sound but not complete, or complete but not computable, or computable only with semantic loss |
| ✗ | No encoding exists within the IR's current signature |

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
provides set-union semantics but no first-class discriminant annotation in
draft-07. The `discriminator` keyword was added later in OpenAPI 3.x and
JSON Schema draft 2020-12 vocabulary extensions.

**$S_6$ — Intersection — JSON Schema: partial.** `allOf` provides
conjunction semantics, but flattening `allOf` into a merged schema is not
always possible without semantic loss (e.g. when branches define conflicting
constraints on the same field).

**$S_8$ — Mutual Recursion — Zod: partial.** `z.lazy()` handles
self-references but requires manual type annotations for cross-reference
cycles and loses type inference.

**$S_9$ — Parametric — JSON Schema / Zod: ✗.** Neither has type-level
abstraction. Both require monomorphisation at the meta-language level.

**$S_{10}$ — Refinement — JSON Schema: partial.** Supports `minimum`,
`maximum`, `multipleOf`, `pattern`, but cannot express arbitrary
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
**TypeScript: partial.** Phantom-brand intersection pattern enforces
non-assignability at type-check time, but the mechanism is a convention
requiring phantom properties, not a first-class nominal feature.

**$S_{13}$ — Open Shape — JSON Schema: ✓.** Objects are open by default.
**Zod: ✓.** `.passthrough()` faithfully encodes open shapes.
**TypeScript: ✓.** Object types are structurally open by default.

**$S_{14}$ — Dependent — JSON Schema: partial.** `if`/`then`/`else` can
encode finite dependent choices, but the field-to-field dependency is
implicit.
**Zod: ✓.** `z.discriminatedUnion()` explicitly names the discriminant.
**TypeScript: ✓.** Discriminated unions with control-flow narrowing.

**$S_{15}$ — Higher-kinded — all ✗.** No production schema IR or type
system as of this date supports HKTs as a first-class feature. TypeScript's
`fp-ts`-style simulation is a convention the compiler does not validate.

---

## 12. Expanded Criterion Set $\Pi'$

### 12.0. Methodology

The base criterion set $\Pi$ defines 15 criteria. This section expands
$\Pi$ into $\Pi' = \{\pi'_1, \ldots, \pi'_{70}\}$ by:

1. **Splitting** coarse criteria along observable sub-dimensions where two
   schemas satisfy the same $\pi_i$ yet expose qualitatively different IR
   design costs.

2. **Adding** criteria for phenomena absent from $\Pi$: collection
   structure, computation types, type-level complement, type-level
   computation, phantom/indexed types, row polymorphism, unsound bivariant
   types, state-machine types, path-navigating constraints, structural
   string types, modularity, evolution, and meta-annotation.

Every criterion is assigned to a **family** (thematic group) and given a
formal characterisation. Where the purely extensional semantics of §2
($\tau : \mathcal{V} \to \{\top, \bot\}$) is insufficient, the criterion is
tagged **[meta]** with one of four sub-tags identifying the required
enrichment:

| Tag | Enrichment required |
|---|---|
| **[meta-op]** | Operational assignability judgment $\leq_{\mathrm{op}}$ (Def. 2.4) — criteria that depend on the IR's nominal or intentional type-checking layer rather than set-theoretic extension. |
| **[meta-coerce]** | Validation-with-coercion domain — the semantic function maps values to $\mathcal{V} \cup \{\bot\}$ (rejection) or a coerced value, not a Boolean. |
| **[meta-multi]** | Multi-instance semantic domain — the criterion is a predicate on *collections* of values across multiple schema instances, requiring a relational extension of the single-value domain. |
| **[meta-annot]** | Pure annotation — the criterion attaches metadata with no effect on $\llbracket S \rrbracket$; it constrains tooling, code generation, or documentation, not validity judgments. |

**Convention.** Each criterion is numbered $\pi'_n$. The original $\pi_i$
it refines (if any) is noted in parentheses. Criteria $\pi'_1$–$\pi'_{49}$
were numbered sequentially with their families. Criteria
$\pi'_{59}$–$\pi'_{70}$ were added in later review rounds and retain their
"added last" numbers; they are interleaved into earlier families in the
body but sorted numerically in the summary table (§12.1). Readers should
use §12.1 as the canonical reference for family membership.

---

### Family A — Cardinality and Base-Set Structure

---

#### $\pi'_1$ — Syntactic Bottom (refines $\pi_1$)

$$\llbracket S \rrbracket = \emptyset \quad\text{and}\quad
  S \text{ is a designated nullary constructor } \bot \in B$$

The IR carries an explicit, named bottom node. Distinguished from semantic
emptiness ($\pi'_2$) because an IR may *derive* emptiness via
unsatisfiable constraints but lack a first-class `never` node.

**Separation witness:** A refinement-capable IR without a `never` node
satisfies $\pi'_2$ but not $\pi'_1$. An IR with `never` but no refinement
predicates satisfies $\pi'_1$ but not $\pi'_2$.

---

#### $\pi'_2$ — Semantic Emptiness (refines $\pi_1$)

$$\llbracket S \rrbracket = \emptyset \quad\text{and}\quad
  S \text{ is a compound term whose emptiness follows from constraint interaction}$$

Example: $S = \{v : \mathtt{string} \mid \mathtt{length}(v) < 0\}$.

---

#### $\pi'_3$ — Global Top (refines $\pi_2$)

$$\llbracket S \rrbracket = \mathcal{V}$$

---

#### $\pi'_4$ — Sort-Restricted Top (new)

$$\llbracket S \rrbracket = \mathcal{V}_b \subsetneq \mathcal{V}
  \quad\text{where } \mathcal{V}_b = \llbracket b \rrbracket
  \text{ for some base type } b \in B$$

"Top within a sort": all strings, all numbers. Distinguished from global
top because many IRs express "any string" but treat the cross-sort
universal as a separate concept.

---

#### $\pi'_5$ — Singleton Literal (refines $\pi_3$)

$$|\llbracket S \rrbracket| = 1 \quad\text{and}\quad
  S = \ell \text{ for a literal constant } \ell \in \mathcal{V}$$

---

#### $\pi'_6$ — Finite Homogeneous Enum (new)

$$\llbracket S \rrbracket = \{v_1, \ldots, v_k\},\quad k \geq 2,\quad
  \exists\, b \in B : \forall i,\; v_i \in \llbracket b \rrbracket$$

Example: `"red" | "green" | "blue"`.

---

#### $\pi'_7$ — Finite Heterogeneous Enum (new)

$$\llbracket S \rrbracket = \{v_1, \ldots, v_k\},\quad k \geq 2,\quad
  \nexists\, b \in B : \forall i,\; v_i \in \llbracket b \rrbracket$$

Example: `1 | "one" | true`.

---

### Family B — Products, Records, and Tuples

---

#### $\pi'_8$ — Positional Tuple (refines $\pi_4$)

$$S = (\tau_1, \tau_2, \ldots, \tau_n) \quad\text{(ordered, index-addressed)}$$

---

#### $\pi'_9$ — Labelled Record (refines $\pi_4$)

$$S = \prod\{l_1 : \tau_1,\; \ldots,\; l_n : \tau_n\}$$

Order of declaration is not semantically significant.

---

#### $\pi'_{10}$ — Variadic / Rest Element (new)

$$S = (\tau_1, \ldots, \tau_n, \ldots\tau_r^{*})$$

A tuple with a fixed prefix and a variable-length homogeneous tail.
TypeScript: `[string, number, ...boolean[]]`.

---

### Family C — Field Modality

---

#### $\pi'_{11}$ — Required Field (refines $\pi_4$)

$$\forall v \in \llbracket S \rrbracket,\; l_i \in \mathrm{dom}(v)$$

---

#### $\pi'_{12}$ — Optional-by-Absence (refines $\pi_{11}$)

$$\exists\, v, v' \in \llbracket S \rrbracket :\;
  l_i \in \mathrm{dom}(v) \;\land\; l_i \notin \mathrm{dom}(v')$$

---

#### $\pi'_{13}$ — Nullable-by-Value (new)

$$\forall v \in \llbracket S \rrbracket,\; l_i \in \mathrm{dom}(v)
  \quad\text{and}\quad \mathtt{null} \in \llbracket \tau_i \rrbracket$$

Key always present; "missing data" carried in-band as a value.

---

#### $\pi'_{14}$ — Default Value **[meta-coerce]** (new)

$S$ associates field $l_i$ with a default value $d_i \in \llbracket \tau_i \rrbracket$. Requires extending the semantic foundation to $\tau : \mathcal{V} \to \mathcal{V} \cup \{\bot\}$ (validation with coercion).

---

#### $\pi'_{15}$ — Read-Only / Immutability Marker **[meta-annot]** (new)

$S$ annotates field $l_i$ as read-only: $\mathrm{mut}(l_i) = \bot$. No
effect on extension; constrains usage contexts. Requires a semantic domain
modelling mutability permissions.

---

### Family D — Shape Closure

---

#### $\pi'_{16}$ — Closed Record (refines $\pi_{13}$ complement)

$$\forall v \in \llbracket S \rrbracket :\;
  \mathrm{dom}(v) = \{l_1, \ldots, l_n\}$$

---

#### $\pi'_{17}$ — Open Record, Unconstrained Extras (refines $\pi_{13}$)

$$\{l_1, \ldots, l_n\} \subseteq \mathrm{dom}(v);\quad
  \text{extra keys unconstrained}$$

---

#### $\pi'_{18}$ — Open Record, Typed Extras (new)

$$\forall l \notin \{l_1, \ldots, l_n\} :\;
  l \in \mathrm{dom}(v) \implies v(l) \in \llbracket \tau_{\mathrm{rest}} \rrbracket$$

JSON Schema: `additionalProperties: { "type": "string" }`.

---

### Family E — Sum and Union Structure

---

#### $\pi'_{19}$ — Untagged Union (refines $\pi_5$)

$$S = \tau_1 \sqcup \tau_2 \quad\text{with no distinguished discriminant field}$$

---

#### $\pi'_{20}$ — Discriminated Union, Literal Tag (refines $\pi_5$)

$$S = \bigsqcup_{i=1}^{k}\bigl(\{d_i\} \times \tau_i\bigr)$$

The IR carries both the tag field name and the mapping $d_i \mapsto \tau_i$.

---

#### $\pi'_{21}$ — Shape-Discriminated Union (new)

$$S = \tau_1 \sqcup \tau_2
  \quad\text{where shapes are disjoint on key sets, no shared literal tag}$$

---

#### $\pi'_{22}$ — Exhaustive / Closed Union **[meta-annot]** (new)

$$S = \tau_1 \sqcup \cdots \sqcup \tau_k
  \quad\text{with a meta-assertion that the case set is complete}$$

Enables exhaustiveness checking. "Closedness" constrains schema evolution,
not the current extension.

---

### Family F — Intersection

---

#### $\pi'_{23}$ — Record-Merge Intersection (refines $\pi_6$)

$$S = \tau_A \sqcap \tau_B
  \quad\text{where both operands contribute structural fields}$$

---

#### $\pi'_{24}$ — Refinement Intersection (new)

$$S = \tau \sqcap \{v : \tau \mid P(v)\}
  \quad\text{where } \tau \text{ is structural and }
  P : \llbracket \tau \rrbracket \to \{\top,\bot\} \text{ is a decidable predicate}$$

The second operand is a refinement type term (per $\pi_{10}$, Def. 3.2
clause 2 with a refinement constructor); it contributes no new fields —
only a narrowing constraint on the values already in $\llbracket\tau\rrbracket$.
Distinguished from $\pi'_{23}$ (record-merge intersection) where both
operands contribute structural fields.

---

### Family G — Recursion

---

#### $\pi'_{25}$ — Direct Self-Recursion (= $\pi_7$)

$$S = \mu\alpha.\,F(\alpha)$$

---

#### $\pi'_{26}$ — Mutual Recursion (= $\pi_8$)

$$S_A = \mu(\alpha, \beta).\,F(\alpha, \beta),\quad
  S_B = \mu(\alpha, \beta).\,G(\alpha, \beta)$$

---

#### $\pi'_{27}$ — Recursive Generic (new)

$$S = \Lambda\alpha.\,\mu\beta.\,F(\alpha, \beta)$$

Example: `type Tree<T> = { value: T; children: Tree<T>[] }`. The IR must
handle fixpoint binding *inside* a type-level lambda.

---

### Family H — Parametricity and Higher Kinds

---

#### $\pi'_{28}$ — Rank-1 Generics (refines $\pi_9$)

$$S = \Lambda\alpha.\,F(\alpha)
  \quad\text{with } \alpha \text{ universally quantified at outermost position}$$

---

#### $\pi'_{29}$ — Bounded Generics (new)

$$S = \Lambda(\alpha \leq \tau_B).\,F(\alpha)$$

TypeScript: `<T extends Serializable>`. The IR must encode and check the
bound.

---

#### $\pi'_{30}$ — Generic Default **[meta-annot]** (new)

$$S = \Lambda(\alpha = \tau_D).\,F(\alpha)$$

TypeScript: `<T = string>`. The default affects instantiation ergonomics,
not the extension of any particular instantiation.

---

#### $\pi'_{31}$ — Higher-Rank Polymorphism (new)

$$S \text{ contains a quantifier nested under a constructor: }
  f(\ldots, \forall\alpha.\,\tau, \ldots)$$

Requires quantifiers at arbitrary depth. Strictly stronger than $\pi'_{28}$.

---

#### $\pi'_{32}$ — Higher-Kinded Type Parameter (= $\pi_{15}$)

$$S = \Lambda(F : \kappa_1 \to \kappa_2).\,G(F)$$

Abstraction over type constructors. The IR must represent kinds.

---

#### $\pi'_{33}$ — Variance Annotation **[meta-op]** (new)

$$S = \Lambda(\alpha^{+}).\,F(\alpha)
  \quad\text{or}\quad
  S = \Lambda(\alpha^{-}).\,F(\alpha)$$

Variance affects the subtyping relation on instantiated types, not the
extension of any single instantiation.

---

### Family I — Nominal Identity and Branding

---

#### $\pi'_{34}$ — Structural Identity Only (refines $\pi_{12}$ complement)

$$S_1 \equiv S_2 \;\iff\; \llbracket S_1 \rrbracket = \llbracket S_2 \rrbracket$$

Baseline: no mechanism to distinguish structurally identical types.

---

#### $\pi'_{35}$ — Nominal Tag / Brand (refines $\pi_{12}$)

$$\llbracket S_1 \rrbracket = \llbracket S_2 \rrbracket
  \;\text{but}\; \mathrm{name}(S_1) \neq \mathrm{name}(S_2)
  \;\implies\; S_1 \not\leq S_2$$

---

#### $\pi'_{36}$ — Opaque / Newtype Wrapper (new)

$$S = \mathrm{opaque}(\mathtt{Tag},\, \tau_{\mathrm{under}});\quad
  \llbracket S \rrbracket = \llbracket \tau_{\mathrm{under}} \rrbracket
  \;\text{but}\; S \not\leq \tau_{\mathrm{under}} \;\land\;
  \tau_{\mathrm{under}} \not\leq S$$

Nominal wrapper with no implicit conversion in either direction.

---

#### $\pi'_{37}$ — Explicit Coercion Edge **[meta-op]** (new)

$$S_1 \not\leq S_2
  \;\text{but the IR declares a coercion } c : S_1 \to S_2$$

The IR must represent coercions as first-class edges in the type graph.

---

### Family J — Refinement and Predicate Structure

---

#### $\pi'_{38}$ — Range / Bound Constraint (refines $\pi_{10}$)

$$S = \{v : \tau \mid a \leq v \leq b\}$$

---

#### $\pi'_{39}$ — Pattern / Regex Constraint (new)

$$S = \{v : \mathtt{string} \mid v \in L(r)\}$$

Membership in a regular language. Operates on string structure, not numeric
ordering.

---

#### $\pi'_{40}$ — Modular / Divisibility Constraint (new)

$$S = \{v : \mathbb{Z} \mid v \bmod m = 0\}$$

---

#### $\pi'_{41}$ — Compound Decidable Predicate (refines $\pi_{10}$)

$$S = \{v : \tau \mid P_1(v) \land P_2(v)\}
  \quad\text{or}\quad
  \{v : \tau \mid P_1(v) \lor P_2(v)\}$$

Boolean combinations of atomic refinements.

---

#### $\pi'_{68}$ — String Concatenation Closure (new)

$$S = S_1 \cdot S_2
  \quad\text{where}\quad
  \llbracket S \rrbracket = \{s_1 s_2 \mid s_1 \in \llbracket S_1 \rrbracket, s_2 \in \llbracket S_2 \rrbracket\}$$

A type constructor that produces the concatenation of two string types.
TypeScript template literal types: `` `${string}@${string}` ``.
Distinguished from regex ($\pi'_{39}$) because this is a *type-level
constructor* that composes structurally, not merely a membership filter.

---

#### $\pi'_{69}$ — String Pattern Decomposition **[meta-op]** (new)

Given $v \in \llbracket S_1 \cdot S_2 \rrbracket$, the IR can infer the
types of the sub-parts. This is an inference-engine property: the IR
supports *type-level string deconstruction* (TypeScript's `infer` in
template literal positions). Tagged **[meta]** because the decomposition
capability is a property of the IR's inference algorithm, not of any
single type's extension.

---

### Family K — Value Dependency

---

#### $\pi'_{42}$ — Finite Tagged Dependent Choice (= $\pi_{14}$)

$$\tau_j = f(v_i)
  \quad\text{where } f \text{ ranges over a finite set of cases}$$

---

#### $\pi'_{43}$ — Intra-Object Cross-Field Constraint (new)

$$S = \prod\{l_1 : \tau_1, l_2 : \tau_2\}
  \quad\text{subject to } P(v.l_1, v.l_2)$$

Example: `start ≤ end`. Neither field's type changes; their joint value
space is restricted.

---

#### $\pi'_{44}$ — Inter-Object Referential Constraint **[meta-multi]** (new)

A foreign-key constraint: $S_1$ contains a field whose value must appear
in an instance of $S_2$. Requires a multi-instance semantic domain.

---

#### $\pi'_{67}$ — Path-Navigating Constraint (new)

$$P(\mathrm{path}_1(v),\, \mathrm{path}_2(v))
  \quad\text{where } \mathrm{path}_i \text{ is a compound accessor expression}$$

Constraints that navigate through nested structure. SHACL property paths,
JSONPath-based validation, JSON Schema `$data` references. Orthogonal to
$\pi'_{43}$ because the constraint traverses structural depth, requiring the
IR to represent *path expressions* into nested records.

**Separation witness:** SHACL `sh:path ( sh:inversePath ex:parent )` —
an inverse-path traversal that no flat sibling-field predicate can express.

---

### Family L — Collection Types

---

#### $\pi'_{45}$ — Homogeneous Array / List (new)

$$S = \tau^{*}$$

Variable-length, element-type homogeneous.

---

#### $\pi'_{46}$ — Set / Unique Collection (new)

$$S = \mathcal{P}_{\mathrm{fin}}(\tau)
  \quad\text{with } \forall i \neq j,\; v_i \neq v_j$$

The IR must encode and validate uniqueness.

---

#### $\pi'_{47}$ — Map / Dictionary (new)

$$S = \tau_K \to_{\mathrm{fin}} \tau_V$$

Finite partial function from keys to values. Key set not statically known.

---

### Family M — Computation Types

---

#### $\pi'_{48}$ — Function / Arrow Type (new)

$$S = \tau_1 \to \tau_2$$

---

#### $\pi'_{49}$ — Overloaded Function / Intersection of Arrows (new)

$$S = (\tau_{1a} \to \tau_{1b}) \;\sqcap\; (\tau_{2a} \to \tau_{2b})$$

Multiple call signatures with call-site resolution semantics.

---

### Family N — Modularity and Scoping **[meta-annot]**

---

#### $\pi'_{50}$ — Named Type Alias / Definition **[meta-annot]** (new)

$$S = \mathrm{let}\; n = \tau \;\mathrm{in}\; \ldots$$

Extensionally equivalent to inlining; the name exists for tooling and
human comprehension.

---

#### $\pi'_{51}$ — Module / Namespace Scoping **[meta-annot]** (new)

$$\mathrm{module}\; M = \{n_1 : \tau_1,\; \ldots,\; n_k : \tau_k\}$$

Hierarchical grouping with independent name scopes.

---

#### $\pi'_{52}$ — Visibility / Export Control **[meta-annot]** (new)

Public vs. private definitions within a module.

---

### Family O — Evolution and Compatibility **[meta-annot]**

---

#### $\pi'_{53}$ — Deprecation Annotation **[meta-annot]** (new)

Mark a type or field as deprecated with optional metadata.

---

#### $\pi'_{54}$ — Versioned Schema Identity **[meta-annot]** (new)

Associate a version identifier with a schema definition.

---

#### $\pi'_{55}$ — Backward Compatibility Relation **[meta-annot]** (new)

Assert $\llbracket S_{v1} \rrbracket \subseteq \llbracket S_{v2} \rrbracket$
across versions.

---

### Family P — Meta-Annotation **[meta-annot]**

---

#### $\pi'_{56}$ — Description / Documentation **[meta-annot]** (new)

Attach human-readable description to any node.

---

#### $\pi'_{57}$ — Example Values **[meta-annot]** (new)

Attach example values with informal expectation $e_i \in \llbracket S \rrbracket$.

---

#### $\pi'_{58}$ — Custom Extension Metadata **[meta-annot]** (new)

Arbitrary key-value metadata on any node. JSON Schema `x-` keywords.

---

### Family Q — Type-Level Negation and Complement

---

#### $\pi'_{59}$ — Type-Level Complement (new)

$$S = \neg\tau \qquad \llbracket \neg\tau \rrbracket = \mathcal{V} \setminus \llbracket \tau \rrbracket$$

The operand is a *type term*, not a value predicate over a fixed base sort.
JSON Schema `not`, TypeScript `Exclude<T, U>`. Distinguished from predicate
negation inside a refinement ($\pi'_{41}$): an IR can support
$\{v : \mathtt{number} \mid \neg(v > 5)\}$ without being able to express
$\neg\mathrm{object}(\{\mathtt{id}: \mathbb{N}\})$.

> **Warning (§7, Remark 7.1.2).** Combining $\pi'_{59}$ with $\pi'_{25}$
> ($\mu$) and $\pi'_{28}$ ($\Lambda$) creates a decidability hazard. An IR
> satisfying all three must establish termination of its type equivalence
> decision procedure.

---

### Family R — Unsound / Bivariant Types

---

#### $\pi'_{60}$ — Unsound Bivariant Type **[meta-op]** (new)

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

#### $\pi'_{61}$ — Phantom Type Parameter **[meta-op]** (new)

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
extensions coincide. The required enrichment is exactly that of $\pi'_{60}$.

Distinguished from $\pi'_{28}$–$\pi'_{33}$ (where the parameter *occurs*
in the body) and from $\pi'_{50}$ (named alias, where distinct names do not
affect subtyping under most IRs). The enforcement condition
($S(\tau_1) \not\leq_{\mathrm{op}} S(\tau_2)$) is essential: without it,
a purely structural IR erases phantoms and the criterion collapses.

---

#### $\pi'_{62}$ — GADT / Indexed Type (new)

$$S = \Lambda\alpha.\,\bigsqcup_{i \in I}\bigl(\{\alpha \equiv c_i\} \Rightarrow \tau_i\bigr)$$

where $I$ is a finite index set, $c_i$ are distinct type-level constants
(constructor identifiers), $\{\alpha \equiv c_i\}$ is a type-level
equality constraint on the index parameter $\alpha$, and each $\tau_i$
is a (possibly distinct) product type. The index $\alpha$ determines the
*structural shape* of the type — which fields and constructors are
available — not merely an element type or a single field's value.

The index determines the *shape* of the type (which constructors are
available), not just the element type or a single field's type. Strictly
stronger than $\pi'_{29}$ (bounded generics) + $\pi'_{42}$ (finite
dependent choice): the dependency is from a *type-level* index to the
structural shape of the product, not from a value-level tag to a
branch-local type. A concrete IR encoding this criterion must be able to
represent the constraint $\{\alpha \equiv c_i\}$ and narrow the
available constructors at each branch accordingly.

---

### Family T — Type-Level Computation

---

#### $\pi'_{63}$ — Structural Key Enumeration (new)

$$\mathrm{keyof}\,\tau \;:\; \text{the type of all label names in record type } \tau$$

A type-level operator taking a type as input and producing the union of its
key literals. TypeScript: `keyof T`. Cannot be expressed as a fixed type
term; it is a *type-level function*.

---

#### $\pi'_{64}$ — Mapped Type (new)

$$\{[K \in \mathrm{keyof}\,\tau]: F(K, \tau[K])\}$$

Transforms each field of a source type through a type-level function.
Strictly above HKT ($\pi'_{32}$) because it requires structural
*introspection* of the source type, not just abstraction over a
constructor.

**Independence from $\pi'_{63}$:** Mapped types can iterate over an
explicit key set without `keyof`. An IR satisfying $\pi'_{64}$ need not
support $\pi'_{63}$ if it provides the key set by other means.

---

#### $\pi'_{65}$ — Conditional Type (new)

$$S = \tau_1 \;\mathtt{extends}\; \tau_2\; ?\; \tau_A : \tau_B$$

A type-level case expression requiring the IR to embed a subtyping test
inside a type constructor. Fundamentally different from value-level
dependent choices ($\pi'_{42}$) because the branch condition is a
*type-level* judgment, not a runtime value.

**Independence from $\pi'_{63}$ and $\pi'_{64}$:** Conditional types
operate on arbitrary types, not only on record field sets. No logical
dependency on `keyof` or mapped types.

---

### Family U — Row Polymorphism

---

#### $\pi'_{66}$ — Row-Polymorphic Record (new)

$$S = \Lambda\rho.\,\prod\{l_1 : \tau_1,\; \ldots,\; l_n : \tau_n \mid \rho\}$$

A record type parameterised by a *row variable* $\rho$ abstracting over the
"rest" of the fields. OCaml polymorphic variants and Rémy-style row types
are the canonical examples.

Distinguished from open records ($\pi'_{17}$), which allow any extra fields
but don't abstract over them parametrically, and from rank-1 generics
($\pi'_{28}$), which abstract over element types but not over field sets. An
IR supporting both $\pi'_{17}$ and $\pi'_{28}$ but lacking row variables
cannot express "a function that works on any record with at least field
`id: number`, preserving all other fields."

---

### Family V — Temporal / Stateful Types

---

#### $\pi'_{70}$ — State-Machine Type **[meta-op]** (new)

A type whose valid inhabitant at time $t+1$ depends on the inhabitant at
time $t$ — a *transition relation* encoded in the type. Relevant for UML
statecharts, lifecycle APIs, and workflow schemas.

Tagged **[meta]** because it requires enriching the semantic domain beyond
single-value predicates to a domain with *transition functions* or
*state-indexed type families*.

---

### 12.1. Summary Table

| Id | Name | Family | Refines | [meta] tag |
|---|---|---|---|:---:|
| $\pi'_1$ | Syntactic bottom | A | $\pi_1$ | |
| $\pi'_2$ | Semantic emptiness | A | $\pi_1$ | |
| $\pi'_3$ | Global top | A | $\pi_2$ | |
| $\pi'_4$ | Sort-restricted top | A | new | |
| $\pi'_5$ | Singleton literal | A | $\pi_3$ | |
| $\pi'_6$ | Finite homogeneous enum | A | new | |
| $\pi'_7$ | Finite heterogeneous enum | A | new | |
| $\pi'_8$ | Positional tuple | B | $\pi_4$ | |
| $\pi'_9$ | Labelled record | B | $\pi_4$ | |
| $\pi'_{10}$ | Variadic / rest element | B | new | |
| $\pi'_{11}$ | Required field | C | $\pi_4$ | |
| $\pi'_{12}$ | Optional-by-absence | C | $\pi_{11}$ | |
| $\pi'_{13}$ | Nullable-by-value | C | new | |
| $\pi'_{14}$ | Default value | C | new | coerce |
| $\pi'_{15}$ | Read-only marker | C | new | annot |
| $\pi'_{16}$ | Closed record | D | $\pi_{13}$⁻¹ | |
| $\pi'_{17}$ | Open, unconstrained extras | D | $\pi_{13}$ | |
| $\pi'_{18}$ | Open, typed extras | D | new | |
| $\pi'_{19}$ | Untagged union | E | $\pi_5$ | |
| $\pi'_{20}$ | Discriminated union | E | $\pi_5$ | |
| $\pi'_{21}$ | Shape-discriminated union | E | new | |
| $\pi'_{22}$ | Exhaustive / closed union | E | new | annot |
| $\pi'_{23}$ | Record-merge intersection | F | $\pi_6$ | |
| $\pi'_{24}$ | Refinement intersection | F | new | |
| $\pi'_{25}$ | Direct self-recursion | G | $\pi_7$ | |
| $\pi'_{26}$ | Mutual recursion | G | $\pi_8$ | |
| $\pi'_{27}$ | Recursive generic | G | new | |
| $\pi'_{28}$ | Rank-1 generics | H | $\pi_9$ | |
| $\pi'_{29}$ | Bounded generics | H | new | |
| $\pi'_{30}$ | Generic default | H | new | annot |
| $\pi'_{31}$ | Higher-rank polymorphism | H | new | |
| $\pi'_{32}$ | Higher-kinded type parameter | H | $\pi_{15}$ | |
| $\pi'_{33}$ | Variance annotation | H | new | op |
| $\pi'_{34}$ | Structural identity only | I | $\pi_{12}$⁻¹ | |
| $\pi'_{35}$ | Nominal tag / brand | I | $\pi_{12}$ | |
| $\pi'_{36}$ | Opaque / newtype wrapper | I | new | |
| $\pi'_{37}$ | Explicit coercion edge | I | new | op |
| $\pi'_{38}$ | Range / bound constraint | J | $\pi_{10}$ | |
| $\pi'_{39}$ | Pattern / regex constraint | J | new | |
| $\pi'_{40}$ | Modular / divisibility constraint | J | new | |
| $\pi'_{41}$ | Compound decidable predicate | J | $\pi_{10}$ | |
| $\pi'_{42}$ | Finite tagged dependent choice | K | $\pi_{14}$ | |
| $\pi'_{43}$ | Cross-field constraint | K | new | |
| $\pi'_{44}$ | Inter-object referential constraint | K | new | multi |
| $\pi'_{45}$ | Homogeneous array / list | L | new | |
| $\pi'_{46}$ | Set / unique collection | L | new | |
| $\pi'_{47}$ | Map / dictionary | L | new | |
| $\pi'_{48}$ | Function / arrow type | M | new | |
| $\pi'_{49}$ | Overloaded function | M | new | |
| $\pi'_{50}$ | Named type alias | N | new | annot |
| $\pi'_{51}$ | Module / namespace | N | new | annot |
| $\pi'_{52}$ | Visibility / export control | N | new | annot |
| $\pi'_{53}$ | Deprecation annotation | O | new | annot |
| $\pi'_{54}$ | Versioned schema identity | O | new | annot |
| $\pi'_{55}$ | Backward compatibility | O | new | annot |
| $\pi'_{56}$ | Description / documentation | P | new | annot |
| $\pi'_{57}$ | Example values | P | new | annot |
| $\pi'_{58}$ | Custom extension metadata | P | new | annot |
| $\pi'_{59}$ | Type-level complement | Q | new | |
| $\pi'_{60}$ | Unsound bivariant type | R | new | op |
| $\pi'_{61}$ | Phantom type parameter | S | new | op |
| $\pi'_{62}$ | GADT / indexed type | S | new | |
| $\pi'_{63}$ | Structural key enumeration | T | new | |
| $\pi'_{64}$ | Mapped type | T | new | |
| $\pi'_{65}$ | Conditional type | T | new | |
| $\pi'_{66}$ | Row-polymorphic record | U | new | |
| $\pi'_{67}$ | Path-navigating constraint | K | new | |
| $\pi'_{68}$ | String concatenation closure | J | new | |
| $\pi'_{69}$ | String pattern decomposition | J | new | op |
| $\pi'_{70}$ | State-machine type | V | new | op |

**Totals:** 70 criteria across 22 families. 50 extensional, 20 meta-structural.

---

### 12.2. Orthogonality Notes

$\Pi'$ satisfies a *family-structured independence* property rather than
strict pairwise orthogonality across all 70 criteria.

**Inter-family independence.** Criteria from distinct families are
orthogonal: they target different syntactic and semantic dimensions.

**Intra-family independence.** Within each family, criteria are *pairwise
separable*: for each pair, there exists an IR or schema language satisfying
one but not the other. Separation witnesses are provided in the criterion
definitions.

**Acknowledged subsumption edges:**

- $\pi'_{31}$ (higher-rank) strictly subsumes $\pi'_{28}$ (rank-1).
- $\pi'_{32}$ (higher-kinded) strictly subsumes $\pi'_{28}$ (rank-1).
- $\pi'_{41}$ (compound predicate) subsumes $\pi'_{38}$–$\pi'_{40}$
  individually.
- $\pi'_{36}$ (opaque wrapper) implies $\pi'_{35}$ (nominal tag) but
  not vice versa.

These are retained because the subsumed criteria represent lower IR design
costs. An IR scoring ✓ on $\pi'_{38}$ but ✗ on $\pi'_{41}$ conveys
useful information.

To recover strict orthogonality, quotient $\Pi'$ by subsumption edges,
yielding approximately 62–64 independent criteria.

---

### 12.3. Deferred Phenomena (v2 Candidates)

The following phenomena were identified during review but deferred:

| Phenomenon | Reason for Deferral |
|---|---|
| Gradual typing with consistency relation ($\pi'_{S1}$–$\pi'_{S3}$) | Requires substantially enriched semantic domain; not present in target languages (TS `any` is modelled by $\pi'_{60}$ instead) |
| Linear / affine types ($\pi'_{V1}$–$\pi'_{V3}$) | Requires usage-multiplicity judgments; relevant for Rust/Haskell, not current targets |
| Session types ($\pi'_{W1}$–$\pi'_{W3}$) | Requires protocol duality semantics; relevant for streaming/messaging, deferred to protocol-layer extensions |
| Invariant preservation under update ($\pi'_{X2}$) | Hoare-logic–style assertion on execution traces; out of scope for type-theoretic criterion set |
| Cardinality-typed collection dependency ($\pi'_{K4}$) | Independence from existing criteria not established; needs separation witness |

---

### 12.4. Rejected Proposals

| Proposal | Rejection Rationale |
|---|---|
| $\pi'_{Q2}$ — Difference type | Derivable as $\tau_A \sqcap \neg\tau_B$ from $\pi'_{59} + \pi'_{23}$; not independent |
| $\pi'_{F3}$ — Method intersection with `this` | Already covered by $\mu$ ($\pi'_{25}$/$\pi'_{26}$) + function type ($\pi'_{48}$) + record-merge intersection ($\pi'_{23}$); conflates syntactic pattern with semantic phenomenon |
| $\pi'_{X2}$ — Invariant under update | Predicate on execution traces, not on types or values; requires Hoare-logic framework, not type-theoretic criteria |
| DNF/CNF normalizability | Property of the IR's algorithms (decidability/complexity), not of its type language expressiveness; belongs in a complexity-profile companion document |

### 12.5. Future Work: Diverse Schema Set $\mathbb{C}'$ and Expanded Scorecard

The base criterion set $\Pi$ has a corresponding $\Pi$-diverse schema set
$\mathbb{C} = \{S_1,\ldots,S_{15}\}$ (§9) and a machine-applicable scorecard
(§11). The expanded criterion set $\Pi'$ has neither.

**Missing $\mathbb{C}'$.** An expanded diverse schema set
$\mathbb{C}' = \{S'_1,\ldots,S'_{70}\}$ analogous to $\mathbb{C}$ — one
schema per criterion, each the primary witness for at least one
$\pi'_i$ that no other element of $\mathbb{C}'$ covers — has not yet been
constructed. Without $\mathbb{C}'$, the criteria in $\Pi'$ cannot be
directly used for scorecard evaluation; they serve as a taxonomy of
phenomena and a reference for IR design, but not as a plug-in test suite.

**Missing expanded scorecard.** §11 scores three IRs against $\Pi$ (15
criteria). An analogous 70-criterion scorecard for $\Pi'$ has not been
produced. Constructing $\mathbb{C}'$ is a prerequisite for doing so.

Both are deferred to a future revision. Candidates contributing
$\mathbb{C}'$ witnesses should verify: (1) $\pi'_i(S'_i) = \top$ for the
claimed primary witness, (2) $S'_i$ is distinct from $S'_j$ in the sense
of Def. 8.4 (no other element covers all its criteria), and (3) [meta-op]
witnesses explicitly state the operational enrichment being tested.

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
*open* records (satisfying $\pi'_{17}$) — where
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

### Remark 13.3 — Relationship to $\Pi'$

The encoding-check layer is architecturally parallel to the unary criterion
set $\Pi'$. Both evaluate the IR, but at different levels: $\Pi'$ asks
"can the IR *represent* this type term?"; the encoding-check layer asks
"does the IR's encoding *preserve* this subtyping relationship?"

An IR may score ✓ on all relevant $\Pi'$ criteria yet fail encoding-check
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
| $\Pi$ | Criterion set (base) | 15 orthogonal, atomic criteria (§8, Table 8.5) |
| $\Pi'$ | Criterion set (expanded) | 70 criteria across 22 families (§12) |
| $\mathbb{C}$ | Diverse schema set | $\Pi$-diverse test set $\{S_1, \ldots, S_{15}\}$ (§9) |
| $\sim_\Pi$ | $\Pi$-equivalence | Agreement on all criteria in $\Pi$ (Def. 8.2) |
| $\rho$ | Encoding-check property | Binary predicate on witness pairs under $\phi$ (Def. 13.1) |
| $\bot$ | Bottom type | $\llbracket\bot\rrbracket = \emptyset$ ($\pi_1$) |
| $\top$ | Top type | $\llbracket\top\rrbracket = \mathcal{V}$ ($\pi_2$) |
| $\neg$ | Complement | $\llbracket\neg\tau\rrbracket = \mathcal{V} \setminus \llbracket\tau\rrbracket$ ($\pi'_{59}$) |
| $\prod$ | Product | Labelled finite product ($\pi_4$) |
| $\sqcup$ | Union / Sum | Set-theoretic union or disjoint sum ($\pi_5$) |
| $\sqcap$ | Intersection | Set-theoretic intersection ($\pi_6$) |
| $\mu$ | Fixpoint | Recursive type binder ($\pi_7$) |
| $\Lambda$ | Type abstraction | Universal type-level abstraction ($\pi_9$, $\pi_{15}$) |

### Terms

**Atomicity (of a criterion).** The property that $\pi_i$ is not
decomposable into a conjunction of independent sub-criteria (Def. 8.2).

**Backward compatibility.** $\llbracket S_{v1} \rrbracket \subseteq
\llbracket S_{v2} \rrbracket$: every value valid under the old schema
remains valid under the new one ($\pi'_{55}$).

**Bounded generics.** A parametric type with an upper-bound constraint on
its type parameter: $\Lambda(\alpha \leq \tau_B).\,F(\alpha)$ ($\pi'_{29}$).
TypeScript: `<T extends Serializable>`.

**Computability (of an encoding).** The requirement that $\phi$ be
implementable by a terminating algorithm (Def. 6.3).

**Conditional type.** A type-level case expression:
$\tau_1 \;\mathtt{extends}\; \tau_2 \;?\; \tau_A : \tau_B$ ($\pi'_{65}$).

**Coverage criterion.** A decidable predicate identifying a structurally
or semantically distinct phenomenon (Def. 8.1).

**Dependent constraint.** A schema in which the type of one field is
determined by the *value* of another field ($\pi_{14}$, $\pi'_{42}$).

**Direct recursion.** $S = \mu\alpha.\,F(\alpha)$ ($\pi_7$, $\pi'_{25}$).

**Encoding.** A total function $\phi : \mathcal{T}(\Sigma) \to \mathcal{N}_R$
(Def. 5.1).

**Encoding-check property.** A decidable predicate on the encoding function
evaluated against a pair of witness schemas (Def. 13.1).

**Extension.** $\llbracket\tau\rrbracket = \{v \mid \tau(v) = \top\}$
(Def. 2.2).

**GADT / Indexed type.** A type where a type-level index refines the
available constructors or fields ($\pi'_{62}$).

**Higher-kinded type.** Abstraction over type constructors
($\pi_{15}$, $\pi'_{32}$).

**Intermediate Representation (IR).** Schema language $\mathcal{R}$ +
IR nodes $\mathcal{N}_R$ (Def. 4.1).

**Mapped type.** $\{[K \in \mathrm{keyof}\,\tau]: F(K, \tau[K])\}$ —
structural transformation of a source type ($\pi'_{64}$).

**Mutual recursion.** A cycle involving two or more distinct named types
($\pi_8$, $\pi'_{26}$).

**Nominal identity.** Structurally identical types distinguished by name
($\pi_{12}$, $\pi'_{35}$).

**Observational basis.** A finite set of criteria inducing $\sim_\Pi$
(Def. 8.2).

**Open shape.** A record admitting additional properties
($\pi_{13}$, $\pi'_{17}$).

**Operational subtyping.** An IR's assignability judgment, which may
diverge from semantic subtyping (Def. 2.4).

**Optionality.** Key-absence semantics ($\pi_{11}$, $\pi'_{12}$).

**Orthogonality (of criteria).** Neither implies the other; independent
schema languages witness each (Def. 8.2).

**Parametricity.** Type-level abstraction: $\Lambda\alpha.\,F(\alpha)$
($\pi_9$, $\pi'_{28}$).

**Path-navigating constraint.** A constraint traversing nested structure
via compound accessor expressions ($\pi'_{67}$).

**Phantom type parameter.** A type parameter not occurring in the
structural body, yet semantically relevant under nominal interpretation
($\pi'_{61}$).

**$\Pi$-Complete.** Every criterion witnessed by at least one schema
(Def. 8.3).

**$\Pi$-Diverse.** $\Pi$-complete and orthogonally minimal (Def. 8.4).

**Refinement type.** $\{v : \tau \mid P(v)\}$ ($\pi_{10}$, $\pi'_{38}$ff).

**Row polymorphism.** Record types parameterised by a row variable
abstracting over unspecified fields ($\pi'_{66}$).

**Row variable.** A type-level variable $\rho$ ranging over sets of
record fields, used in row-polymorphic record types
$\prod\{l_1:\tau_1,\ldots,l_n:\tau_n \mid \rho\}$ ($\pi'_{66}$).
Distinct from ordinary type variables ($\alpha$) which range over
element types, not field sets.

**Schema.** A finite, well-formed type term $S \in \mathcal{T}(\Sigma)$
(Def. 3.5).

**Shape-discriminated union.** A union $\tau_1 \sqcup \tau_2$ where the
branches are distinguished by their structural key sets rather than a
shared literal-tagged field ($\pi'_{21}$).

**Schema class.** A collection of schema languages (Def. 6.1).

**Schema language.** $(\Sigma, \mathcal{T}(\Sigma), \llbracket\cdot\rrbracket_\Sigma)$ (Def. 3.4).

**Semantic completeness.** $\llbracket\tau\rrbracket_\Sigma \subseteq
\llbracket\phi(\tau)\rrbracket_R$ (Def. 5.3).

**Semantic faithfulness.** $\llbracket\phi(\tau)\rrbracket_R =
\llbracket\tau\rrbracket_\Sigma$ (Def. 5.4).

**Semantic soundness.** $\llbracket\phi(\tau)\rrbracket_R \subseteq
\llbracket\tau\rrbracket_\Sigma$ (Def. 5.2).

**Signature.** $(B, \mathcal{F}, \mathrm{ar})$ (Def. 3.1).

**Sort-restricted top.** A top type restricted to a single base sort:
$\llbracket S \rrbracket = \mathcal{V}_b$ for some $b \in B$ ($\pi'_4$).
For example, "any string" or "any number" rather than the global
$\mathcal{V}$.

**State-machine type.** A type whose valid inhabitant depends on the prior
state via a transition relation ($\pi'_{70}$).

**String concatenation closure.** A type constructor producing
$\{s_1 s_2 \mid s_1 \in \llbracket S_1 \rrbracket, s_2 \in \llbracket S_2 \rrbracket\}$ ($\pi'_{68}$).

**Template literal type.** A string type constructed by concatenating
fixed string segments with typed slots, producing a regular or
context-free language of string values. Related to $\pi'_{68}$ (string
concatenation closure) and $\pi'_{69}$ (string pattern decomposition).
TypeScript: `` `${'GET' | 'POST'} /${string}` ``.

**Strong universality.** Faithful and *computable* encoding for each
language in $\mathbb{S}$ (Def. 6.3).

**Structure preservation.** Monotonicity of $\phi$ under $\leq$ (Def. 5.5).

**Typed extras.** Additional fields in an open record constrained to a
specific type: $\forall l \notin \{l_1,\ldots,l_n\} : v(l) \in
\llbracket\tau_{\mathrm{rest}}\rrbracket$ ($\pi'_{18}$). JSON Schema:
`additionalProperties: { "type": "string" }`.

**Type term.** Element of $\mathcal{T}(\Sigma)$ (Def. 3.2).

**Unit / Singleton type.** $|\llbracket S \rrbracket| = 1$
($\pi_3$, $\pi'_5$).

**Variadic / rest element.** A tuple type with a fixed-length prefix and
a variable-length homogeneous tail: $(\tau_1,\ldots,\tau_n,\ldots\tau_r^*)$
($\pi'_{10}$). TypeScript: `[string, number, ...boolean[]]`.

**Unsound bivariant type.** A type satisfying $S \leq_{\mathrm{op}} \tau$
and $\tau \leq_{\mathrm{op}} S$ for all $\tau$ under operational subtyping,
breaking antisymmetry ($\pi'_{60}$).

**Value universe.** The countably infinite set $\mathcal{V}$ (Def. 2.1).

**Weak universality.** Every schema has a matching IR node, without
computability requirement (Def. 6.2).
