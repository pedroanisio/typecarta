/**
 * Benchmark: Criterion coverage per adapter across all adapters.
 *
 * For each registered adapter, runs `evaluateScorecard` against the full
 * 70-criterion set with the full witness corpus, then aggregates per-family
 * by the cell taxonomy that the scorecard layer produces: ✓ (satisfied),
 * ◐ (partial), ✗ (not satisfied), n/a (adapter does not model the IR kind
 * the witness uses).
 *
 * History: an earlier version of this benchmark called
 * `criterion.evaluate(roundTripped)` directly and counted ✗ if the result
 * status wasn't `satisfied`. That bypassed `evaluateScorecard` and
 * collapsed three distinct cell values — ◐ (round-trip-lost-info), ✗
 * (real language gap), n/a (adapter-hole) — into a single "Fail" column.
 * The Partial column was therefore always zero, hiding exactly the
 * regression class that audits depend on. Surfaced by the bench:fidelity
 * reviewer (2026-05-18).
 *
 * Skip policy: a whole-adapter throw is caught and surfaced in the
 * comparison table as `ERROR`. Per-witness encode/parse failures are
 * already handled by `evaluateScorecard` (they become ✗ or ◐ cells with
 * a justification).
 */

import {
	CRITERIA,
	type CriterionFamily,
	type IRAdapter,
	type ScorecardResult,
	type WitnessEntry,
	evaluateScorecard,
} from "@typecarta/core";
import { ALL_WITNESSES, type WitnessSchema } from "@typecarta/witnesses";
import { buildAllAdapters } from "../adapters.js";

interface FamilyCoverage {
	family: CriterionFamily;
	total: number;
	satisfied: number;
	partial: number;
	notSatisfied: number;
	outOfVocabulary: number;
	coveragePercent: number;
}

interface AdapterCoverage {
	adapter: string;
	families: readonly FamilyCoverage[];
	totalCriteria: number;
	totalSatisfied: number;
	totalPartial: number;
	totalNotSatisfied: number;
	totalOutOfVocabulary: number;
	error?: string;
}

/**
 * Run the scorecard against the full criterion set and bucket cells by
 * their family. The cell `value` taxonomy survives intact.
 */
function evaluateCoverage(
	adapter: IRAdapter,
	witnesses: readonly WitnessSchema[],
): FamilyCoverage[] {
	const witnessEntries: WitnessEntry[] = witnesses.map((w) => ({
		criterionId: w.id,
		schema: w.schema,
		name: w.name,
	}));
	const scorecard: ScorecardResult = evaluateScorecard(adapter, witnessEntries, CRITERIA);

	const familyOf = new Map<string, CriterionFamily>(CRITERIA.map((c) => [c.id, c.family]));

	const byFamily = new Map<CriterionFamily, FamilyCoverage>();
	for (const criterion of CRITERIA) {
		if (!byFamily.has(criterion.family)) {
			byFamily.set(criterion.family, {
				family: criterion.family,
				total: 0,
				satisfied: 0,
				partial: 0,
				notSatisfied: 0,
				outOfVocabulary: 0,
				coveragePercent: 0,
			});
		}
		const entry = byFamily.get(criterion.family)!;
		// FamilyCoverage is readonly in interface form, but we're building
		// it; cast through unknown to mutate during accumulation.
		(entry as { total: number }).total++;
	}

	for (const [id, cell] of scorecard.cells) {
		const family = familyOf.get(id);
		if (!family) continue;
		const entry = byFamily.get(family);
		if (!entry) continue;
		switch (cell.value) {
			case "✓":
				(entry as { satisfied: number }).satisfied++;
				break;
			case "partial":
				(entry as { partial: number }).partial++;
				break;
			case "✗":
				(entry as { notSatisfied: number }).notSatisfied++;
				break;
			case "n/a":
				(entry as { outOfVocabulary: number }).outOfVocabulary++;
				break;
		}
	}

	const coverages: FamilyCoverage[] = [];
	for (const f of byFamily.values()) {
		const cov: FamilyCoverage = {
			...f,
			coveragePercent: f.total > 0 ? (f.satisfied / f.total) * 100 : 0,
		};
		coverages.push(cov);
	}
	coverages.sort((a, b) => a.family.localeCompare(b.family));
	return coverages;
}

