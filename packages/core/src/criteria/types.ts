// criteria/types
// Define the core types for coverage criteria (Def. 8.1): identifiers,
// meta-tags, evaluation results, and the predicate interface.

import type { TypeTerm } from "../ast/type-term.js";
import type { PiPrimeId } from "./pi-prime/types.js";

/** Enumerate the criterion identifiers for the base set Π. */
export const PI_IDS = [
	"pi-01",
	"pi-02",
	"pi-03",
	"pi-04",
	"pi-05",
	"pi-06",
	"pi-07",
	"pi-08",
	"pi-09",
	"pi-10",
	"pi-11",
	"pi-12",
	"pi-13",
	"pi-14",
	"pi-15",
] as const;

/** Identify a single criterion from the base set Π. */
export type PiId = (typeof PI_IDS)[number];

/** Identify a criterion from either the base set Π or the expanded set Π'. */
export type CriterionId = PiId | PiPrimeId;

/**
 * Tag a criterion that requires enriched semantics beyond standard denotation.
 *
 * @remarks
 * Criteria tagged with a MetaTag depend on adapter capabilities outside
 * the core ⟦τ⟧ ⊆ V model: operational subtyping (meta-op), implicit
 * coercion (meta-coerce), multi-schema (meta-multi), or annotation
 * preservation (meta-annot).
 */
export type MetaTag = "meta-op" | "meta-coerce" | "meta-multi" | "meta-annot";

/** Represent the outcome of evaluating a criterion against a schema. */
export type CriterionResult =
	| { readonly status: "satisfied"; readonly witness?: TypeTerm }
	| { readonly status: "not-satisfied"; readonly reason?: string }
	| { readonly status: "undecidable"; readonly reason: string };

/** Define a decidable coverage criterion predicate (Def. 8.1). */
export interface CriterionPredicate {
	readonly id: CriterionId;
	readonly name: string;
	readonly description: string;
	readonly meta?: MetaTag;
	/** Evaluate the criterion against a type term. */
	evaluate(term: TypeTerm): CriterionResult;
}

/** Map criterion IDs to their predicate implementations. */
export type CriterionRegistry = ReadonlyMap<CriterionId, CriterionPredicate>;
