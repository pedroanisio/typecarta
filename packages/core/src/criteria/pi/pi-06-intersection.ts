import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

function isIntersection(n: TypeTerm): boolean {
	return n.kind === "apply" && n.constructor === "intersection" && n.args.length >= 2;
}

/** π₆: Intersection — S = τ₁ ⊓ τ₂ with non-trivial overlap */
export const pi06Intersection: CriterionPredicate = {
	id: "pi-06",
	name: "Intersection",
	description: "The schema is a non-trivial intersection of types",
	evaluate(term: TypeTerm): CriterionResult {
		if (isIntersection(term)) {
			return { status: "satisfied", witness: term };
		}
		const intersections = collect(term, isIntersection);
		if (intersections.length > 0) {
			return { status: "satisfied", witness: intersections[0]! };
		}
		return { status: "not-satisfied", reason: "No intersection type found" };
	},
};
