import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

/** π₁₂: Nominal Identity — same extension, distinct under ≤_op [meta-op] */
export const pi12Nominal: CriterionPredicate = {
	id: "pi-12",
	name: "Nominal Identity",
	description: "Structurally identical types distinguished by name",
	meta: "meta-op",
	evaluate(term: TypeTerm): CriterionResult {
		if (term.kind === "nominal") {
			return { status: "satisfied", witness: term };
		}
		const nominals = collect(term, (n) => n.kind === "nominal");
		if (nominals.length > 0) {
			return { status: "satisfied", witness: nominals[0]! };
		}
		return { status: "not-satisfied", reason: "No nominal type found" };
	},
};
