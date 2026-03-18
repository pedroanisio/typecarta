/**
 * Expanded criterion set Π' — 70 criteria across 22 families (§12).
 */

import type { TypeTerm } from "../../ast/type-term.js";
import type { MetaTag } from "../types.js";

/** All Π' criterion IDs. */
export const PI_PRIME_IDS = [
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

/** A Π' criterion identifier. */
export type PiPrimeId = (typeof PI_PRIME_IDS)[number];

/** Family identifiers for Π' criteria. */
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

/** Result of evaluating a Π' criterion. */
export type PiPrimeCriterionResult =
	| { readonly status: "satisfied"; readonly witness?: TypeTerm }
	| { readonly status: "not-satisfied"; readonly reason?: string }
	| { readonly status: "undecidable"; readonly reason: string };

/** A Π' criterion predicate. */
export interface PiPrimeCriterion {
	readonly id: PiPrimeId;
	readonly name: string;
	readonly description: string;
	readonly family: CriterionFamily;
	readonly meta?: MetaTag;
	/** The base Π criterion this refines, if any. */
	readonly refines?: string;
	/** Evaluate the criterion against a type term. */
	evaluate(term: TypeTerm): PiPrimeCriterionResult;
}

/** Registry mapping Π' IDs to criterion predicates. */
export type PiPrimeRegistry = ReadonlyMap<PiPrimeId, PiPrimeCriterion>;
