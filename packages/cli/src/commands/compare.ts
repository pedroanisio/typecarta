// compare — Evaluate two adapters side-by-side and highlight differences.

import {
	type WitnessEntry,
	compareScorecards,
	evaluateScorecard,
	getAdapter,
} from "@typecarta/core";
import { DIVERSE_SCHEMAS } from "@typecarta/witnesses";
import { renderComparisonJSON } from "../output/json.js";
import { renderComparisonMarkdown } from "../output/markdown.js";
import { renderTerminalComparison } from "../output/terminal.js";

/**
 * Execute the `typecarta compare` subcommand.
 *
 * @param args - CLI arguments after the subcommand name.
 * @returns Resolves when the comparison has been printed to stdout.
 */
export async function run(args: string[]): Promise<void> {
	const leftIdx = args.indexOf("--left");
	const rightIdx = args.indexOf("--right");
	if (leftIdx === -1 || rightIdx === -1 || !args[leftIdx + 1] || !args[rightIdx + 1]) {
		console.error(
			"Usage: typecarta compare --left <adapter> --right <adapter> [--output table|markdown|json]",
		);
		process.exit(1);
	}

	const outputIdx = args.indexOf("--output");
	const format = outputIdx !== -1 ? args[outputIdx + 1] : "table";

	const leftAdapter = getAdapter(args[leftIdx + 1]!);
	const rightAdapter = getAdapter(args[rightIdx + 1]!);
	if (!leftAdapter || !rightAdapter) {
		console.error("One or both adapters not found.");
		process.exit(1);
	}

	const witnesses: WitnessEntry[] = DIVERSE_SCHEMAS.map((w) => ({
		criterionId: w.id,
		schema: w.schema,
		name: w.name,
	}));

	const leftResult = evaluateScorecard(leftAdapter, witnesses);
	const rightResult = evaluateScorecard(rightAdapter, witnesses);
	const comparison = compareScorecards(leftResult, rightResult);

	switch (format) {
		case "json":
			console.log(renderComparisonJSON(comparison));
			break;
		case "markdown":
			console.log(renderComparisonMarkdown(comparison));
			break;
		default:
			console.log(renderTerminalComparison(comparison));
	}
}
