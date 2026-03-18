// s06-intersection
// Define the intersection witness S₆ for the diverse schema set.

import { base, field, intersection, product, rangeConstraint, refinement } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/**
 * S₆ — Intersection (primary witness: π₆).
 * τ_A ⊓ τ_B where both contribute fields with overlapping constraints.
 */
export const S06_INTERSECTION: TypeTerm = intersection([
	product([field("x", refinement(base("number"), rangeConstraint(0))), field("y", base("string"))]),
	product([field("x", base("number")), field("z", base("boolean"))]),
]);
