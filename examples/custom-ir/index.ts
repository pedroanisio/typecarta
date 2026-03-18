/**
 * Example: Custom IR Adapter
 *
 * Demonstrates how to define a minimal custom adapter for a
 * hypothetical "CSV Schema" language, then run a scorecard against it.
 *
 * CSV Schema can only express:
 * - Flat product types (rows with named columns)
 * - Base types: string, number, boolean
 * - No nesting, no unions, no recursion
 */

import {
	type IRAdapter,
	type Signature,
	type TypeTerm,
	type WitnessEntry,
	base,
	clearAdapters,
	createSignature,
	evaluateScorecard,
	field,
	product,
	registerAdapter,
	renderMarkdown,
	top,
} from "@typecarta/core";
import { DIVERSE_SCHEMAS, type WitnessSchema } from "@typecarta/witnesses";

// ── CSV Schema native format ───────────────────────────────────────

interface CsvSchemaDocument {
	columns: Array<{
		name: string;
		type: "string" | "number" | "boolean";
	}>;
}

// ── CSV Schema adapter ─────────────────────────────────────────────

const CSV_SIGNATURE: Signature = createSignature(
	["string", "number", "boolean"],
	[{ name: "product", arity: 1 }],
);

class CsvSchemaAdapter implements IRAdapter<Signature, CsvSchemaDocument> {
	readonly name = "CSV Schema";
	readonly signature = CSV_SIGNATURE;

	parse(source: CsvSchemaDocument): TypeTerm {
		const fields = source.columns.map((col) => field(col.name, base(col.type)));
		return product(fields);
	}

	encode(term: TypeTerm): CsvSchemaDocument {
		if (term.kind === "apply" && term.constructor === "product") {
			const columns = (term.fields ?? []).map((f) => {
				if (f.type.kind !== "base") {
					throw new Error(`CSV Schema only supports base types, got: ${f.type.kind}`);
				}
				const typeName = f.type.name;
				if (typeName !== "string" && typeName !== "number" && typeName !== "boolean") {
					throw new Error(`CSV Schema does not support base type: ${typeName}`);
				}
				return { name: f.name, type: typeName };
			});
			return { columns };
		}
		throw new Error(`CSV Schema can only encode product types, got: ${term.kind}`);
	}

	isEncodable(term: TypeTerm): boolean {
		if (term.kind !== "apply" || term.constructor !== "product") return false;
		for (const f of term.fields ?? []) {
			if (f.type.kind !== "base") return false;
			const allowed = new Set(["string", "number", "boolean"]);
			if (!allowed.has(f.type.name)) return false;
		}
		return true;
	}

	inhabits(value: unknown, term: TypeTerm): boolean {
		if (term.kind === "base") {
			switch (term.name) {
				case "string":
					return typeof value === "string";
				case "number":
					return typeof value === "number";
				case "boolean":
					return typeof value === "boolean";
				default:
					return false;
			}
		}
		if (term.kind === "apply" && term.constructor === "product") {
			if (typeof value !== "object" || value === null) return false;
			const obj = value as Record<string, unknown>;
			for (const f of term.fields ?? []) {
				if (!(f.name in obj)) return false;
				if (!this.inhabits(obj[f.name], f.type)) return false;
			}
			return true;
		}
		return false;
	}
}

// ── Run scorecard ──────────────────────────────────────────────────

function main(): void {
	clearAdapters();
	const adapter = new CsvSchemaAdapter();
	registerAdapter(adapter);

	const witnesses: WitnessEntry[] = DIVERSE_SCHEMAS.map((ws: WitnessSchema) => ({
		criterionId: ws.id,
		schema: ws.schema,
		name: ws.name,
	}));

	console.log("=== Custom IR: CSV Schema ===\n");
	console.log("CSV Schema supports only flat product types with string/number/boolean columns.");
	console.log("This demonstrates how a very limited IR scores against the full criterion set.\n");

	const scorecard = evaluateScorecard(adapter, witnesses);

	console.log(renderMarkdown(scorecard));
	console.log();

	// Highlight what this IR cannot express
	const total =
		scorecard.totals.satisfied + scorecard.totals.partial + scorecard.totals.notSatisfied;
	console.log("=== Expressiveness Gap ===");
	console.log(`Criteria satisfied: ${scorecard.totals.satisfied}/${total}`);
	console.log(`Criteria partial:   ${scorecard.totals.partial}/${total}`);
	console.log(`Criteria missing:   ${scorecard.totals.notSatisfied}/${total}`);
	console.log();
	console.log("A CSV Schema IR cannot express unions, recursion, refinements, parametric types,");
	console.log("nominal distinctions, or any advanced type constructs. This is expected for a");
	console.log("tabular data format.");
}

main();
