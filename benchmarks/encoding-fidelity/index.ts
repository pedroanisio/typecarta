/**
 * Benchmark: Aggregate encoding faithfulness metrics
 *
 * Evaluates encoding soundness and completeness across a set of test terms
 * using the JSON Schema adapter, and reports aggregate stats.
 */

import { JsonSchemaAdapter } from "@typecarta/adapter-json-schema";
import {
	type ExtensionEvaluator,
	type TypeTerm,
	array,
	base,
	bottom,
	checkCompleteness,
	checkFaithfulness,
	checkSoundness,
	createEncoding,
	createEvaluator,
	field,
	intersection,
	literal,
	patternConstraint,
	product,
	rangeConstraint,
	refinement,
	top,
	union,
} from "@typecarta/core";

// ── Test terms ─────────────────────────────────────────────────────
const TEST_TERMS: { name: string; term: TypeTerm }[] = [
	{ name: "bottom", term: bottom() },
	{ name: "top", term: top() },
	{ name: "string", term: base("string") },
	{ name: "number", term: base("number") },
	{ name: "boolean", term: base("boolean") },
	{ name: "null", term: base("null") },
	{ name: "literal-42", term: literal(42) },
	{ name: "literal-hello", term: literal("hello") },
	{
		name: "product-person",
		term: product([field("name", base("string")), field("age", base("number"))]),
	},
	{
		name: "union-string-number",
		term: union([base("string"), base("number")]),
	},
	{
		name: "intersection-obj",
		term: intersection([
			product([field("a", base("string"))]),
			product([field("b", base("number"))]),
		]),
	},
	{ name: "array-string", term: array(base("string")) },
	{
		name: "nested-array",
		term: array(product([field("id", base("number")), field("tags", array(base("string")))])),
	},
	{
		name: "refined-range",
		term: refinement(base("number"), rangeConstraint(0, 100)),
	},
	{
		name: "refined-pattern",
		term: refinement(base("string"), patternConstraint("^[a-z]+$")),
	},
];

// ── Test values for sampling ───────────────────────────────────────
const TEST_VALUES: unknown[] = [
	null,
	true,
	false,
	0,
	1,
	42,
	-1,
	3.14,
	100,
	101,
	"",
	"hello",
	"abc",
	"ABC",
	"123",
	[],
	[1, 2, 3],
	["a", "b"],
	{},
	{ name: "Alice", age: 30 },
	{ a: "x" },
	{ b: 1 },
	{ a: "x", b: 1 },
	{ id: 1, tags: ["foo"] },
	[{ id: 1, tags: ["foo"] }],
];

// ── Main ───────────────────────────────────────────────────────────
function main(): void {
	const adapter = new JsonSchemaAdapter();

	// Create encoding: identity through JSON Schema round-trip
	const encoding = createEncoding("source", adapter.name, (term: TypeTerm) => {
		if (!adapter.isEncodable(term)) return term;
		try {
			const encoded = adapter.encode(term);
			return adapter.parse(encoded);
		} catch {
			return term;
		}
	});

	// Create evaluators using the adapter's inhabits function
	const evaluator: ExtensionEvaluator = createEvaluator((term) => ({
		contains(value: unknown): boolean {
			return adapter.inhabits(value, term);
		},
	}));

	const terms = TEST_TERMS.map((t) => t.term);

	console.log("=== Encoding Fidelity Benchmark ===");
	console.log(`Adapter:     ${adapter.name}`);
	console.log(`Test terms:  ${TEST_TERMS.length}`);
	console.log(`Test values: ${TEST_VALUES.length}`);
	console.log();

	// Run faithfulness check
	const start = performance.now();
	const faithfulness = checkFaithfulness(encoding, evaluator, evaluator, terms, TEST_VALUES);
	const elapsed = performance.now() - start;

	// Per-term results
	console.log("Per-term results:");
	console.log(
		"Term".padEnd(24) + "Sound".padStart(7) + "Complete".padStart(10) + "Faithful".padStart(10),
	);
	console.log("-".repeat(51));

	for (const { name, term } of TEST_TERMS) {
		const soundResult = checkSoundness(encoding, evaluator, evaluator, [term], TEST_VALUES);
		const compResult = checkCompleteness(encoding, evaluator, evaluator, [term], TEST_VALUES);
		const isFaithful = soundResult.isSound && compResult.isComplete;

		console.log(
			name.padEnd(24) +
				(soundResult.isSound ? "yes" : "NO").padStart(7) +
				(compResult.isComplete ? "yes" : "NO").padStart(10) +
				(isFaithful ? "yes" : "NO").padStart(10),
		);
	}

	console.log();
	console.log("Aggregate:");
	console.log(
		`  Soundness:    ${faithfulness.soundness.isSound ? "PASS" : "FAIL"} (${faithfulness.soundness.violations.length} violations)`,
	);
	console.log(
		`  Completeness: ${faithfulness.completeness.isComplete ? "PASS" : "FAIL"} (${faithfulness.completeness.violations.length} violations)`,
	);
	console.log(`  Faithfulness: ${faithfulness.isFaithful ? "PASS" : "FAIL"}`);
	console.log(`  Time:         ${elapsed.toFixed(2)} ms`);
}

main();
