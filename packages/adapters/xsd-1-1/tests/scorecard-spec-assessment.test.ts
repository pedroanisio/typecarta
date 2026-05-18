import { CRITERIA, evaluateScorecard } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { ALL_WITNESSES } from "../../../witnesses/src/index.ts";
import { XsdAdapter } from "../src/adapter.js";

const adapter = new XsdAdapter();

function fullScorecard() {
	const witnesses = ALL_WITNESSES.map((w) => ({
		criterionId: w.id,
		name: w.name,
		schema: w.schema,
	}));
	return evaluateScorecard(adapter, witnesses, CRITERIA);
}

describe("XSD 1.1 full scorecard assessment", () => {
	it("pins the current adapter full-mode totals", () => {
		const scorecard = fullScorecard();

		// Totals are currently identical to the xsd 1.0 adapter (pre-extension)
		// because no witness in ALL_WITNESSES currently exercises the
		// 1.1-only encoder paths (xs:assert, xs:alternative). See
		// docs/guides/xsd-1-0-vs-1-1.md for the per-row analysis.
		expect(scorecard.totals).toEqual({
			satisfied: 24,
			partial: 15,
			notSatisfied: 5,
			outOfVocabulary: 26,
		});
	});

	it("identifies as the XSD 1.1 sibling adapter", () => {
		expect(adapter.name).toBe("xsd-1-1");
		expect(adapter.specVersion).toBe("1.1");
	});

	it("supports the `conditional` IR kind (1.1-only via xs:alternative)", () => {
		// xsd 1.0 does not declare supportsKind('conditional'); 1.1 does. This
		// is the contract-level difference; whether the difference is *exercised*
		// by current witnesses is a separate matter (see the totals test).
		expect(adapter.supportsKind("conditional")).toBe(true);
	});
});
