// exact
// Compare two extensions point-by-point over a provided value set.
// Suitable for finite or small value domains.

import type { Extension, Value } from "@typecarta/core";

/** Hold equality, subset, and superset flags with any mismatched values. */
export interface ExactComparisonResult {
	readonly equal: boolean;
	readonly subset: boolean;
	readonly superset: boolean;
	readonly mismatches: readonly ExactMismatch[];
}

/** Represent a value where two extensions disagree on membership. */
export interface ExactMismatch {
	readonly value: Value;
	readonly inLeft: boolean;
	readonly inRight: boolean;
}

/**
 * Compare two extensions exactly over the given value domain.
 *
 * @param left - First extension to compare.
 * @param right - Second extension to compare.
 * @param values - Finite set of values to test membership against.
 * @returns Subset, superset, and equality flags with any mismatches.
 */
export function compareExact(
	left: Extension,
	right: Extension,
	values: readonly Value[],
): ExactComparisonResult {
	const mismatches: ExactMismatch[] = [];
	let leftSubsetRight = true;
	let rightSubsetLeft = true;

	for (const v of values) {
		const inLeft = left.contains(v);
		const inRight = right.contains(v);

		if (inLeft && !inRight) {
			leftSubsetRight = false;
			mismatches.push({ value: v, inLeft: true, inRight: false });
		}
		if (inRight && !inLeft) {
			rightSubsetLeft = false;
			mismatches.push({ value: v, inLeft: false, inRight: true });
		}
	}

	return {
		equal: leftSubsetRight && rightSubsetLeft,
		subset: leftSubsetRight,
		superset: rightSubsetLeft,
		mismatches,
	};
}
