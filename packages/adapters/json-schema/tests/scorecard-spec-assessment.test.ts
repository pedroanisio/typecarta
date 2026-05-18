import { base, evaluatePrimeScorecard, multipleOfConstraint, refinement } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { DIVERSE_PRIME_SCHEMAS } from "../../../witnesses/src/index.ts";
import { JsonSchemaAdapter } from "../src/adapter.js";

const adapter = new JsonSchemaAdapter();

function fullScorecard() {
	const witnesses = DIVERSE_PRIME_SCHEMAS.map((w) => ({
		criterionId: w.id,
		name: w.name,
		schema: w.schema,
	}));
	return evaluatePrimeScorecard(adapter, witnesses);
}

describe("JSON Schema draft-07 full scorecard assessment", () => {
	it("pins the current adapter full-mode totals", () => {
		const scorecard = fullScorecard();

		expect(scorecard.totals).toEqual({
			satisfied: 22,
			partial: 15,
			notSatisfied: 33,
		});
	});

	it("keeps spec-recognized adapter gaps visible", () => {
		const scorecard = fullScorecard();
		const cells = scorecard.cells;

		const knownGaps: Array<{
			criterionId: string;
			current: "partial" | "✗";
			specFeature: string;
		}> = [
			{
				criterionId: "pi-prime-25",
				current: "✗",
				specFeature: "$ref recursion",
			},
			{
				criterionId: "pi-prime-26",
				current: "✗",
				specFeature: "$ref mutual recursion",
			},
			{
				criterionId: "pi-prime-40",
				current: "partial",
				specFeature: "multipleOf",
			},
			{
				criterionId: "pi-prime-46",
				current: "✗",
				specFeature: "uniqueItems",
			},
			{
				criterionId: "pi-prime-47",
				current: "✗",
				specFeature: "additionalProperties / patternProperties dictionaries",
			},
		];

		for (const gap of knownGaps) {
			expect(cells.get(gap.criterionId)?.value, gap.specFeature).toBe(gap.current);
		}
	});

	it("shows multipleOf is encodable but not preserved by parse", () => {
		const term = refinement(base("number"), multipleOfConstraint(3));
		const encoded = adapter.encode(term);
		const parsed = adapter.parse(encoded);

		expect(encoded).toEqual({ type: "number", multipleOf: 3 });
		expect(parsed).not.toEqual(term);
		expect(parsed).toEqual(base("number"));
	});
});
