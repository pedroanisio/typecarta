import {
	CRITERIA,
	base,
	evaluateScorecard,
	multipleOfConstraint,
	refinement,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { ALL_WITNESSES } from "../../../witnesses/src/index.ts";
import { JsonSchemaAdapter } from "../src/adapter.js";

const adapter = new JsonSchemaAdapter();

function fullScorecard() {
	const witnesses = ALL_WITNESSES.map((w) => ({
		criterionId: w.id,
		name: w.name,
		schema: w.schema,
	}));
	return evaluateScorecard(adapter, witnesses, CRITERIA);
}

describe("JSON Schema draft-07 full scorecard assessment", () => {
	it("pins the current adapter full-mode totals", () => {
		const scorecard = fullScorecard();

		expect(scorecard.totals).toEqual({
			satisfied: 22,
			partial: 15,
			notSatisfied: 8,
			outOfVocabulary: 25,
		});
	});

	it("keeps spec-recognized adapter gaps visible", () => {
		const scorecard = fullScorecard();
		const cells = scorecard.cells;

		// Cell classification:
		//   n/a — adapter does not model the IR kind the witness uses (adapter hole).
		//   ✗   — IR kind is in the adapter's vocabulary but encoding fails or is
		//         unsupported by JSON Schema draft-07 (language gap).
		//   partial — encodable but lossy.
		// Note: `supportsKind` filters on TypeTerm.kind only, not on `apply.constructor`.
		// So `apply(set, …)` and `apply(map, …)` reach the encoder and are classified
		// as language gaps (✗), even though one could argue they are adapter holes.
		const knownGaps: Array<{
			criterionId: string;
			current: "partial" | "✗" | "n/a";
			specFeature: string;
		}> = [
			{ criterionId: "pi-prime-25", current: "n/a", specFeature: "$ref recursion (mu node)" },
			{ criterionId: "pi-prime-26", current: "n/a", specFeature: "$ref mutual recursion (nested mu)" },
			{ criterionId: "pi-prime-40", current: "partial", specFeature: "multipleOf" },
			{ criterionId: "pi-prime-46", current: "✗", specFeature: "uniqueItems (apply/set)" },
			{ criterionId: "pi-prime-47", current: "✗", specFeature: "additionalProperties dictionaries (apply/map)" },
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
