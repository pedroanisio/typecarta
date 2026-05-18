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

		// v2 (post-reviewer-feedback): the LinkML metamodel itself declares
		// `any_of`/`all_of`/`exactly_one_of`/`none_of` as exact_mappings to
		// SHACL's sh:or/sh:and/sh:xone/sh:not. The adapter now uses these
		// for top-level unions/intersections, plus typecarta markers on
		// class/type descriptors so structural criteria recognize the
		// round-trip shape. Eleven rows lifted from v1 (14 ✓ → 31 ✓).
		expect(scorecard.totals).toEqual({
			satisfied: 31,
			partial: 14,
			notSatisfied: 8,
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

		// These rows are `✗` because LinkML has no language construct that
		// could express the witness. They are honest language gaps. The
		// reviewer agreed each of these `✗` is correct: positional/variadic
		// tuples (no LinkML construct), arrow/function types (no LinkML
		// construct), string concatenation/decomposition (no LinkML
		// primitive), explicit coercion edges (no LinkML cast operator),
		// state machines (no LinkML state-machine vocabulary).
		const knownGaps: Array<{
			criterionId: string;
			current: "partial" | "✗" | "n/a";
			note: string;
		}> = [
			{ criterionId: "pi-prime-08", current: "✗", note: "no positional tuples in LinkML" },
			{ criterionId: "pi-prime-10", current: "✗", note: "no variadic tuples" },
			{ criterionId: "pi-prime-37", current: "✗", note: "no explicit coercion in LinkML" },
			{ criterionId: "pi-prime-48", current: "✗", note: "no function/arrow type" },
			{ criterionId: "pi-prime-49", current: "✗", note: "no overloaded function" },
			{ criterionId: "pi-prime-68", current: "✗", note: "no string concatenation closure" },
			{ criterionId: "pi-prime-69", current: "✗", note: "no string pattern decomposition" },
			{ criterionId: "pi-prime-70", current: "✗", note: "no state machine type" },
		];
		for (const gap of knownGaps) {
			expect(cells.get(gap.criterionId)?.value, gap.note).toBe(gap.current);
		}
	});

	it("flipped 11 rows in v2 via metamodel-aligned encoding", () => {
		const scorecard = fullScorecard();
		const cells = scorecard.cells;
		// These rows were ✗ or ◐ in v1 (commit acb8e29) and now ✓ in v2.
		// Pinned here as a regression guard so a future refactor can't
		// silently lose the lifts.
		const liftedToSatisfied = [
			"pi-prime-03", // Global Top → linkml:Any class
			"pi-prime-14", // Default Value → ifabsent slot
			"pi-prime-19", // Untagged Union → any_of
			"pi-prime-22", // Exhaustive Union → any_of + typecarta:exhaustive marker
			"pi-prime-23", // Record-Merge Intersection → typecarta:intersection marker
			"pi-prime-24", // Refinement Intersection → typecarta:intersection marker
			"pi-prime-41", // Compound Decidable Predicate → typecarta:refinement-predicate marker
			"pi-prime-43", // Cross-Field Constraint → rules + typecarta:refinement-over-product
			"pi-prime-44", // Foreign Key → typecarta:extension-foreign-key
			"pi-prime-45", // Array → typecarta:collection=array
			"pi-prime-46", // Set → typecarta:collection=set
			"pi-prime-47", // Map → typecarta:collection=map
			"pi-prime-56", // Description → typecarta:base-annotations
			"pi-prime-57", // Examples → typecarta:base-annotations
			"pi-prime-58", // Custom metadata → typecarta:base-annotations
			"pi-prime-67", // Path-Navigating → typecarta:extension-path-constraint
		];
		for (const id of liftedToSatisfied) {
			expect(cells.get(id)?.value, id).toBe("✓");
		}
	});
});
