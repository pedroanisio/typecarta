/**
 * Example: CI Compatibility Gate
 *
 * Demonstrates how to use typecarta as a CI check that blocks merges
 * when schema changes cause criteria regressions. Compares a "before"
 * and "after" schema version, and exits with a non-zero code if any
 * criterion regresses.
 */

import { JsonSchemaAdapter } from "@typecarta/adapter-json-schema";
import {
	type CellValue,
	type IRAdapter,
	type Signature,
	type TypeTerm,
	type WitnessEntry,
	array,
	base,
	bottom,
	compareScorecards,
	createSignature,
	evaluateScorecard,
	field,
	product,
	rangeConstraint,
	refinement,
	renderComparisonMarkdown,
	top,
	union,
} from "@typecarta/core";

// ── Simulate two schema versions ───────────────────────────────────

// V1: a well-typed User schema with refined age field
const userSchemaV1: WitnessEntry[] = [
	{
		criterionId: "pi-04",
		name: "User (product)",
		schema: product([
			field("name", base("string")),
			field("age", refinement(base("number"), rangeConstraint(0, 150))),
			field("email", base("string")),
		]),
	},
	{
		criterionId: "pi-10",
		name: "User age (refinement)",
		schema: refinement(base("number"), rangeConstraint(0, 150)),
	},
	{
		criterionId: "pi-05",
		name: "Status enum",
		schema: union([base("string"), base("string")]),
	},
	{
		criterionId: "pi-01",
		name: "Deleted user",
		schema: bottom(),
	},
	{
		criterionId: "pi-02",
		name: "Any value",
		schema: top(),
	},
	{
		criterionId: "pi-03",
		name: "User singleton",
		schema: product([field("id", base("number"))]),
	},
];

// V2: a breaking change - removed refinement on age, loosened types
const userSchemaV2: WitnessEntry[] = [
	{
		criterionId: "pi-04",
		name: "User (product)",
		schema: product([
			field("name", base("string")),
			field("age", base("number")), // Lost: range refinement
			field("email", base("string")),
		]),
	},
	{
		criterionId: "pi-10",
		name: "User age (refinement)",
		schema: base("number"), // Lost: was refined, now bare number
	},
	{
		criterionId: "pi-05",
		name: "Status enum",
		schema: union([base("string"), base("string")]),
	},
	{
		criterionId: "pi-01",
		name: "Deleted user",
		schema: bottom(),
	},
	{
		criterionId: "pi-02",
		name: "Any value",
		schema: top(),
	},
	{
		criterionId: "pi-03",
		name: "User singleton",
		schema: product([field("id", base("number"))]),
	},
];

// ── Gate logic ─────────────────────────────────────────────────────

const CELL_VALUE_RANK: Record<CellValue, number> = {
	"\u2713": 2,
	partial: 1,
	"\u2717": 0,
};

function main(): void {
	const adapter = new JsonSchemaAdapter();

	console.log("=== CI Compatibility Gate ===\n");
	console.log("Comparing schema versions for regressions...\n");

	const beforeScorecard = evaluateScorecard(adapter, userSchemaV1);
	const afterScorecard = evaluateScorecard(adapter, userSchemaV2);
	const comparison = compareScorecards(beforeScorecard, afterScorecard);

	// Print comparison
	console.log(renderComparisonMarkdown(comparison));
	console.log();

	// Check for regressions
	const regressions = comparison.differences.filter((diff) => {
		const beforeRank = CELL_VALUE_RANK[diff.leftValue];
		const afterRank = CELL_VALUE_RANK[diff.rightValue];
		return afterRank < beforeRank;
	});

	const improvements = comparison.differences.filter((diff) => {
		const beforeRank = CELL_VALUE_RANK[diff.leftValue];
		const afterRank = CELL_VALUE_RANK[diff.rightValue];
		return afterRank > beforeRank;
	});

	console.log("=== Gate Result ===\n");

	if (improvements.length > 0) {
		console.log(`Improvements (${improvements.length}):`);
		for (const imp of improvements) {
			console.log(`  [+] ${imp.criterionId}: ${imp.leftValue} -> ${imp.rightValue}`);
		}
		console.log();
	}

	if (regressions.length > 0) {
		console.log(`Regressions (${regressions.length}):`);
		for (const reg of regressions) {
			console.log(`  [-] ${reg.criterionId}: ${reg.leftValue} -> ${reg.rightValue}`);
		}
		console.log();
		console.log("GATE: FAILED - Schema changes caused criterion regressions.");
		console.log("Fix the regressions above before merging.");
		process.exit(1);
	} else {
		console.log("GATE: PASSED - No criterion regressions detected.");
		process.exit(0);
	}
}

main();
