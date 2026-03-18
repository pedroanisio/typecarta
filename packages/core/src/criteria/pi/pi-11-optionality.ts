import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

function hasOptionalField(n: TypeTerm): boolean {
	if (n.kind !== "apply" || n.constructor !== "product") return false;
	return n.fields?.some((f) => f.optional === true) ?? false;
}

/** π₁₁: Optionality — key-absence semantics */
export const pi11Optionality: CriterionPredicate = {
	id: "pi-11",
	name: "Optionality",
	description: "The schema distinguishes key-absence from key-present-with-null",
	evaluate(term: TypeTerm): CriterionResult {
		if (hasOptionalField(term)) {
			return { status: "satisfied", witness: term };
		}
		const candidates = collect(term, hasOptionalField);
		if (candidates.length > 0) {
			return { status: "satisfied", witness: candidates[0]! };
		}
		return { status: "not-satisfied", reason: "No optional fields found" };
	},
};
