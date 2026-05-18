/**
 * Benchmark: Wall-clock scorecard evaluation
 *
 * Measures the time to evaluate a scorecard for the JSON Schema adapter
 * across the 15 core criteria and the fixed witness corpus.
 */

import { JsonSchemaAdapter } from "@typecarta/adapter-json-schema";
import { CORE_CRITERIA, evaluateScorecard } from "@typecarta/core";
import type { WitnessEntry } from "@typecarta/core";
import { CORE_SCHEMAS, type CoreWitnessSchema } from "@typecarta/witnesses";

// ── Configuration ──────────────────────────────────────────────────
const ITERATIONS = 50;
const WARMUP_ITERATIONS = 5;

// ── Convert CoreWitnessSchema[] to WitnessEntry[] ─────────────────
function toWitnessEntries(schemas: readonly CoreWitnessSchema[]): WitnessEntry[] {
	return schemas.map((s) => ({
		criterionId: s.id,
		schema: s.schema,
		name: s.name,
	}));
}

// ── Benchmark runner ───────────────────────────────────────────────
function runBenchmark(): void {
	const adapter = new JsonSchemaAdapter();
	const witnesses = toWitnessEntries(CORE_SCHEMAS);

	console.log("=== Scorecard Performance Benchmark ===");
	console.log(`Adapter:        ${adapter.name}`);
	console.log(`Criteria count: ${CORE_CRITERIA.length}`);
	console.log(`Witness count:  ${witnesses.length}`);
	console.log(`Iterations:     ${ITERATIONS} (+ ${WARMUP_ITERATIONS} warmup)`);
	console.log();

	// Warmup
	for (let i = 0; i < WARMUP_ITERATIONS; i++) {
		evaluateScorecard(adapter, witnesses);
	}

	// Timed runs
	const timings: number[] = [];
	for (let i = 0; i < ITERATIONS; i++) {
		const start = performance.now();
		evaluateScorecard(adapter, witnesses);
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
