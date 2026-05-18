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
		//   - an encode/parse hook that translates `multipleOf` predicates
		//     into `xs:assert test="$value mod N = 0"` and back
		//
		// The xs:assert hook is what lifts pi-prime-40 (Modular/Divisibility)
		// and pi-prime-41 (Compound Decidable Predicate) from ✗ to ✓ on 1.1
		// while 1.0 keeps refusing the same witnesses (1.0 has no xs:assert).
		// pi-prime-43 stays `◐` for now: the SP43 witness shape is
		// `refinement(product, rangeConstraint())` which lacks a concrete
		// cross-field XPath. pi-prime-65 stays `n/a`: the SP65 witness wraps
		// `typeVar("alpha")`, an IR `var` kind neither adapter models.
		expect(scorecard.totals).toEqual({
			satisfied: 28,
			partial: 15,
			notSatisfied: 10,
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
