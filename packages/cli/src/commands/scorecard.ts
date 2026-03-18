// scorecard — Evaluate an adapter against all criteria and display results.

import { evaluatePrimeScorecard, evaluateScorecard, getAdapter } from "@typecarta/core";
import { DIVERSE_PRIME_SCHEMAS, DIVERSE_SCHEMAS } from "@typecarta/witnesses";
import { renderJSON } from "../output/json.js";
import { renderMarkdown } from "../output/markdown.js";
import { renderTerminal } from "../output/terminal.js";

/**
 * Execute the `typecarta scorecard` subcommand.
 *
 * @param args - CLI arguments after the subcommand name.
 * @returns Resolves when the scorecard has been printed to stdout.
 */
export async function run(args: string[]): Promise<void> {
	const adapterIdx = args.indexOf("--adapter");
	if (adapterIdx === -1 || !args[adapterIdx + 1]) {
		console.error(
			"Usage: typecarta scorecard --adapter <name> [--mode core|full] [--output table|markdown|json]",
		);
		process.exit(1);
	}
	const adapterName = args[adapterIdx + 1]!;
	const outputIdx = args.indexOf("--output");
	const format = outputIdx !== -1 ? args[outputIdx + 1] : "table";
	const modeIdx = args.indexOf("--mode");
	const mode = modeIdx !== -1 ? args[modeIdx + 1] : "core";

	if (mode !== "core" && mode !== "full") {
		console.error(`Invalid mode "${mode}". Use "core" (15 criteria) or "full" (70 criteria).`);
		process.exit(1);
	}

	const adapter = getAdapter(adapterName);
	if (!adapter) {
		console.error(`Adapter "${adapterName}" not found. Register it first.`);
		process.exit(1);
	}

	const result =
		mode === "full"
			? evaluatePrimeScorecard(
					adapter,
					DIVERSE_PRIME_SCHEMAS.map((w) => ({
						criterionId: w.id,
						schema: w.schema,
						name: w.name,
					})),
				)
			: evaluateScorecard(
					adapter,
					DIVERSE_SCHEMAS.map((w) => ({
						criterionId: w.id,
						schema: w.schema,
						name: w.name,
					})),
				);

	switch (format) {
		case "json":
			console.log(renderJSON(result));
			break;
		case "markdown":
			console.log(renderMarkdown(result));
			break;
		default:
			console.log(renderTerminal(result));
	}
}
