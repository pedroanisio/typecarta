// scorecard/compare
// Diff two scorecard results and collect per-criterion differences.

import type { ScorecardComparison, ScorecardDiff, ScorecardResult } from "./types.js";

/**
 * Compare two scorecard results and produce a diff.
 *
 * @param left - the first scorecard result
 * @param right - the second scorecard result
 * @returns a comparison containing both results and any per-criterion differences
 */
export function compareScorecards(
	left: ScorecardResult,
	right: ScorecardResult,
): ScorecardComparison {
	const differences: ScorecardDiff[] = [];
	const allIds = new Set([...left.cells.keys(), ...right.cells.keys()]);

	for (const id of allIds) {
		const leftValue = left.cells.get(id)?.value ?? "✗";
		const rightValue = right.cells.get(id)?.value ?? "✗";

		if (leftValue !== rightValue) {
			differences.push({
				criterionId: id,
				leftValue,
				rightValue,
			});
		}
	}

	return { left, right, differences };
}
