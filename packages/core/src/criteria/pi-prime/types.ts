/**
 * Criterion types — the unified 70-criterion set Π (spec §8.5, §12).
 *
 * The `core: true` flag identifies the 15-criterion canonical subset Π_core (spec §9).
 *
 * Identifier strings retain the `pi-prime-NN` form for stability per ADR-006;
 * the `-prime-` infix is historical and no longer denotes a distinct set.
 */

import type { TypeTerm } from "../../ast/type-term.js";

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

/** All criterion IDs (70 total). */
export const CRITERION_IDS = [
	"pi-prime-01",
	"pi-prime-02",
	"pi-prime-03",
	"pi-prime-04",
	"pi-prime-05",
	"pi-prime-06",
	"pi-prime-07",
	"pi-prime-08",
	"pi-prime-09",
	"pi-prime-10",
	"pi-prime-11",
	"pi-prime-12",
	"pi-prime-13",
	"pi-prime-14",
	"pi-prime-15",
	"pi-prime-16",
	"pi-prime-17",
	"pi-prime-18",
	"pi-prime-19",
	"pi-prime-20",
	"pi-prime-21",
	"pi-prime-22",
	"pi-prime-23",
	"pi-prime-24",
	"pi-prime-25",
	"pi-prime-26",
	"pi-prime-27",
	"pi-prime-28",
	"pi-prime-29",
	"pi-prime-30",
	"pi-prime-31",
	"pi-prime-32",
	"pi-prime-33",
	"pi-prime-34",
	"pi-prime-35",
	"pi-prime-36",
	"pi-prime-37",
	"pi-prime-38",
	"pi-prime-39",
	"pi-prime-40",
	"pi-prime-41",
	"pi-prime-42",
	"pi-prime-43",
	"pi-prime-44",
	"pi-prime-45",
	"pi-prime-46",
	"pi-prime-47",
	"pi-prime-48",
	"pi-prime-49",
	"pi-prime-50",
	"pi-prime-51",
	"pi-prime-52",
	"pi-prime-53",
	"pi-prime-54",
	"pi-prime-55",
	"pi-prime-56",
	"pi-prime-57",
	"pi-prime-58",
	"pi-prime-59",
	"pi-prime-60",
	"pi-prime-61",
	"pi-prime-62",
	"pi-prime-63",
	"pi-prime-64",
	"pi-prime-65",
	"pi-prime-66",
	"pi-prime-67",
	"pi-prime-68",
	"pi-prime-69",
	"pi-prime-70",
] as const;

/** A criterion identifier. */
export type CriterionId = (typeof CRITERION_IDS)[number];

/** Family identifiers (22 families A–V). */
export type CriterionFamily =
	| "A"
	| "B"
	| "C"
	| "D"
	| "E"
	| "F"
	| "G"
	| "H"
	| "I"
	| "J"
	| "K"
	| "L"
	| "M"
	| "N"
	| "O"
	| "P"
	| "Q"
	| "R"
	| "S"
	| "T"
	| "U"
	| "V";

/** Result of evaluating a criterion against a type term. */
export type CriterionResult =
	| { readonly status: "satisfied"; readonly witness?: TypeTerm }
	| { readonly status: "not-satisfied"; readonly reason?: string }
	| { readonly status: "undecidable"; readonly reason: string };

/** A criterion predicate (spec Def. 8.1). */
export interface Criterion {
	readonly id: CriterionId;
	readonly name: string;
	readonly description: string;
	readonly family: CriterionFamily;
	readonly meta?: MetaTag;
	/** Marks the canonical core subset Π_core (15 criteria). Filtered by `--filter core` on the CLI. */
	readonly core?: boolean;
	/** Evaluate the criterion against a type term. */
	evaluate(term: TypeTerm): CriterionResult;
}

/** Registry mapping criterion IDs to predicates. */
export type CriterionRegistry = ReadonlyMap<CriterionId, Criterion>;
