import { CRITERIA, evaluateScorecard } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { ALL_WITNESSES } from "../../../witnesses/src/index.ts";
import { ShaclAdapter } from "../src/adapter.js";

const adapter = new ShaclAdapter();

function fullScorecard() {
	const witnesses = ALL_WITNESSES.map((w) => ({
		criterionId: w.id,
		name: w.name,
		schema: w.schema,
	}));
	return evaluateScorecard(adapter, witnesses, CRITERIA);
}

describe("SHACL 1.0 full scorecard assessment", () => {
	it("pins the current adapter full-mode totals", () => {
		const scorecard = fullScorecard();

		// SHACL leans heavily on constraint-style verdicts: many rows land at
		// `partial` because the encoder produces a defensible SHACL shape but
		// the criterion predicate looks for IR structure the round-trip does
		// not preserve (e.g. nominal subclasses, sh:multipleOf as SPARQL).
		// See docs/guides/shacl-scorecard-audit.md for the per-row narrative.
		//
		// Revision history:
		//   v1 (17 / 30 / 7 / 16) — initial SHACL adapter.
		//   v2 (23 / 24 / 7 / 16) — "empty product leak" parser fix:
		//     pi-prime-03, -06, -07, -20, -21, -23, -42 moved ◐ → ✓.
		//   v3 (26 / 21 / 7 / 16) — refinement-facet encoder/parser pair:
		//     pi-prime-24, -40, -41 moved ◐ → ✓.
		expect(scorecard.totals).toEqual({
			satisfied: 26,
			partial: 21,
			notSatisfied: 7,
			outOfVocabulary: 16,
		});
	});

	it("identifies as shacl-1-0 with specVersion 1.0", () => {
		expect(adapter.name).toBe("shacl-1-0");
		expect(adapter.specVersion).toBe("1.0");
	});

	it("classifies the 7 ✗ rows as language gaps (vocabulary reaches encoder, encoder cannot produce a faithful shape)", () => {
		const cells = fullScorecard().cells;
		const languageGaps = [
			{ id: "pi-prime-08", feature: "Positional Tuple — RDF has no ordered tuple primitive" },
			{ id: "pi-prime-10", feature: "Variadic / Rest Element — same as 08" },
			{ id: "pi-prime-47", feature: "Map / Dictionary — sh:property names are IRIs, not open keys" },
			{ id: "pi-prime-48", feature: "Function / Arrow Type — SHACL describes data, not behavior" },
			{ id: "pi-prime-49", feature: "Overloaded Function — same as 48" },
			{ id: "pi-prime-68", feature: "String Concatenation — no string-algebra constraint vocabulary" },
			{ id: "pi-prime-69", feature: "String Pattern Decomposition — same as 68" },
		];
		for (const gap of languageGaps) {
			expect(cells.get(gap.id)?.value, gap.feature).toBe("✗");
		}
	});

	it("classifies the 16 n/a rows as IR-kind holes (var, forall, keyof, mapped, conditional, rowpoly)", () => {
		const cells = fullScorecard().cells;
		// The IR kinds SHACL does not model. Pair (witness, missing kind) is
		// fixed by the witness set, not the SHACL spec.
		const irHoles: Array<{ id: string; kind: string }> = [
			{ id: "pi-prime-25", kind: "var" }, // mu's body uses a typeVar
			{ id: "pi-prime-26", kind: "var" },
			{ id: "pi-prime-27", kind: "forall" },
			{ id: "pi-prime-28", kind: "forall" },
			{ id: "pi-prime-29", kind: "forall" },
			{ id: "pi-prime-30", kind: "forall" },
			{ id: "pi-prime-31", kind: "forall" },
			{ id: "pi-prime-32", kind: "forall" },
			{ id: "pi-prime-33", kind: "forall" },
			{ id: "pi-prime-60", kind: "forall" },
			{ id: "pi-prime-61", kind: "forall" },
			{ id: "pi-prime-62", kind: "forall" },
			{ id: "pi-prime-63", kind: "keyof" },
			{ id: "pi-prime-64", kind: "mapped" },
			{ id: "pi-prime-65", kind: "conditional" },
			{ id: "pi-prime-66", kind: "rowpoly" },
		];
		for (const hole of irHoles) {
			expect(cells.get(hole.id)?.value, `${hole.id} expected n/a (missing IR kind: ${hole.kind})`).toBe("n/a");
		}
	});
});
