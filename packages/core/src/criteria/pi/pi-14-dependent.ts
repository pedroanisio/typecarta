import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

function hasDependentConstraint(n: TypeTerm): boolean {
	// A discriminated union where a tag field determines the type of other fields
	if (n.kind !== "apply" || n.constructor !== "union") return false;
	// Check if branches are products with a shared literal-typed discriminant field
	const branches = n.args.filter(
		(a) => a.kind === "apply" && a.constructor === "product" && a.fields,
	);
	if (branches.length < 2) return false;
	// Check for a common discriminant field with literal types
	const firstFields = (branches[0] as Extract<TypeTerm, { kind: "apply" }>).fields;
	if (!firstFields) return false;
	return firstFields.some((f) => {
		const isLiteral = f.type.kind === "literal";
		if (!isLiteral) return false;
		// Check that all branches have this field with different literals
		return branches.every((b) => {
			const bf = (b as Extract<TypeTerm, { kind: "apply" }>).fields;
			return bf?.some((bf2) => bf2.name === f.name && bf2.type.kind === "literal");
		});
	});
}

/** π₁₄: Dependent Constraint — type of one field depends on value of another */
export const pi14Dependent: CriterionPredicate = {
	id: "pi-14",
	name: "Dependent Constraint",
	description: "The type of one field is constrained by the value of another",
	evaluate(term: TypeTerm): CriterionResult {
		if (hasDependentConstraint(term)) {
			return { status: "satisfied", witness: term };
		}
		// Also check conditional types as dependent
		if (term.kind === "conditional") {
			return { status: "satisfied", witness: term };
		}
		const deps = collect(term, hasDependentConstraint);
		if (deps.length > 0) {
			return { status: "satisfied", witness: deps[0]! };
		}
		const conds = collect(term, (n) => n.kind === "conditional");
		if (conds.length > 0) {
			return { status: "satisfied", witness: conds[0]! };
		}
		return { status: "not-satisfied", reason: "No dependent constraint found" };
	},
};
