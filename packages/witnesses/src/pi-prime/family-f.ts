// family-f
// Define Family F witnesses (π'₂₃..π'₂₄) covering intersection types.
import { base, field, intersection, product, rangeConstraint, refinement } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₂₃ — Record-Merge Intersection: both operands contribute structural fields. */
export const SP23_RECORD_MERGE: TypeTerm = intersection([
	product([field("name", base("string"))]),
	product([field("age", base("number"))]),
]);

/** SP₂₄ — Refinement Intersection: structural type intersected with a refinement. */
export const SP24_REFINEMENT_INTERSECTION: TypeTerm = intersection([
	base("number"),
	refinement(base("number"), rangeConstraint(0, 100)),
]);
