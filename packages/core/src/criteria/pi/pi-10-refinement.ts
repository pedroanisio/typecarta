import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

/** π₁₀: Refinement — S = {v:τ | P(v)} */
export const pi10Refinement: CriterionPredicate = {
	id: "pi-10",
	name: "Refinement",
	description: "The schema refines a base type with a predicate",
	evaluate(term: TypeTerm): CriterionResult {
		if (term.kind === "refinement") {
			return { status: "satisfied", witness: term };
		}
		const refinements = collect(term, (n) => n.kind === "refinement");
		if (refinements.length > 0) {
			return { status: "satisfied", witness: refinements[0]! };
		}
		return { status: "not-satisfied", reason: "No refinement type found" };
	},
};
