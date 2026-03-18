// profile — Analyze a schema and report which base and expanded criteria it exercises.

import {
	type CriterionResult,
	PI_CRITERIA,
	PI_IDS,
	PI_PRIME_CRITERIA,
	PI_PRIME_IDS,
	PI_REGISTRY,
	type PiPrimeCriterionResult,
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

	// Load schema file
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

	// Parse via adapter if provided
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

	// Evaluate base criteria Π
	console.log("## Base Criteria (Π)");
	console.log("");
	let piSatisfied = 0;
	for (const id of PI_IDS) {
		const criterion = PI_REGISTRY.get(id);
		if (!criterion) continue;
		const result: CriterionResult = criterion.evaluate(term);
		const icon = result.status === "satisfied" ? "✓" : result.status === "undecidable" ? "?" : "✗";
		if (result.status === "satisfied") piSatisfied++;
		console.log(`  ${icon} ${id} ${criterion.name}`);
	}
	console.log(`\n  ${piSatisfied}/${PI_IDS.length} base criteria satisfied.\n`);

	// Evaluate expanded criteria Π'
	console.log("## Expanded Criteria (Π')");
	console.log("");
	let ppSatisfied = 0;
	for (const criterion of PI_PRIME_CRITERIA) {
		const result: PiPrimeCriterionResult = criterion.evaluate(term);
		const icon = result.status === "satisfied" ? "✓" : result.status === "undecidable" ? "?" : "✗";
		if (result.status === "satisfied") ppSatisfied++;
		console.log(`  ${icon} ${criterion.id} ${criterion.name} [${criterion.family}]`);
	}
	console.log(`\n  ${ppSatisfied}/${PI_PRIME_IDS.length} expanded criteria satisfied.`);
}
