import { collect } from "../../ast/traversal.js";
/** Family U — Row Polymorphism (π'₆₆). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_U: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-66",
		name: "Row-Polymorphic Record",
		family: "U",
		description: "Record type open over a row variable ({fields | ρ})",
		evaluate(term: TypeTerm) {
			const isRowPoly = (n: TypeTerm) => n.kind === "rowpoly";
			if (isRowPoly(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isRowPoly);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No row-polymorphic record" };
		},
	},
];
