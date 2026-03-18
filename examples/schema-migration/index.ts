/**
 * Example: Schema Migration with Loss Report
 *
 * Demonstrates what criteria are lost when migrating from one schema
 * language to another. Compares JSON Schema against a hypothetical
 * "Flat Schema" format that lacks recursion, parametric types, and
 * nominal distinctions.
 */

import { JsonSchemaAdapter } from "@typecarta/adapter-json-schema";
import {
	type IRAdapter,
	type Signature,
	type TypeTerm,
	type WitnessEntry,
	array,
	base,
	clearAdapters,
	compareScorecards,
	createSignature,
	evaluateScorecard,
	field,
	product,
	registerAdapter,
	renderComparisonMarkdown,
	top,
	union,
} from "@typecarta/core";
import { DIVERSE_SCHEMAS, type WitnessSchema } from "@typecarta/witnesses";

// ── "Flat Schema" adapter ──────────────────────────────────────────
// A minimal adapter that only supports flat product types, unions of
// base types, and arrays. No recursion, no parametric polymorphism,
// no nominal types.

const FLAT_SIGNATURE: Signature = createSignature(
	["string", "number", "boolean", "null"],
	[
		{ name: "product", arity: 1 },
		{ name: "union", arity: 2 },
		{ name: "array", arity: 1 },
	],
);

const flatAdapter: IRAdapter = {
	name: "Flat Schema (subset)",
	signature: FLAT_SIGNATURE,

	parse(source: unknown): TypeTerm {
		// Simplified: only handle basic flat structures
		const s = source as Record<string, unknown>;
		if (s.type === "object" && s.properties) {
			const props = s.properties as Record<string, Record<string, unknown>>;
			const fields = Object.entries(props).map(([name, prop]) => {
				const t = typeof prop.type === "string" ? base(prop.type) : top();
				return field(name, t);
			});
			return product(fields);
		}
		if (s.type === "array") return array(top());
		if (typeof s.type === "string") return base(s.type);
		return top();
	},

	encode(term: TypeTerm): unknown {
		switch (term.kind) {
			case "base":
				return { type: term.name };
			case "apply":
				if (term.constructor === "product") {
					const properties: Record<string, unknown> = {};
					for (const f of term.fields ?? []) {
						properties[f.name] = this.encode(f.type);
					}
					return { type: "object", properties };
				}
				if (term.constructor === "array") {
					return { type: "array" };
				}
				if (term.constructor === "union") {
					return { anyOf: term.args.map((a) => this.encode(a)) };
				}
				throw new Error(`Flat Schema cannot encode constructor: ${term.constructor}`);
			case "top":
				return {};
			case "bottom":
			case "literal":
				return { type: "string" }; // lossy fallback
			default:
				throw new Error(`Flat Schema cannot encode: ${term.kind}`);
		}
	},

	isEncodable(term: TypeTerm): boolean {
		// Flat schema cannot encode recursive, parametric, nominal, or refined types
		const unsupported = new Set([
			"mu",
			"forall",
			"var",
			"nominal",
			"refinement",
			"complement",
			"keyOf",
			"conditional",
			"mapped",
			"rowPoly",
			"letBinding",
			"extension",
		]);
		if (unsupported.has(term.kind)) return false;
		if (term.kind === "apply") {
			// Only product, union, array
			const supported = new Set(["product", "union", "array"]);
			if (!supported.has(term.constructor)) return false;
		}
		return true;
	},

	inhabits(value: unknown, term: TypeTerm): boolean {
		if (term.kind === "top") return true;
		if (term.kind === "base") {
			switch (term.name) {
				case "string":
					return typeof value === "string";
				case "number":
					return typeof value === "number";
				case "boolean":
					return typeof value === "boolean";
				case "null":
					return value === null;
				default:
					return false;
			}
		}
		return false;
	},
};

// ── Compare ────────────────────────────────────────────────────────

function main(): void {
	const witnesses: WitnessEntry[] = DIVERSE_SCHEMAS.map((ws: WitnessSchema) => ({
		criterionId: ws.id,
		schema: ws.schema,
		name: ws.name,
	}));

	clearAdapters();
	const jsonSchema = new JsonSchemaAdapter();
	registerAdapter(jsonSchema);
	registerAdapter(flatAdapter);

	console.log("Evaluating both adapters...\n");

	const jsonScorecard = evaluateScorecard(jsonSchema, witnesses);
	const flatScorecard = evaluateScorecard(flatAdapter, witnesses);
	const comparison = compareScorecards(jsonScorecard, flatScorecard);

	// Markdown comparison table
	console.log(renderComparisonMarkdown(comparison));
	console.log();

	// Loss report
	console.log("=== Migration Loss Report ===\n");

	if (comparison.differences.length === 0) {
		console.log("No criteria differences detected.");
	} else {
		console.log(
			`${comparison.differences.length} criterion difference(s) when migrating from ${jsonSchema.name} to ${flatAdapter.name}:\n`,
		);

		for (const diff of comparison.differences) {
			const direction =
				diff.leftValue === "\u2713" && diff.rightValue === "\u2717"
					? "LOST"
					: diff.leftValue === "\u2717" && diff.rightValue === "\u2713"
						? "GAINED"
						: "CHANGED";
			console.log(`  [${direction}] ${diff.criterionId}: ${diff.leftValue} -> ${diff.rightValue}`);
		}

		const losses = comparison.differences.filter(
			(d) => d.leftValue === "\u2713" && (d.rightValue === "partial" || d.rightValue === "\u2717"),
		);
		console.log(`\nTotal criteria lost or degraded: ${losses.length}`);
	}
}

main();
