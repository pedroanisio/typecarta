// Operational Subtyping — Definition 2.4
//
// Model the operational assignability judgment ≤_op that an IR may
// implement, even when it intentionally diverges from the semantic relation ≤.
//
// Spec: Definition 2.4, typecarta formal semantics.

import type { TypeTerm } from "../ast/type-term.js";

/** Define the operational subtyping judgment for an IR. */
export interface OperationalSubtyping {
	/** Check operational assignability: a ≤_op b. */
	isAssignable(a: TypeTerm, b: TypeTerm): boolean;
}

/** Record a divergence between semantic and operational subtyping for a type pair. */
export interface SubtypingDivergence {
	readonly a: TypeTerm;
	readonly b: TypeTerm;
	/** True if a ≤ b (semantic). */
	readonly semantic: boolean;
	/** True if a ≤_op b (operational). */
	readonly operational: boolean;
	/** Description of why they diverge. */
	readonly reason?: string;
}

/**
 * Detect divergences between semantic and operational subtyping for a set of type pairs.
 *
 * @param pairs - Type-term pairs to compare.
 * @param semanticCheck - Predicate implementing the semantic relation ≤.
 * @param operationalCheck - Predicate implementing the operational relation ≤_op.
 * @returns Array of {@link SubtypingDivergence} entries where the two relations disagree.
 */
export function findDivergences(
	pairs: readonly [TypeTerm, TypeTerm][],
	semanticCheck: (a: TypeTerm, b: TypeTerm) => boolean,
	operationalCheck: (a: TypeTerm, b: TypeTerm) => boolean,
): SubtypingDivergence[] {
	const divergences: SubtypingDivergence[] = [];
	for (const [a, b] of pairs) {
		const semantic = semanticCheck(a, b);
		const operational = operationalCheck(a, b);
		if (semantic !== operational) {
			divergences.push({ a, b, semantic, operational });
		}
	}
	return divergences;
}
