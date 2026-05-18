import { describe, expect, it } from "vitest";
import { checkMonotonicity, formatMonotonicityViolations } from "../../src/index.js";
import type { CellValue, ScorecardResult } from "../../src/index.js";

function mkResult(name: string, cells: Record<string, CellValue>): ScorecardResult {
	const cellsMap = new Map(
		// biome-ignore lint/suspicious/noExplicitAny: id is a literal string and CriterionId widens to it.
		Object.entries(cells).map(([id, value]) => [id as any, { criterionId: id as any, value }]),
	);
	let s = 0;
	let p = 0;
	let n = 0;
	let na = 0;
	for (const v of Object.values(cells)) {
		if (v === "✓") s++;
		else if (v === "partial") p++;
		else if (v === "✗") n++;
		else na++;
	}
	return {
		adapterName: name,
		cells: cellsMap,
		totals: { satisfied: s, partial: p, notSatisfied: n, outOfVocabulary: na },
	};
}

describe("checkMonotonicity", () => {
	it("emits no violations when verdicts are identical", () => {
		const sub = mkResult("sub", { "pi-prime-01": "✓", "pi-prime-02": "◐" as CellValue });
		const sup = mkResult("sup", { "pi-prime-01": "✓", "pi-prime-02": "◐" as CellValue });
		expect(checkMonotonicity(sub, sup).violations).toEqual([]);
	});

	it("emits no violations when the superset strictly improves", () => {
		// ✗ → ◐, ◐ → ✓, n/a → anything are all legal.
		const sub = mkResult("sub", {
			"pi-prime-01": "✗",
			"pi-prime-02": "partial",
			"pi-prime-03": "n/a",
		});
		const sup = mkResult("sup", {
			"pi-prime-01": "partial",
			"pi-prime-02": "✓",
			"pi-prime-03": "✓",
		});
		expect(checkMonotonicity(sub, sup).violations).toEqual([]);
	});

	it("flags encoding-strength regressions", () => {
		// ✓ → partial, ✓ → ✗, partial → ✗ are violations.
		const sub = mkResult("sub", {
			"pi-prime-01": "✓",
			"pi-prime-02": "partial",
		});
		const sup = mkResult("sup", {
			"pi-prime-01": "✗",
			"pi-prime-02": "✗",
		});
		const result = checkMonotonicity(sub, sup);
		expect(result.violations).toHaveLength(2);
		expect(result.violations.every((v) => v.kind === "encoding-regressed")).toBe(true);
	});

	it("flags vocabulary loss separately from strength regression", () => {
		// ✓ → n/a means the superset lost vocabulary. Reported as
		// `vocabulary-lost`, not `encoding-regressed`.
		const sub = mkResult("sub", { "pi-prime-01": "✓" });
		const sup = mkResult("sup", { "pi-prime-01": "n/a" });
		const result = checkMonotonicity(sub, sup);
		expect(result.violations).toHaveLength(1);
		expect(result.violations[0]?.kind).toBe("vocabulary-lost");
	});

	it("skips rows present in only one scorecard", () => {
		const sub = mkResult("sub", { "pi-prime-01": "✓" });
		const sup = mkResult("sup", { "pi-prime-02": "✗" });
		expect(checkMonotonicity(sub, sup).violations).toEqual([]);
	});

	it("formats a clean ok message and a detailed violation message", () => {
		const sub = mkResult("a", { "pi-prime-01": "✓" });
		const sup = mkResult("b", { "pi-prime-01": "✓" });
		expect(formatMonotonicityViolations(checkMonotonicity(sub, sup))).toBe(
			"a ⊆ b: no monotonicity violations.",
		);
		const subBad = mkResult("a", { "pi-prime-01": "✓" });
		const supBad = mkResult("b", { "pi-prime-01": "✗" });
		const out = formatMonotonicityViolations(checkMonotonicity(subBad, supBad));
		expect(out).toContain("1 violation(s)");
		expect(out).toContain("pi-prime-01  ✓ → ✗  (encoding-regressed)");
	});
});
