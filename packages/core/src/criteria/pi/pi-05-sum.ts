import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

function isUnion(n: TypeTerm): boolean {
	return n.kind === "apply" && n.constructor === "union" && n.args.length >= 2;
}

/** π₅: Sum / Union — S = τ₁ ⊔ τ₂ */
export const pi05Sum: CriterionPredicate = {
	id: "pi-05",
	name: "Sum / Union",
	description: "The schema is a discriminated or undiscriminated union",
	evaluate(term: TypeTerm): CriterionResult {
		if (isUnion(term)) {
			return { status: "satisfied", witness: term };
		}
		const unions = collect(term, isUnion);
		if (unions.length > 0) {
			return { status: "satisfied", witness: unions[0]! };
		}
		return { status: "not-satisfied", reason: "No union/sum type found" };
	},
};
