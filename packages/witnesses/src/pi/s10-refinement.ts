// s10-refinement
// Define the refinement witness S₁₀ for the diverse schema set.

import {
	andPredicate,
	base,
	multipleOfConstraint,
	rangeConstraint,
	refinement,
} from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/**
 * S₁₀ — Refinement (primary witness: π₁₀).
 * {v: ℕ | 0 ≤ v ≤ 100 ∧ v mod 5 = 0}
 */
export const S10_REFINEMENT: TypeTerm = refinement(
	base("number"),
	andPredicate(rangeConstraint(0, 100), multipleOfConstraint(5)),
);
