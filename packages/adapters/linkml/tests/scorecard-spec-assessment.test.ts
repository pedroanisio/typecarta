import { CRITERIA, evaluateScorecard } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { ALL_WITNESSES } from "../../../witnesses/src/index.ts";
import { LinkmlAdapter } from "../src/adapter.js";

const adapter = new LinkmlAdapter();

function fullScorecard() {
	const witnesses = ALL_WITNESSES.map((w) => ({
		criterionId: w.id,
		name: w.name,
		schema: w.schema,
	}));
	return evaluateScorecard(adapter, witnesses, CRITERIA);
}

describe("LinkML full scorecard assessment", () => {
	it("pins the current adapter full-mode totals", () => {
		const scorecard = fullScorecard();

		// LinkML is class-centric and YAML-flavored. Strong on class
		// definitions, enums, slot constraints, URIs/mappings, named
		// types, and module/imports. Weak on bare top-level forms
		// (array, union of non-literals) which LinkML doesn't express
		// outside a slot context, and on type-system constructs LinkML
		// doesn't have (positional tuples, variadics, polymorphism,
		// function types).
		expect(scorecard.totals).toEqual({
			satisfied: 14,
			partial: 20,
			notSatisfied: 19,
			outOfVocabulary: 17,
		});
	});

	it("identifies as LinkML and pins specVersion 1.11", () => {
		expect(adapter.name).toBe("LinkML");
		expect(adapter.specVersion).toBe("1.11");
	});

	it("models the IR vocabulary needed for class-based modeling", () => {
		// Beyond the base set, LinkML must understand nominal (for class_uri /
		// slot_uri / enum meaning), let (for named classes / types / enums),
		// and extension (for module imports, abstract visibility, rules).
		for (const kind of ["nominal", "let", "extension"] as const) {
			expect(adapter.supportsKind(kind)).toBe(true);
		}
		// LinkML has no first-class polymorphism, type-level computation,
		// or recursion vocabulary.
		for (const kind of ["forall", "mu", "keyof", "mapped", "conditional", "rowpoly"] as const) {
			expect(adapter.supportsKind(kind)).toBe(false);
		}
	});

	it("documents the load-bearing gaps", () => {
		const scorecard = fullScorecard();
		const cells = scorecard.cells;

		// These rows are `✗` because LinkML cannot express the witness
		// shape outside a slot context, or because the construct has no
		// LinkML equivalent at all. They are honest language gaps, not
		// adapter bugs. If the witness conventions later change (e.g.
		// SP45 wraps array(T) in a class with a multivalued slot), some
		// of these would flip to ✓.
		const knownGaps: Array<{
			criterionId: string;
			current: "partial" | "✗" | "n/a";
			note: string;
		}> = [
			{ criterionId: "pi-prime-08", current: "✗", note: "no positional tuples in LinkML" },
			{ criterionId: "pi-prime-10", current: "✗", note: "no variadic tuples" },
			{ criterionId: "pi-prime-45", current: "✗", note: "bare array; LinkML needs multivalued slot" },
			{ criterionId: "pi-prime-47", current: "✗", note: "no map primitive" },
			{ criterionId: "pi-prime-48", current: "✗", note: "no function/arrow type" },
			{
				criterionId: "pi-prime-40",
				current: "✗",
				note: "no multipleOf — LinkML has no divisibility constraint",
			},
		];
		for (const gap of knownGaps) {
			expect(cells.get(gap.criterionId)?.value, gap.note).toBe(gap.current);
		}
	});
});
