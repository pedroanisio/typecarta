import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

/** π₂: Top / Universal — ⟦S⟧ = 𝒱 */
export const pi02Top: CriterionPredicate = {
	id: "pi-02",
	name: "Top / Universal",
	description: "The schema accepts all values: ⟦S⟧ = 𝒱",
	evaluate(term: TypeTerm): CriterionResult {
		if (term.kind === "top") {
			return { status: "satisfied", witness: term };
		}
		const tops = collect(term, (n) => n.kind === "top");
		if (tops.length > 0) {
			return { status: "satisfied", witness: tops[0]! };
		}
		return { status: "not-satisfied", reason: "No top/universal type found" };
	},
};
