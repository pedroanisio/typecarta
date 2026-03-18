// scorecard/render
// Render scorecard results and comparisons as Markdown or JSON.

import type { ScorecardComparison, ScorecardResult } from "./types.js";

/**
 * Render a scorecard result as a Markdown table.
 *
 * @param result - the scorecard result to render
 * @returns a Markdown string with a header, criteria table, and totals
 */
export function renderMarkdown(result: ScorecardResult): string {
	const lines: string[] = [];
	lines.push(`# Scorecard: ${result.adapterName}`);
	lines.push("");
	lines.push("| # | Result | Justification |");
	lines.push("|---|:---:|---|");

	for (const [id, cell] of result.cells) {
		lines.push(`| ${id} | ${cell.value} | ${cell.justification ?? ""} |`);
	}

	lines.push("");
	lines.push(
		`**Totals:** ✓ ${result.totals.satisfied} | partial ${result.totals.partial} | ✗ ${result.totals.notSatisfied}`,
	);

	return lines.join("\n");
}

/**
 * Render a scorecard result as a JSON string.
 *
 * @param result - the scorecard result to render
 * @returns a pretty-printed JSON string
 */
export function renderJSON(result: ScorecardResult): string {
	const cells: Record<string, unknown> = {};
	for (const [id, cell] of result.cells) {
		cells[id] = {
			value: cell.value,
			justification: cell.justification,
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
 * Render a scorecard comparison as a Markdown table.
 *
 * @param comparison - the comparison to render
 * @returns a Markdown string with side-by-side values and a difference summary
 */
export function renderComparisonMarkdown(comparison: ScorecardComparison): string {
	const lines: string[] = [];
	lines.push(`# Comparison: ${comparison.left.adapterName} vs ${comparison.right.adapterName}`);
	lines.push("");
	lines.push(`| # | ${comparison.left.adapterName} | ${comparison.right.adapterName} |`);
	lines.push("|---|:---:|:---:|");

	const allIds = new Set([...comparison.left.cells.keys(), ...comparison.right.cells.keys()]);
	for (const id of allIds) {
		const leftCell = comparison.left.cells.get(id);
		const rightCell = comparison.right.cells.get(id);
		lines.push(`| ${id} | ${leftCell?.value ?? "✗"} | ${rightCell?.value ?? "✗"} |`);
	}

	if (comparison.differences.length > 0) {
		lines.push("");
		lines.push(`**${comparison.differences.length} difference(s) found.**`);
	} else {
		lines.push("");
		lines.push("**No differences.**");
	}

	return lines.join("\n");
}
