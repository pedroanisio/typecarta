import {
	type IRAdapter,
	type WitnessEntry,
	base,
	bottom,
	compareScorecards,
	evaluatePrimeScorecard,
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
import { DIVERSE_PRIME_SCHEMAS } from "../../../witnesses/src/index.js";

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

const basicWitnesses: WitnessEntry[] = [
	{ criterionId: "pi-01", schema: bottom(), name: "S1" },
	{ criterionId: "pi-02", schema: top(), name: "S2" },
	{ criterionId: "pi-03", schema: literal(42), name: "S3" },
	{ criterionId: "pi-04", schema: product([field("x", base("number"))]), name: "S4" },
];

describe("Scorecard", () => {
	it("evaluates scorecard against adapter", () => {
		const result = evaluateScorecard(mockAdapter, basicWitnesses);
		expect(result.adapterName).toBe("Mock IR");
		expect(result.cells.size).toBe(15); // All 15 criteria filled
		expect(result.cells.get("pi-01")!.value).toBe("✓");
		expect(result.cells.get("pi-02")!.value).toBe("✓");
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
		expect(md).toContain("pi-01");
	});

	it("renders JSON", () => {
		const result = evaluateScorecard(mockAdapter, basicWitnesses);
		const json = renderJSON(result);
		const parsed = JSON.parse(json);
		expect(parsed.adapter).toBe("Mock IR");
	});
});

describe("Prime Scorecard (70 criteria)", () => {
	const primeWitnesses: WitnessEntry[] = DIVERSE_PRIME_SCHEMAS.map((w) => ({
		criterionId: w.id,
		schema: w.schema,
		name: w.name,
	}));

	it("evaluatePrimeScorecard produces 70-cell result", () => {
		const result = evaluatePrimeScorecard(mockAdapter, primeWitnesses);
		expect(result.cells.size).toBe(70);
		expect(result.adapterName).toBe("Mock IR");
	});

	it("all 70 cells have a value", () => {
		const result = evaluatePrimeScorecard(mockAdapter, primeWitnesses);
		for (const cell of result.cells.values()) {
			expect(["✓", "partial", "✗"]).toContain(cell.value);
		}
	});

	it("totals sum to 70", () => {
		const result = evaluatePrimeScorecard(mockAdapter, primeWitnesses);
		const { totals } = result;
		expect(totals.satisfied + totals.partial + totals.notSatisfied).toBe(70);
	});

	it("15-criterion path still works unchanged", () => {
		const result = evaluateScorecard(mockAdapter, basicWitnesses);
		expect(result.cells.size).toBe(15);
	});

	it("renders prime scorecard as markdown", () => {
		const result = evaluatePrimeScorecard(mockAdapter, primeWitnesses);
		const md = renderMarkdown(result);
		expect(md).toContain("pi-prime-01");
		expect(md).toContain("pi-prime-70");
	});
});
