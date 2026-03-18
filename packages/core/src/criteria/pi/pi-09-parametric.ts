import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

/** π₉: Parametricity — S = Λα.F(α) */
export const pi09Parametric: CriterionPredicate = {
	id: "pi-09",
	name: "Parametricity",
	description: "The schema uses type-level abstraction (generics)",
	evaluate(term: TypeTerm): CriterionResult {
		if (term.kind === "forall") {
			return { status: "satisfied", witness: term };
		}
		const foralls = collect(term, (n) => n.kind === "forall");
		if (foralls.length > 0) {
			return { status: "satisfied", witness: foralls[0]! };
		}
		return { status: "not-satisfied", reason: "No parametric (∀) type found" };
	},
};
