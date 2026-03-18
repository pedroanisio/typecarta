// Markdown output formatter — delegate to core render functions
// with CLI-specific additions (timestamps, metadata).

import {
	type ScorecardComparison,
	type ScorecardResult,
	renderComparisonMarkdown as coreRenderComparisonMarkdown,
	renderMarkdown as coreRenderMarkdown,
} from "@typecarta/core";

/**
 * Render a scorecard as Markdown with a YAML frontmatter header.
 *
 * @param result - Scorecard evaluation result to render.
 * @returns A Markdown string with adapter name and generation timestamp.
 */
export function renderMarkdown(result: ScorecardResult): string {
	const header = [
		"---",
		`adapter: ${result.adapterName}`,
		`generated: ${new Date().toISOString()}`,
		"---",
		"",
	].join("\n");

	return header + coreRenderMarkdown(result);
}

/**
 * Render a scorecard comparison as Markdown with a YAML frontmatter header.
 *
 * @param comparison - Side-by-side scorecard comparison to render.
 * @returns A Markdown string with adapter names and generation timestamp.
 */
export function renderComparisonMarkdown(comparison: ScorecardComparison): string {
	const header = [
		"---",
		`left: ${comparison.left.adapterName}`,
		`right: ${comparison.right.adapterName}`,
		`generated: ${new Date().toISOString()}`,
		"---",
		"",
	].join("\n");

	return header + coreRenderComparisonMarkdown(comparison);
}
