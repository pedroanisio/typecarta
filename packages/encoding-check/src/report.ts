// report
// Render encoding-check results as a Markdown report table.

import type { EncodingCheckResult } from "@typecarta/core";

/**
 * Generate a Markdown report from encoding-check results.
 *
 * @param results - Check results to render.
 * @returns Markdown string containing a summary table and pass count.
 */
export function generateReport(results: readonly EncodingCheckResult[]): string {
	const lines: string[] = ["# Encoding-Check Report", ""];
	lines.push("| Property | Holds | Reason |");
	lines.push("|---|:---:|---|");

	for (const r of results) {
		lines.push(`| ${r.property} | ${r.holds ? "✓" : "✗"} | ${r.reason ?? ""} |`);
	}

	const passed = results.filter((r) => r.holds).length;
	lines.push("");
	lines.push(`**${passed}/${results.length} checks passed.**`);

	return lines.join("\n");
}
