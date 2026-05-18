// scorecard — Evaluate an adapter against the unified criterion set.
//
// --filter all   evaluate all 70 criteria (default)
// --filter core  evaluate only the 15-criterion canonical subset
//
// --mode is accepted as a legacy alias: --mode full == --filter all,
//   --mode core == --filter core.

import { CRITERIA, evaluateScorecard, getAdapter } from "@typecarta/core";
import { ALL_WITNESSES, CORE_SCHEMAS } from "@typecarta/witnesses";
import { renderJSON } from "../output/json.js";
import { renderMarkdown } from "../output/markdown.js";
import { renderTerminal } from "../output/terminal.js";
import { captureProvenance } from "../provenance.js";

type Filter = "core" | "all";

function parseFilter(args: string[]): Filter | { error: string } {
	const filterIdx = args.indexOf("--filter");
	if (filterIdx !== -1) {
		const value = args[filterIdx + 1];
		if (value === "core" || value === "all") return value;
		return { error: `Invalid --filter "${value}". Use "core" (15 criteria) or "all" (70).` };
	}
	// legacy alias
	const modeIdx = args.indexOf("--mode");
	if (modeIdx !== -1) {
		const value = args[modeIdx + 1];
		if (value === "core") return "core";
		if (value === "full") return "all";
		return { error: `Invalid --mode "${value}". Use "core" or "full".` };
	}
	return "core";
}

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
			"Usage: typecarta scorecard --adapter <name> [--filter core|all] [--output table|markdown|json]",
		);
		process.exit(1);
		return;
	}
	const adapterName = args[adapterIdx + 1]!;
	const outputIdx = args.indexOf("--output");
	const format = outputIdx !== -1 ? args[outputIdx + 1] : "table";

	const filter = parseFilter(args);
	if (typeof filter === "object") {
		console.error(filter.error);
		process.exit(1);
		return;
	}

	const adapter = getAdapter(adapterName);
	if (!adapter) {
		console.error(`Adapter "${adapterName}" not found. Register it first.`);
		process.exit(1);
		return;
	}

	const witnesses =
		filter === "core"
			? CORE_SCHEMAS.map((w) => ({ criterionId: w.id, schema: w.schema, name: w.name }))
			: ALL_WITNESSES.map((w) => ({
					criterionId: w.id,
					schema: w.schema,
					name: w.name,
				}));

	const baseResult =
		filter === "core"
			? evaluateScorecard(adapter, witnesses)
			: evaluateScorecard(adapter, witnesses, CRITERIA);
	const result = { ...baseResult, provenance: captureProvenance(adapter) };

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
