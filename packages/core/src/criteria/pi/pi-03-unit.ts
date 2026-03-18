import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

/** π₃: Unit / Singleton — |⟦S⟧| = 1 */
export const pi03Unit: CriterionPredicate = {
	id: "pi-03",
	name: "Unit / Singleton",
	description: "The schema has exactly one inhabitant: |⟦S⟧| = 1",
	evaluate(term: TypeTerm): CriterionResult {
		if (term.kind === "literal") {
			return { status: "satisfied", witness: term };
		}
		const literals = collect(term, (n) => n.kind === "literal");
		if (literals.length > 0) {
			return { status: "satisfied", witness: literals[0]! };
		}
		return { status: "not-satisfied", reason: "No literal/singleton type found" };
	},
};
