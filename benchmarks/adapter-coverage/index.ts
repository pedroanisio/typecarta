/**
 * Benchmark: Criterion coverage per adapter across all adapters.
 *
 * For each registered adapter, runs all 70 CRITERIA against the witness
 * corpus and reports family (A..V) coverage. Then prints a comparison
 * row showing each adapter's overall pass / partial / fail counts.
 *
 * Skip policy: per-witness encode/parse failures within an adapter are
 * silently treated as "not satisfied for this witness" (the existing
 * behavior — see `evaluateCoverage`). A whole-adapter throw is caught
 * and surfaced in the comparison table as `ERROR`.
 */

import { CRITERIA, type Criterion, type CriterionFamily, type IRAdapter } from "@typecarta/core";
import { ALL_WITNESSES, type WitnessSchema } from "@typecarta/witnesses";
import { buildAllAdapters } from "../adapters.js";

interface FamilyCoverage {
	family: CriterionFamily;
	total: number;
	satisfied: number;
	partial: number;
	notSatisfied: number;
	coveragePercent: number;
}

interface AdapterCoverage {
	adapter: string;
	families: readonly FamilyCoverage[];
	totalCriteria: number;
	totalSatisfied: number;
	totalPartial: number;
	totalNotSatisfied: number;
	error?: string;
}

function evaluateCoverage(
	adapter: IRAdapter,
	witnesses: readonly WitnessSchema[],
): FamilyCoverage[] {
	const byFamily = new Map<CriterionFamily, Criterion[]>();
	for (const criterion of CRITERIA) {
		const group = byFamily.get(criterion.family) ?? [];
		group.push(criterion);
		byFamily.set(criterion.family, group);
	}

	const coverages: FamilyCoverage[] = [];

	for (const [family, criteria] of byFamily) {
		let satisfied = 0;
		let partial = 0;
		let notSatisfied = 0;

		for (const criterion of criteria) {
			let bestStatus: "satisfied" | "not-satisfied" | "undecidable" = "not-satisfied";

			for (const witness of witnesses) {
				if (!adapter.isEncodable(witness.schema)) continue;
				try {
					const encoded = adapter.encode(witness.schema);
					const roundTripped = adapter.parse(encoded);
					const result = criterion.evaluate(roundTripped);
					if (result.status === "satisfied") {
						bestStatus = "satisfied";
						break;
					}
					if (result.status === "undecidable" && bestStatus !== "satisfied") {
						bestStatus = "undecidable";
					}
				} catch {
					// per-witness failure; try next
				}
			}

			switch (bestStatus) {
				case "satisfied":
					satisfied++;
					break;
				case "undecidable":
					partial++;
					break;
				case "not-satisfied":
					notSatisfied++;
					break;
			}
		}

		const total = criteria.length;
		coverages.push({
			family,
			total,
			satisfied,
			partial,
			notSatisfied,
			coveragePercent: total > 0 ? (satisfied / total) * 100 : 0,
		});
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
		return {
			adapter: adapter.name,
			families,
			totalCriteria,
			totalSatisfied,
			totalPartial,
			totalNotSatisfied,
		};
	} catch (err) {
		return {
			adapter: adapter.name,
			families: [],
			totalCriteria: 0,
			totalSatisfied: 0,
			totalPartial: 0,
			totalNotSatisfied: 0,
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
			"Coverage".padStart(10),
	);
	console.log("-".repeat(44));

	for (const f of cov.families) {
		console.log(
			`  ${f.family}`.padEnd(8) +
				`${f.total}`.padStart(6) +
				`${f.satisfied}`.padStart(6) +
				`${f.partial}`.padStart(8) +
				`${f.notSatisfied}`.padStart(6) +
				`${f.coveragePercent.toFixed(1)}%`.padStart(10),
		);
	}

	console.log("-".repeat(44));
	const overall = cov.totalCriteria > 0 ? (cov.totalSatisfied / cov.totalCriteria) * 100 : 0;
	console.log(
		"Total".padEnd(8) +
			`${cov.totalCriteria}`.padStart(6) +
			`${cov.totalSatisfied}`.padStart(6) +
			`${cov.totalPartial}`.padStart(8) +
			`${cov.totalNotSatisfied}`.padStart(6) +
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
			"Coverage".padStart(12),
	);
	console.log("-".repeat(adapterWidth + 8 + 10 + 8 + 12));
	for (const c of sorted) {
		const pct = c.totalCriteria > 0 ? (c.totalSatisfied / c.totalCriteria) * 100 : 0;
		console.log(
			c.adapter.padEnd(adapterWidth) +
				`${c.totalSatisfied}/${c.totalCriteria}`.padStart(8) +
				`${c.totalPartial}`.padStart(10) +
				`${c.totalNotSatisfied}`.padStart(8) +
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
