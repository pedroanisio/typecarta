// family-a
// Define Family A witnesses (π'₁..π'₇) covering cardinality and base-set distinctions.
import { base, bottom, literal, rangeConstraint, refinement, top, union } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₁ — Syntactic Bottom: explicit ⊥ node. */
export const SP01_SYNTACTIC_BOTTOM: TypeTerm = bottom();

/** SP₂ — Semantic Emptiness: empty via unsatisfiable refinement (never-matching constraint). */
export const SP02_SEMANTIC_EMPTINESS: TypeTerm = refinement(
	base("number"),
	rangeConstraint(10, 5), // min > max — unsatisfiable
);

/** SP₃ — Global Top: ⟦S⟧ = V. */
export const SP03_GLOBAL_TOP: TypeTerm = top();

/** SP₄ — Sort-Restricted Top: all values within a base sort. */
export const SP04_SORT_RESTRICTED_TOP: TypeTerm = base("string");

/** SP₅ — Singleton Literal: |⟦S⟧| = 1. */
export const SP05_SINGLETON_LITERAL: TypeTerm = literal(42);

/** SP₆ — Finite Homogeneous Enum: literals of the same sort. */
export const SP06_HOMO_ENUM: TypeTerm = union([literal("red"), literal("green"), literal("blue")]);

/** SP₇ — Finite Heterogeneous Enum: literals of different sorts. */
export const SP07_HETERO_ENUM: TypeTerm = union([literal(1), literal("one"), literal(true)]);
