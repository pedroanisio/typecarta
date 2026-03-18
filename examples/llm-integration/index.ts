/**
 * Example: LLM Integration
 *
 * Generates a scorecard as structured JSON and demonstrates how to
 * format it for consumption by a large language model. Shows two
 * patterns:
 *
 * 1. Structured JSON payload for function-calling / tool-use APIs
 * 2. Markdown-formatted prompt for chat-based APIs
 */

import { JsonSchemaAdapter } from "@typecarta/adapter-json-schema";
import {
	PI_CRITERIA,
	type WitnessEntry,
	clearAdapters,
	evaluateScorecard,
	registerAdapter,
	renderJSON,
	renderMarkdown,
} from "@typecarta/core";
import { DIVERSE_SCHEMAS, type WitnessSchema } from "@typecarta/witnesses";

// ── Setup ──────────────────────────────────────────────────────────

clearAdapters();
const adapter = new JsonSchemaAdapter();
registerAdapter(adapter);

const witnesses: WitnessEntry[] = DIVERSE_SCHEMAS.map((ws: WitnessSchema) => ({
	criterionId: ws.id,
	schema: ws.schema,
	name: ws.name,
}));

const scorecard = evaluateScorecard(adapter, witnesses);

// ── Pattern 1: Structured JSON for tool-use APIs ───────────────────

function buildToolPayload(): object {
	const cells: Record<string, { value: string; justification: string }> = {};
	for (const [id, cell] of scorecard.cells) {
		cells[id] = {
			value: cell.value,
			justification: cell.justification ?? "",
		};
	}

	return {
		tool: "typecarta_scorecard",
		version: "0.1.0",
		adapter: scorecard.adapterName,
		criteria_count: PI_CRITERIA.length,
		totals: {
			satisfied: scorecard.totals.satisfied,
			partial: scorecard.totals.partial,
			not_satisfied: scorecard.totals.notSatisfied,
		},
		cells,
		metadata: {
			framework: "typecarta",
			description:
				"Expressiveness scorecard evaluating a schema IR against formal coverage criteria",
			criteria_set: "base (15 criteria)",
		},
	};
}

// ── Pattern 2: Markdown prompt for chat APIs ───────────────────────

function buildChatPrompt(): string {
	const markdown = renderMarkdown(scorecard);

	return `You are a schema design expert. Analyze the following typecarta scorecard
for the "${scorecard.adapterName}" schema language.

The scorecard evaluates this schema language against 15 formal expressiveness
criteria. Each criterion tests whether the IR can faithfully represent a
specific type-theoretic concept.

Legend:
- A checkmark means the criterion is fully satisfied
- "partial" means the IR can encode it but with information loss
- An X means the IR cannot express this concept at all

${markdown}

Based on this scorecard:
1. What are the main expressiveness strengths of this schema language?
2. What type-theoretic concepts is it unable to represent?
3. What practical implications do the gaps have for schema authors?
4. Suggest specific improvements that would increase the coverage score.`;
}

// ── Pattern 3: Compact summary for context-limited models ──────────

function buildCompactSummary(): string {
	const satisfied: string[] = [];
	const partial: string[] = [];
	const missing: string[] = [];

	for (const criterion of PI_CRITERIA) {
		const cell = scorecard.cells.get(criterion.id);
		const value = cell?.value ?? "\u2717";
		switch (value) {
			case "\u2713":
				satisfied.push(criterion.name);
				break;
			case "partial":
				partial.push(criterion.name);
				break;
			case "\u2717":
				missing.push(criterion.name);
				break;
		}
	}

	return JSON.stringify(
		{
			adapter: scorecard.adapterName,
			score: `${scorecard.totals.satisfied}/${scorecard.totals.satisfied + scorecard.totals.partial + scorecard.totals.notSatisfied}`,
			satisfied,
			partial,
			missing,
		},
		null,
		2,
	);
}

// ── Output ─────────────────────────────────────────────────────────

function main(): void {
	console.log("=== Pattern 1: Tool-Use JSON Payload ===\n");
	console.log(JSON.stringify(buildToolPayload(), null, 2));
	console.log();

	console.log("=== Pattern 2: Chat Prompt ===\n");
	console.log(buildChatPrompt());
	console.log();

	console.log("=== Pattern 3: Compact Summary ===\n");
	console.log(buildCompactSummary());
	console.log();

	console.log("---");
	console.log("These payloads can be sent to any LLM API.");
	console.log("Pattern 1 is best for function-calling / tool-use endpoints.");
	console.log("Pattern 2 is best for chat completion endpoints.");
	console.log("Pattern 3 is best when context window is limited.");
}

main();