function benchmarkAdapter(
	adapter: IRAdapter,
	witnesses: readonly WitnessSchema[],
): AdapterCoverage {
	try {
		const families = evaluateCoverage(adapter, witnesses);
		const totalCriteria = families.reduce((sum, f) => sum + f.total, 0);
		const totalSatisfied = families.reduce((sum, f) => sum + f.satisfied, 0);
		const totalPartial = families.reduce((sum, f) => sum + f.partial, 0);
		const totalNotSatisfied = families.reduce((sum, f) => sum + f.notSatisfied, 0);
		const totalOutOfVocabulary = families.reduce((sum, f) => sum + f.outOfVocabulary, 0);
		return {
			adapter: adapter.name,
			families,
			totalCriteria,
			totalSatisfied,
			totalPartial,
			totalNotSatisfied,
			totalOutOfVocabulary,
		};
	} catch (err) {
		return {
			adapter: adapter.name,
			families: [],
			totalCriteria: 0,
			totalSatisfied: 0,
			totalPartial: 0,
			totalNotSatisfied: 0,
			totalOutOfVocabulary: 0,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

function printPerAdapter(cov: AdapterCoverage): void {
	if (cov.error !== undefined) {
		console.log(`  ERROR: ${cov.error}`);
		console.log();
		return;
	}

	console.log(
		"Family".padEnd(8) +
			"Total".padStart(6) +
			"Pass".padStart(6) +
			"Partial".padStart(8) +
			"Fail".padStart(6) +
			"N/A".padStart(6) +
			"Coverage".padStart(10),
	);
	console.log("-".repeat(50));

	for (const f of cov.families) {
		console.log(
			`  ${f.family}`.padEnd(8) +
				`${f.total}`.padStart(6) +
				`${f.satisfied}`.padStart(6) +
				`${f.partial}`.padStart(8) +
				`${f.notSatisfied}`.padStart(6) +
				`${f.outOfVocabulary}`.padStart(6) +
				`${f.coveragePercent.toFixed(1)}%`.padStart(10),
		);
	}

	console.log("-".repeat(50));
	const overall = cov.totalCriteria > 0 ? (cov.totalSatisfied / cov.totalCriteria) * 100 : 0;
	console.log(
		"Total".padEnd(8) +
			`${cov.totalCriteria}`.padStart(6) +
			`${cov.totalSatisfied}`.padStart(6) +
			`${cov.totalPartial}`.padStart(8) +
			`${cov.totalNotSatisfied}`.padStart(6) +
			`${cov.totalOutOfVocabulary}`.padStart(6) +
			`${overall.toFixed(1)}%`.padStart(10),
	);
	console.log();
}

function printComparison(coverages: readonly AdapterCoverage[]): void {
	const ok = coverages.filter((c) => c.error === undefined);
	if (ok.length === 0) return;

	const sorted = [...ok].sort((a, b) => b.totalSatisfied - a.totalSatisfied);

	console.log("=== Comparison (sorted by Pass count, highest first) ===");
	console.log();
	const adapterWidth = Math.max(8, ...ok.map((c) => c.adapter.length));
	console.log(
		"Adapter".padEnd(adapterWidth) +
			"Pass".padStart(8) +
			"Partial".padStart(10) +
			"Fail".padStart(8) +
			"N/A".padStart(8) +
			"Coverage".padStart(12),
	);
	console.log("-".repeat(adapterWidth + 8 + 10 + 8 + 8 + 12));
	for (const c of sorted) {
		const pct = c.totalCriteria > 0 ? (c.totalSatisfied / c.totalCriteria) * 100 : 0;
		console.log(
			c.adapter.padEnd(adapterWidth) +
				`${c.totalSatisfied}/${c.totalCriteria}`.padStart(8) +
				`${c.totalPartial}`.padStart(10) +
				`${c.totalNotSatisfied}`.padStart(8) +
				`${c.totalOutOfVocabulary}`.padStart(8) +
				`${pct.toFixed(1)}%`.padStart(12),
		);
	}

	const errored = coverages.filter((c) => c.error !== undefined);
	if (errored.length > 0) {
		console.log();
		console.log(`Errored: ${errored.map((c) => c.adapter).join(", ")}`);
	}
}

function main(): void {
	const adapters = buildAllAdapters();

	console.log("=== Criterion Coverage Benchmark — All Adapters ===");
	console.log(`Total criteria: ${CRITERIA.length}`);
	console.log(`Witnesses:      ${ALL_WITNESSES.length}`);
	console.log(`Adapters:       ${adapters.length}`);
	console.log();
	console.log("Columns:");
	console.log("  Pass     — round-trip + criterion predicate both satisfied (✓)");
	console.log("  Partial  — encoding exists but round-trip is lossy (◐)");
	console.log("  Fail     — IR kind in vocabulary but encoding fails (✗ — real language gap)");
	console.log("  N/A      — adapter does not model the IR kind (·  — adapter hole)");
	console.log();

	const results: AdapterCoverage[] = [];
	for (const adapter of adapters) {
		console.log(`--- ${adapter.name} (spec ${adapter.specVersion ?? "n/a"}) ---`);
		const r = benchmarkAdapter(adapter, ALL_WITNESSES);
		results.push(r);
		printPerAdapter(r);
	}

	printComparison(results);
}

main();
