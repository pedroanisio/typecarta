import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

/** π₇: Direct Recursion — S = μα.F(α) */
export const pi07Recursion: CriterionPredicate = {
	id: "pi-07",
	name: "Direct Recursion",
	description: "The schema uses a fixpoint (self-referential type)",
	evaluate(term: TypeTerm): CriterionResult {
		if (term.kind === "mu") {
			return { status: "satisfied", witness: term };
		}
		const mus = collect(term, (n) => n.kind === "mu");
		if (mus.length > 0) {
			return { status: "satisfied", witness: mus[0]! };
		}
		return { status: "not-satisfied", reason: "No recursive (μ) type found" };
	},
};
