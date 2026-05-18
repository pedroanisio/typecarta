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

		// 1.1 shares the @typecarta/adapter-xsd-core engine with 1.0 and adds:
		//   - 4 datatypes (dateTimeStamp, dayTimeDuration, yearMonthDuration,
		//     anyAtomicType)
		//   - 2 facets (assertions, explicitTimezone)
		//   - the "conditional" IR kind (xs:alternative)
		// None of these flip a current scorecard cell because:
		//   - the SP43 cross-field witness is a `refinement(product, ...)`
		//     shape that doesn't naturally map to xs:assert (the IR has no
		//     XPath analog); pi-prime-43 stays `◐` for both versions.
		//   - the SP65 conditional witness wraps `typeVar("alpha")`, an IR
		//     `var` kind neither adapter models; pi-prime-65 stays `n/a`.
		// So 1.1's totals equal 1.0's — the version difference is real
		// at the contract level (see the `supportsKind` test below) but
		// not exercised by the current witness set.
		expect(scorecard.totals).toEqual({
			satisfied: 26,
			partial: 15,
			notSatisfied: 12,
			outOfVocabulary: 17,
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
