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
	const lines: string[] = ["---", `adapter: ${result.adapterName}`];
	if (result.provenance) {
		lines.push(`typecarta_version: ${result.provenance.typecartaVersion}`);
		lines.push(`commit: ${result.provenance.commitHash}`);
		lines.push(`generated: ${result.provenance.generatedAt}`);
	} else {
		lines.push(`generated: ${new Date().toISOString()}`);
	}
	lines.push("---", "");

	return lines.join("\n") + coreRenderMarkdown(result);
}

/**
 * Render a scorecard comparison as Markdown with a YAML frontmatter header.
 *
 * @param comparison - Side-by-side scorecard comparison to render.
 * @returns A Markdown string with adapter names and generation timestamp.
 */
export function renderComparisonMarkdown(comparison: ScorecardComparison): string {
	const lines: string[] = [
		"---",
		`left: ${comparison.left.adapterName}`,
		`right: ${comparison.right.adapterName}`,
	];
	// Use the left side's provenance as the comparison's; both adapters were
	// evaluated by the same typecarta build, so the version/commit are shared.
	const prov = comparison.left.provenance ?? comparison.right.provenance;
	if (prov) {
		lines.push(`typecarta_version: ${prov.typecartaVersion}`);
		lines.push(`commit: ${prov.commitHash}`);
		lines.push(`generated: ${prov.generatedAt}`);
	} else {
		lines.push(`generated: ${new Date().toISOString()}`);
	}
	lines.push("---", "");

	return lines.join("\n") + coreRenderComparisonMarkdown(comparison);
}
