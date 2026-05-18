/**
 * Benchmark: Aggregate encoding faithfulness metrics across all adapters.
 *
 * For each adapter, evaluates soundness, completeness, and faithfulness
 * on a fixed test corpus using `checkSoundness` / `checkCompleteness`
 * / `checkFaithfulness`. Reports per-adapter aggregate verdicts plus a
 * comparison table.
 *
 * Skip policy (chosen 2026-05-18):
 *   - Per-term: if the adapter cannot encode a term, the term is
 *     omitted from that adapter's aggregate and a `skip` is printed in
 *     the per-term column. The aggregate is computed only over the
 *     terms the adapter accepted.
 *   - Per-adapter: a whole-adapter throw is caught and surfaced as
 *     `ERROR` in the comparison table.
 */

import type { ExtensionEvaluator, IRAdapter, TypeTerm } from "@typecarta/core";
import {
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
import { buildAllAdapters } from "../adapters.js";

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
	{ name: "union-string-number", term: union([base("string"), base("number")]) },
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
	{ name: "refined-range", term: refinement(base("number"), rangeConstraint(0, 100)) },
	{ name: "refined-pattern", term: refinement(base("string"), patternConstraint("^[a-z]+$")) },
];

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

interface PerTermVerdict {
	readonly term: string;
	readonly sound: "yes" | "no" | "skip";
	readonly complete: "yes" | "no" | "skip";
	readonly faithful: "yes" | "no" | "skip";
}

interface AdapterFidelity {
	readonly adapter: string;
	readonly perTerm: readonly PerTermVerdict[];
	readonly accepted: number;
	readonly skipped: number;
	readonly soundOk: number;
	readonly completeOk: number;
	readonly faithfulOk: number;
	readonly elapsedMs: number;
	readonly error?: string;
}

function benchmarkAdapter(adapter: IRAdapter): AdapterFidelity {
	try {
		const encoding = createEncoding("source", adapter.name, (term: TypeTerm) => {
			if (!adapter.isEncodable(term)) return term;
			try {
				const encoded = adapter.encode(term);
				return adapter.parse(encoded);
			} catch {
				return term;
			}
		});

		const evaluator: ExtensionEvaluator = createEvaluator((term) => ({
			contains(value: unknown): boolean {
				return adapter.inhabits(value, term);
			},
		}));

		const perTerm: PerTermVerdict[] = [];
		let accepted = 0;
		let skipped = 0;
		let soundOk = 0;
		let completeOk = 0;
		let faithfulOk = 0;

		const start = performance.now();
		for (const { name, term } of TEST_TERMS) {
			if (!adapter.isEncodable(term)) {
				perTerm.push({ term: name, sound: "skip", complete: "skip", faithful: "skip" });
				skipped++;
				continue;
			}
			try {
				const soundResult = checkSoundness(encoding, evaluator, evaluator, [term], TEST_VALUES);
				const compResult = checkCompleteness(encoding, evaluator, evaluator, [term], TEST_VALUES);
				const isFaithful = soundResult.isSound && compResult.isComplete;
				perTerm.push({
					term: name,
					sound: soundResult.isSound ? "yes" : "no",
					complete: compResult.isComplete ? "yes" : "no",
					faithful: isFaithful ? "yes" : "no",
				});
				accepted++;
				if (soundResult.isSound) soundOk++;
				if (compResult.isComplete) completeOk++;
				if (isFaithful) faithfulOk++;
			} catch {
				perTerm.push({ term: name, sound: "skip", complete: "skip", faithful: "skip" });
				skipped++;
			}
		}
		const elapsedMs = performance.now() - start;

		return {
			adapter: adapter.name,
			perTerm,
			accepted,
			skipped,
			soundOk,
			completeOk,
			faithfulOk,
			elapsedMs,
		};
	} catch (err) {
		return {
			adapter: adapter.name,
			perTerm: [],
			accepted: 0,
			skipped: TEST_TERMS.length,
			soundOk: 0,
			completeOk: 0,
			faithfulOk: 0,
			elapsedMs: 0,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

function printPerAdapter(result: AdapterFidelity): void {
	if (result.error !== undefined) {
		console.log(`  ERROR: ${result.error}`);
		console.log();
		return;
	}

	console.log(
		"Term".padEnd(24) + "Sound".padStart(7) + "Complete".padStart(10) + "Faithful".padStart(10),
	);
	console.log("-".repeat(51));
	for (const v of result.perTerm) {
		console.log(
			v.term.padEnd(24) +
				v.sound.padStart(7) +
				v.complete.padStart(10) +
				v.faithful.padStart(10),
		);
	}

	console.log();
	console.log("Aggregate (over accepted terms):");
	const total = result.accepted + result.skipped;
	console.log(`  Accepted:     ${result.accepted}/${total} (${result.skipped} skipped)`);
	if (result.accepted > 0) {
		console.log(
			`  Soundness:    ${result.soundOk}/${result.accepted} (${pct(result.soundOk, result.accepted)})`,
		);
		console.log(
			`  Completeness: ${result.completeOk}/${result.accepted} (${pct(result.completeOk, result.accepted)})`,
		);
		console.log(
			`  Faithfulness: ${result.faithfulOk}/${result.accepted} (${pct(result.faithfulOk, result.accepted)})`,
		);
	}
	console.log(`  Time:         ${result.elapsedMs.toFixed(2)} ms`);
	console.log();
}

function pct(numerator: number, denominator: number): string {
	return denominator === 0 ? "n/a" : `${((numerator / denominator) * 100).toFixed(0)}%`;
}

function printComparison(results: readonly AdapterFidelity[]): void {
	const ok = results.filter((r) => r.error === undefined);
	if (ok.length === 0) return;

	const sorted = [...ok].sort((a, b) => b.faithfulOk - a.faithfulOk);

	console.log("=== Comparison (sorted by Faithful count, highest first) ===");
	console.log();
	const adapterWidth = Math.max(8, ...ok.map((r) => r.adapter.length));
	console.log(
		"Adapter".padEnd(adapterWidth) +
			"Accepted".padStart(10) +
			"Sound".padStart(8) +
			"Complete".padStart(10) +
			"Faithful".padStart(10) +
			"Time (ms)".padStart(12),
	);
	console.log("-".repeat(adapterWidth + 10 + 8 + 10 + 10 + 12));
	for (const r of sorted) {
		const total = r.accepted + r.skipped;
		console.log(
			r.adapter.padEnd(adapterWidth) +
				`${r.accepted}/${total}`.padStart(10) +
				`${r.soundOk}`.padStart(8) +
				`${r.completeOk}`.padStart(10) +
				`${r.faithfulOk}`.padStart(10) +
				r.elapsedMs.toFixed(2).padStart(12),
		);
	}

	const errored = results.filter((r) => r.error !== undefined);
	if (errored.length > 0) {
		console.log();
		console.log(`Errored: ${errored.map((r) => r.adapter).join(", ")}`);
	}
}

function main(): void {
	const adapters = buildAllAdapters();

	console.log("=== Encoding Fidelity Benchmark — All Adapters ===");
	console.log(`Test terms:  ${TEST_TERMS.length}`);
	console.log(`Test values: ${TEST_VALUES.length}`);
	console.log(`Adapters:    ${adapters.length}`);
	console.log();

	const results: AdapterFidelity[] = [];
	for (const adapter of adapters) {
		console.log(`--- ${adapter.name} (spec ${adapter.specVersion ?? "n/a"}) ---`);
		const r = benchmarkAdapter(adapter);
		results.push(r);
		printPerAdapter(r);
	}

	printComparison(results);
}

main();
