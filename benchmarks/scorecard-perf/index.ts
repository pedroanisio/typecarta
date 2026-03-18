/**
 * Benchmark: Wall-clock scorecard evaluation
 *
 * Measures the time to evaluate a scorecard for the JSON Schema adapter
 * across all 15 base criteria. Runs multiple iterations and reports
 * mean and standard deviation.
 */

import {
	type IRAdapter,
	PI_CRITERIA,
	type Signature,
	type TypeTerm,
	array,
	base,
	bottom,
	clearAdapters,
	createSignature,
	evaluateScorecard,
	field,
	product,
	registerAdapter,
	top,
	union,
} from "@typecarta/core";
import type { WitnessEntry } from "@typecarta/core";
import { DIVERSE_SCHEMAS, type WitnessSchema } from "@typecarta/witnesses";

// ── Configuration ──────────────────────────────────────────────────
const ITERATIONS = 50;
const WARMUP_ITERATIONS = 5;

// ── Convert WitnessSchema[] to WitnessEntry[] ─────────────────────
function toWitnessEntries(schemas: readonly WitnessSchema[]): WitnessEntry[] {
	return schemas.map((s) => ({
		criterionId: s.id,
		schema: s.schema,
		name: s.name,
	}));
}

// ── Mock adapter for benchmarking ──────────────────────────────────
const MOCK_SIGNATURE: Signature = createSignature(
	["string", "number", "boolean", "null"],
	[
		{ name: "product", arity: 1 },
		{ name: "array", arity: 1 },
		{ name: "union", arity: 2 },
	],
);

const mockAdapter: IRAdapter = {
	name: "Mock Adapter (benchmark)",
	signature: MOCK_SIGNATURE,

	parse(_source: unknown): TypeTerm {
		return top();
	},

	encode(term: TypeTerm): unknown {
		return { encoded: term.kind };
	},

	isEncodable(_term: TypeTerm): boolean {
		return true;
	},

	inhabits(_value: unknown, _term: TypeTerm): boolean {
		return true;
	},
};

// ── Benchmark runner ───────────────────────────────────────────────
function runBenchmark(): void {
	const witnesses = toWitnessEntries(DIVERSE_SCHEMAS);

	console.log("=== Scorecard Performance Benchmark ===");
	console.log(`Criteria count: ${PI_CRITERIA.length}`);
	console.log(`Witness count:  ${witnesses.length}`);
	console.log(`Iterations:     ${ITERATIONS} (+ ${WARMUP_ITERATIONS} warmup)`);
	console.log();

	// Warmup
	for (let i = 0; i < WARMUP_ITERATIONS; i++) {
		evaluateScorecard(mockAdapter, witnesses);
	}

	// Timed runs
	const timings: number[] = [];
	for (let i = 0; i < ITERATIONS; i++) {
		const start = performance.now();
		evaluateScorecard(mockAdapter, witnesses);
		const elapsed = performance.now() - start;
		timings.push(elapsed);
	}

	// Statistics
	const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
	const variance = timings.reduce((sum, t) => sum + (t - mean) ** 2, 0) / timings.length;
	const stddev = Math.sqrt(variance);
	const min = Math.min(...timings);
	const max = Math.max(...timings);
	const sorted = [...timings].sort((a, b) => a - b);
	const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
	const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
	const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

	console.log("Results:");
	console.log(`  Mean:   ${mean.toFixed(3)} ms`);
	console.log(`  StdDev: ${stddev.toFixed(3)} ms`);
	console.log(`  Min:    ${min.toFixed(3)} ms`);
	console.log(`  Max:    ${max.toFixed(3)} ms`);
	console.log(`  p50:    ${p50.toFixed(3)} ms`);
	console.log(`  p95:    ${p95.toFixed(3)} ms`);
	console.log(`  p99:    ${p99.toFixed(3)} ms`);
	console.log();
	console.log(`Throughput: ~${(1000 / mean).toFixed(1)} scorecards/sec`);
}

runBenchmark();
