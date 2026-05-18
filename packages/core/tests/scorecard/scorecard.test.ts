import {
	CRITERIA,
	type IRAdapter,
	type WitnessEntry,
	base,
	bottom,
	compareScorecards,
	evaluateScorecard,
	field,
	literal,
	product,
	renderJSON,
	renderMarkdown,
	top,
} from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";
import { createSignature } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { ALL_WITNESSES } from "../../../witnesses/src/index.js";

// Minimal mock adapter that supports everything
const mockAdapter: IRAdapter = {
	name: "Mock IR",
	signature: createSignature(
		["string", "number", "boolean", "null"],
		[
			{ name: "product", arity: 1 },
			{ name: "union", arity: 2 },
			{ name: "array", arity: 1 },
		],
	),
	parse: (source) => source as TypeTerm,
	encode: (term) => term as unknown,
	isEncodable: () => true,
	inhabits: () => true,
};

// Use core-tagged Π' ids — after the Π merge, evaluateScorecard defaults to CORE_CRITERIA.
const basicWitnesses: WitnessEntry[] = [
	{ criterionId: "pi-prime-01", schema: bottom(), name: "SP1" }, // Syntactic Bottom (core)
	{ criterionId: "pi-prime-03", schema: top(), name: "SP3" }, // Global Top (core)
	{ criterionId: "pi-prime-05", schema: literal(42), name: "SP5" }, // Singleton Literal (core)
	{
		criterionId: "pi-prime-09", // Labelled Record (core)
		schema: product([field("x", base("number"))]),
		name: "SP9",
	},
];

describe("Scorecard", () => {
	it("evaluates scorecard against adapter", () => {
		const result = evaluateScorecard(mockAdapter, basicWitnesses);
		expect(result.adapterName).toBe("Mock IR");
		expect(result.cells.size).toBe(15); // 15 core criteria filled
		expect(result.cells.get("pi-prime-01")!.value).toBe("✓");
		expect(result.cells.get("pi-prime-03")!.value).toBe("✓");
	});

	it("computes totals correctly", () => {
		const result = evaluateScorecard(mockAdapter, basicWitnesses);
		const { totals } = result;
		expect(totals.satisfied + totals.partial + totals.notSatisfied).toBe(15);
	});

	it("compares two scorecards", () => {
		const result1 = evaluateScorecard(mockAdapter, basicWitnesses);
		const result2 = evaluateScorecard({ ...mockAdapter, name: "Mock IR 2" }, basicWitnesses);
		const comparison = compareScorecards(result1, result2);
		expect(comparison.differences).toHaveLength(0);
	});

	it("renders markdown", () => {
		const result = evaluateScorecard(mockAdapter, basicWitnesses);
		const md = renderMarkdown(result);
		expect(md).toContain("Mock IR");
		expect(md).toContain("pi-prime-01");
	});

	it("renders JSON", () => {
		const result = evaluateScorecard(mockAdapter, basicWitnesses);
		const json = renderJSON(result);
		const parsed = JSON.parse(json);
		expect(parsed.adapter).toBe("Mock IR");
	});
});

describe("Full Scorecard (70 criteria)", () => {
	const allWitnesses: WitnessEntry[] = ALL_WITNESSES.map((w) => ({
		criterionId: w.id,
		schema: w.schema,
		name: w.name,
	}));

	it("evaluating against CRITERIA produces 70-cell result", () => {
		const result = evaluateScorecard(mockAdapter, allWitnesses, CRITERIA);
		expect(result.cells.size).toBe(70);
		expect(result.adapterName).toBe("Mock IR");
	});

	it("all 70 cells have a value", () => {
		const result = evaluateScorecard(mockAdapter, allWitnesses, CRITERIA);
		for (const cell of result.cells.values()) {
			expect(["✓", "partial", "✗", "n/a"]).toContain(cell.value);
		}
	});

	it("totals sum to 70", () => {
		const result = evaluateScorecard(mockAdapter, allWitnesses, CRITERIA);
		const { totals } = result;
		expect(totals.satisfied + totals.partial + totals.notSatisfied + totals.outOfVocabulary).toBe(
			70,
		);
	});

	it("15-criterion path still works unchanged", () => {
		const result = evaluateScorecard(mockAdapter, basicWitnesses);
		expect(result.cells.size).toBe(15);
	});

	it("renders full scorecard as markdown", () => {
		const result = evaluateScorecard(mockAdapter, allWitnesses, CRITERIA);
		const md = renderMarkdown(result);
		expect(md).toContain("pi-prime-01");
		expect(md).toContain("pi-prime-70");
	});
});
