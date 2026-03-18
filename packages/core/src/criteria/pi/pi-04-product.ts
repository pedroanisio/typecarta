import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

function isProduct(n: TypeTerm): boolean {
	return n.kind === "apply" && n.constructor === "product" && (n.fields?.length ?? 0) > 0;
}

/** π₄: Finite Product — S = ∏ᵢ τᵢ */
export const pi04Product: CriterionPredicate = {
	id: "pi-04",
	name: "Finite Product",
	description: "The schema is a finite labelled product (record)",
	evaluate(term: TypeTerm): CriterionResult {
		if (isProduct(term)) {
			return { status: "satisfied", witness: term };
		}
		const products = collect(term, isProduct);
		if (products.length > 0) {
			return { status: "satisfied", witness: products[0]! };
		}
		return { status: "not-satisfied", reason: "No product/record type found" };
	},
};
