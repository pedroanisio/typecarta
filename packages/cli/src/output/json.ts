// JSON output formatter — produce structured machine-readable output.

import type { EncodingCheckResult, ScorecardComparison, ScorecardResult } from "@typecarta/core";

/**
 * Render a scorecard as pretty-printed JSON.
 *
 * @param result - Scorecard evaluation result to serialize.
 * @returns A JSON string with adapter name, cells, and totals.
 */
export function renderJSON(result: ScorecardResult): string {
	const cells: Record<string, { value: string; justification?: string }> = {};
	for (const [id, cell] of result.cells) {
		cells[id] = {
			value: cell.value,
			...(cell.justification ? { justification: cell.justification } : {}),
		};
	}
	return JSON.stringify(
		{
			adapter: result.adapterName,
			cells,
			totals: result.totals,
		},
		null,
		2,
	);
}

/**
 * Render a scorecard comparison as pretty-printed JSON.
 *
 * @param comparison - Side-by-side scorecard comparison to serialize.
 * @returns A JSON string with left/right results and differences.
 */
export function renderComparisonJSON(comparison: ScorecardComparison): string {
	const leftCells: Record<string, string> = {};
	const rightCells: Record<string, string> = {};
	for (const [id, cell] of comparison.left.cells) leftCells[id] = cell.value;
	for (const [id, cell] of comparison.right.cells) rightCells[id] = cell.value;

	return JSON.stringify(
		{
			left: {
				adapter: comparison.left.adapterName,
				cells: leftCells,
				totals: comparison.left.totals,
			},
			right: {
				adapter: comparison.right.adapterName,
				cells: rightCells,
				totals: comparison.right.totals,
			},
			differences: comparison.differences.map((d) => ({
				criterion: d.criterionId,
				left: d.leftValue,
				right: d.rightValue,
			})),
		},
		null,
		2,
	);
}

/**
 * Render encoding-check results as pretty-printed JSON.
 *
 * @param results - Array of encoding-check evaluation results.
 * @returns A JSON string with per-property results and a pass/fail summary.
 */
export function renderEncodingCheckJSON(results: readonly EncodingCheckResult[]): string {
	return JSON.stringify(
		{
			results: results.map((r) => ({
				property: r.property,
				holds: r.holds,
				reason: r.reason ?? null,
			})),
			summary: {
				total: results.length,
				passed: results.filter((r) => r.holds).length,
				failed: results.filter((r) => !r.holds).length,
			},
		},
		null,
		2,
	);
}
