// s14-dependent
// Define the dependent-constraint witness S₁₄ for the diverse schema set.

import { base, field, literal, product, rangeConstraint, refinement, union } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/**
 * S₁₄ — Dependent Constraint (primary witness: π₁₄).
 * kind → value dependency.
 */
export const S14_DEPENDENT: TypeTerm = union([
	product([
		field("kind", literal("int")),
		field("value", refinement(base("number"), rangeConstraint())),
	]),
	product([field("kind", literal("float")), field("value", base("number"))]),
]);
