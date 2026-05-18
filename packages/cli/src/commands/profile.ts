// profile — Analyze a schema and report which criteria it exercises.

import {
	CRITERIA,
	CRITERION_IDS,
	type CriterionResult,
	getAdapter,
	printTerm,
} from "@typecarta/core";

/**
 * Execute the `typecarta profile` subcommand.
 *
 * @param args - CLI arguments after the subcommand name.
 * @returns Resolves when the profile report has been printed to stdout.
 */
export async function run(args: string[]): Promise<void> {
	const schemaIdx = args.indexOf("--schema");
	const adapterIdx = args.indexOf("--adapter");

	if (schemaIdx === -1 || !args[schemaIdx + 1]) {
		console.error("Usage: typecarta profile --schema <file> [--adapter <name>]");
		process.exit(1);
	}

	const schemaPath = args[schemaIdx + 1]!;
	const adapterName = adapterIdx !== -1 ? args[adapterIdx + 1] : undefined;

	const fs = await import("node:fs");
	if (!fs.existsSync(schemaPath)) {
		console.error(`File not found: ${schemaPath}`);
		process.exit(1);
	}

	const raw = fs.readFileSync(schemaPath, "utf-8");
	let schemaDoc: Record<string, unknown>;
	try {
		schemaDoc = JSON.parse(raw);
	} catch {
		console.error("Failed to parse schema file as JSON.");
		process.exit(1);
		return;
	}

	const adapter = adapterName ? getAdapter(adapterName) : undefined;
	if (adapterName && !adapter) {
		console.error(`Adapter "${adapterName}" not found.`);
		process.exit(1);
	}

	const term = adapter ? adapter.parse(schemaDoc) : undefined;
	if (!term) {
		console.error("Could not parse schema. Provide --adapter to specify the schema language.");
		process.exit(1);
		return;
	}

	console.log(`Schema: ${schemaPath}`);
	console.log(`AST:    ${printTerm(term)}`);
	console.log("");

	console.log("## Criteria");
	console.log("");
	let satisfied = 0;
	let coreSatisfied = 0;
	let coreTotal = 0;
	for (const criterion of CRITERIA) {
		const result: CriterionResult = criterion.evaluate(term);
		const icon = result.status === "satisfied" ? "✓" : result.status === "undecidable" ? "?" : "✗";
		const coreTag = criterion.core ? " [core]" : "";
		if (result.status === "satisfied") satisfied++;
		if (criterion.core) {
			coreTotal++;
			if (result.status === "satisfied") coreSatisfied++;
		}
		console.log(`  ${icon} ${criterion.id} ${criterion.name} [${criterion.family}]${coreTag}`);
	}
	console.log("");
	console.log(
		`  ${satisfied}/${CRITERION_IDS.length} criteria satisfied (${coreSatisfied}/${coreTotal} core).`,
	);
}
