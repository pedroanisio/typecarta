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

describe("XSD full scorecard assessment", () => {
	it("pins the current adapter full-mode totals", () => {
		const scorecard = fullScorecard();

		expect(scorecard.totals).toEqual({
			satisfied: 26,
			partial: 15,
			notSatisfied: 12,
			outOfVocabulary: 17,
		});
	});

	it("keeps spec-recognized adapter gaps visible", () => {
		const scorecard = fullScorecard();
		const cells = scorecard.cells;

		// These rows are `n/a` because the adapter does not model the IR
		// constructor used by the witness — they are adapter holes, NOT XSD
		// language gaps. See docs/guides/scorecard-spec-assessment.md for the
		// adapter-hole vs. language-gap classification. When the adapter grows
		// to support the listed XSD feature, the cell should flip; update this
		// list then.
		//
		// pi-prime-13 (nillable), pi-prime-17 (xs:any open record), and pi-prime-46
		// (xs:list+xs:unique for sets) were previously here but now encode faithfully
		// — adapter implementations exist for each.
		// pi-prime-35 (nominal), -44 (keyref), -50 (named alias), -51 (modules)
		// were previously n/a; the adapter has since grown support and they now
		// encode (partial or ✓). The remaining genuine adapter holes are the
		// two recursion rows.
		const knownAdapterHoles: Array<{
			criterionId: string;
			current: "partial" | "✗" | "n/a";
			xsdFeature: string;
		}> = [
			{
				criterionId: "pi-prime-25",
				current: "n/a",
				xsdFeature: "named complexType self-reference",
			},
			{
				criterionId: "pi-prime-26",
				current: "n/a",
				xsdFeature: "named complexType mutual reference",
			},
		];

		for (const gap of knownAdapterHoles) {
			expect(cells.get(gap.criterionId)?.value, gap.xsdFeature).toBe(gap.current);
		}
	});

	it("documents that the adapter does not declare an XSD version", () => {
		// Several verdicts pivot on XSD 1.0 vs. 1.1 (notably pi-prime-43 with
		// xs:assert). The current adapter name is just "xsd" — it should be
		// split into "xsd-1.0" and "xsd-1.1" before those rows can be called
		// spec-correct. This test pins the current name so the split is a
		// deliberate, visible change.
		expect(adapter.name).toBe("xsd");
	});
});
