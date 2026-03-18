/**
 * Example: Basic Scorecard Evaluation
 *
 * Registers the JSON Schema adapter, evaluates it against the full
 * set of 15 base criteria using the diverse witness schemas, and
 * prints the scorecard in both Markdown and JSON formats.
 */

import { JsonSchemaAdapter } from "@typecarta/adapter-json-schema";
import {
	type WitnessEntry,
	clearAdapters,
	evaluateScorecard,
	registerAdapter,
	renderJSON,
	renderMarkdown,
} from "@typecarta/core";
import { DIVERSE_SCHEMAS, type WitnessSchema } from "@typecarta/witnesses";

// ── Setup ──────────────────────────────────────────────────────────

// Create and register the JSON Schema adapter
clearAdapters();
const adapter = new JsonSchemaAdapter();
registerAdapter(adapter);

// Convert witness schemas to witness entries expected by the scorecard
const witnesses: WitnessEntry[] = DIVERSE_SCHEMAS.map((ws: WitnessSchema) => ({
	criterionId: ws.id,
	schema: ws.schema,
	name: ws.name,
}));

// ── Evaluate ───────────────────────────────────────────────────────

console.log("Evaluating JSON Schema adapter against base criteria...\n");

const scorecard = evaluateScorecard(adapter, witnesses);

// ── Output: Markdown ───────────────────────────────────────────────

console.log("=== Markdown Output ===\n");
console.log(renderMarkdown(scorecard));
console.log();

// ── Output: JSON ───────────────────────────────────────────────────

console.log("=== JSON Output ===\n");
console.log(renderJSON(scorecard));
console.log();

// ── Summary ────────────────────────────────────────────────────────

console.log("=== Summary ===");
console.log(`Adapter:       ${scorecard.adapterName}`);
console.log(
	`Satisfied:     ${scorecard.totals.satisfied} / ${scorecard.totals.satisfied + scorecard.totals.partial + scorecard.totals.notSatisfied}`,
);
console.log(`Partial:       ${scorecard.totals.partial}`);
console.log(`Not satisfied: ${scorecard.totals.notSatisfied}`);
