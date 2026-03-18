import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

/** π₁: Bottom / Empty — ⟦S⟧ = ∅ */
export const pi01Bottom: CriterionPredicate = {
	id: "pi-01",
	name: "Bottom / Empty",
	description: "The schema has an empty extension: ⟦S⟧ = ∅",
	evaluate(term: TypeTerm): CriterionResult {
		// Check for explicit bottom nodes
		if (term.kind === "bottom") {
			return { status: "satisfied", witness: term };
		}
		// Check for bottom in subterms (e.g., union branch that is bottom)
		const bottoms = collect(term, (n) => n.kind === "bottom");
		if (bottoms.length > 0) {
			return { status: "satisfied", witness: bottoms[0]! };
		}
		return { status: "not-satisfied", reason: "No bottom/empty type found" };
	},
};
