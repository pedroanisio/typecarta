/**
 * Benchmark: Criterion coverage per adapter
 *
 * Takes an adapter, runs all PI_PRIME_CRITERIA against all witness schemas,
 * and reports coverage percentage per family (A through V).
 */

import { JsonSchemaAdapter } from "@typecarta/adapter-json-schema";
import {
	type CriterionFamily,
	PI_PRIME_CRITERIA,
	type PiPrimeCriterion,
	type TypeTerm,
	clearAdapters,
	registerAdapter,
} from "@typecarta/core";
import { DIVERSE_SCHEMAS, type WitnessSchema } from "@typecarta/witnesses";

// ── Types ──────────────────────────────────────────────────────────
interface FamilyCoverage {
	family: CriterionFamily;
	total: number;
	satisfied: number;
	partial: number;
	notSatisfied: number;
	coveragePercent: number;
}

// ── Evaluate coverage ──────────────────────────────────────────────
function evaluateCoverage(
	adapter: {
		name: string;
		isEncodable(t: TypeTerm): boolean;
		encode(t: TypeTerm): unknown;
		parse(s: unknown): TypeTerm;
	},
	witnesses: readonly WitnessSchema[],
): FamilyCoverage[] {
	// Group criteria by family
	const byFamily = new Map<CriterionFamily, PiPrimeCriterion[]>();
	for (const criterion of PI_PRIME_CRITERIA) {
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

			// Test each criterion against all witnesses
			for (const witness of witnesses) {
				// First check if the adapter can encode this witness
				if (!adapter.isEncodable(witness.schema)) continue;

				try {
					const encoded = adapter.encode(witness.schema);
					const roundTripped = adapter.parse(encoded);
					const result = criterion.evaluate(roundTripped);

					if (result.status === "satisfied") {
						bestStatus = "satisfied";
						break; // Found a satisfying witness
					}
					if (result.status === "undecidable" && bestStatus !== "satisfied") {
						bestStatus = "undecidable";
					}
				} catch {
					// Encoding/parsing failed, skip
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

	// Sort by family letter
	coverages.sort((a, b) => a.family.localeCompare(b.family));
	return coverages;
}

// ── Report ─────────────────────────────────────────────────────────
function printReport(adapterName: string, coverages: FamilyCoverage[]): void {
	console.log(`=== Criterion Coverage: ${adapterName} ===`);
	console.log(`Total criteria: ${PI_PRIME_CRITERIA.length} across ${coverages.length} families`);
	console.log();

	console.log(
		"Family".padEnd(8) +
			"Total".padStart(6) +
			"Pass".padStart(6) +
			"Partial".padStart(8) +
			"Fail".padStart(6) +
			"Coverage".padStart(10),
	);
	console.log("-".repeat(44));

	let totalSatisfied = 0;
	let totalPartial = 0;
	let totalNotSatisfied = 0;
	let totalCriteria = 0;

	for (const cov of coverages) {
		console.log(
			`  ${cov.family}`.padEnd(8) +
				`${cov.total}`.padStart(6) +
				`${cov.satisfied}`.padStart(6) +
				`${cov.partial}`.padStart(8) +
				`${cov.notSatisfied}`.padStart(6) +
				`${cov.coveragePercent.toFixed(1)}%`.padStart(10),
		);
		totalSatisfied += cov.satisfied;
		totalPartial += cov.partial;
		totalNotSatisfied += cov.notSatisfied;
		totalCriteria += cov.total;
	}

	console.log("-".repeat(44));
	const overallPercent = totalCriteria > 0 ? (totalSatisfied / totalCriteria) * 100 : 0;
	console.log(
		"Total".padEnd(8) +
			`${totalCriteria}`.padStart(6) +
			`${totalSatisfied}`.padStart(6) +
			`${totalPartial}`.padStart(8) +
			`${totalNotSatisfied}`.padStart(6) +
			`${overallPercent.toFixed(1)}%`.padStart(10),
	);
}

// ── Main ───────────────────────────────────────────────────────────
function main(): void {
	const adapter = new JsonSchemaAdapter();
	const coverages = evaluateCoverage(adapter, DIVERSE_SCHEMAS);
	printReport(adapter.name, coverages);
}

main();
