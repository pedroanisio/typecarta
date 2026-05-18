/**
 * Benchmark: Wall-clock scorecard evaluation across all adapters.
 *
 * For each registered adapter, measures the time to evaluate the
 * 15-criterion core scorecard against the witness corpus. Reports
 * per-adapter percentiles plus a comparison summary sorted by mean.
 *
 * Skip policy: if an adapter throws while evaluating the warmup
 * (`evaluateScorecard` is engineered not to throw, so this is
 * defensive), the adapter is reported as `error` and skipped from the
 * comparison table.
 */

import { CORE_CRITERIA, evaluateScorecard } from "@typecarta/core";
import type { IRAdapter, WitnessEntry } from "@typecarta/core";
import { CORE_SCHEMAS, type CoreWitnessSchema } from "@typecarta/witnesses";
import { buildAllAdapters } from "../adapters.js";

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

interface BenchResult {
	readonly adapter: string;
	readonly mean: number;
	readonly stddev: number;
	readonly min: number;
	readonly max: number;
	readonly p50: number;
	readonly p95: number;
	readonly p99: number;
	readonly throughput: number;
	readonly error?: string;
}

function benchmarkAdapter(adapter: IRAdapter, witnesses: WitnessEntry[]): BenchResult {
	try {
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

		const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
		const variance = timings.reduce((sum, t) => sum + (t - mean) ** 2, 0) / timings.length;
		const stddev = Math.sqrt(variance);
		const min = Math.min(...timings);
		const max = Math.max(...timings);
		const sorted = [...timings].sort((a, b) => a - b);
		const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
		const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
		const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

		return {
			adapter: adapter.name,
			mean,
			stddev,
			min,
			max,
			p50,
			p95,
			p99,
			throughput: 1000 / mean,
		};
	} catch (err) {
		return {
			adapter: adapter.name,
			mean: Number.NaN,
			stddev: Number.NaN,
			min: Number.NaN,
			max: Number.NaN,
			p50: Number.NaN,
			p95: Number.NaN,
			p99: Number.NaN,
			throughput: Number.NaN,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

function printPerAdapter(result: BenchResult): void {
	if (result.error !== undefined) {
		console.log(`  ERROR: ${result.error}`);
		console.log();
		return;
	}
	console.log(`  Mean:       ${result.mean.toFixed(3)} ms`);
	console.log(`  StdDev:     ${result.stddev.toFixed(3)} ms`);
	console.log(`  Min/Max:    ${result.min.toFixed(3)} / ${result.max.toFixed(3)} ms`);
	console.log(`  p50/p95/p99: ${result.p50.toFixed(3)} / ${result.p95.toFixed(3)} / ${result.p99.toFixed(3)} ms`);
	console.log(`  Throughput: ~${result.throughput.toFixed(0)} scorecards/sec`);
	console.log();
}

function printComparison(results: readonly BenchResult[]): void {
	const ok = results.filter((r) => r.error === undefined);
	if (ok.length === 0) return;

	const sorted = [...ok].sort((a, b) => a.mean - b.mean);
	const fastest = sorted[0]!;

	console.log("=== Comparison (sorted by mean, fastest first) ===");
	console.log();
	const adapterWidth = Math.max(8, ...ok.map((r) => r.adapter.length));
	console.log(
		"Adapter".padEnd(adapterWidth) +
			"Mean (ms)".padStart(12) +
			"p95 (ms)".padStart(12) +
			"Throughput".padStart(14) +
			"vs fastest".padStart(12),
	);
	console.log("-".repeat(adapterWidth + 12 + 12 + 14 + 12));
	for (const r of sorted) {
		const ratio = r.mean / fastest.mean;
		console.log(
			r.adapter.padEnd(adapterWidth) +
				r.mean.toFixed(3).padStart(12) +
				r.p95.toFixed(3).padStart(12) +
				`${r.throughput.toFixed(0)}/s`.padStart(14) +
				`${ratio.toFixed(2)}x`.padStart(12),
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
	const witnesses = toWitnessEntries(CORE_SCHEMAS);

	console.log("=== Scorecard Performance Benchmark — All Adapters ===");
	console.log(`Criteria count: ${CORE_CRITERIA.length} (core subset)`);
	console.log(`Witness count:  ${witnesses.length}`);
	console.log(`Iterations:     ${ITERATIONS} (+ ${WARMUP_ITERATIONS} warmup) per adapter`);
	console.log(`Adapters:       ${adapters.length}`);
	console.log();

	const results: BenchResult[] = [];
	for (const adapter of adapters) {
		console.log(`--- ${adapter.name} (spec ${adapter.specVersion ?? "n/a"}) ---`);
		const r = benchmarkAdapter(adapter, witnesses);
		results.push(r);
		printPerAdapter(r);
	}

	printComparison(results);
}

main();
