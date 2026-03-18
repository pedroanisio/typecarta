import { collect } from "../../ast/traversal.js";
/** Family E — Sum and Union Structure (π'₁₉–π'₂₂). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

function isUnion(n: TypeTerm) {
	return n.kind === "apply" && n.constructor === "union" && n.args.length >= 2;
}

export const FAMILY_E: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-19",
		name: "Untagged Union",
		family: "E",
		refines: "pi-05",
		description: "Union with no distinguished discriminant field",
		evaluate(term: TypeTerm) {
			if (isUnion(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isUnion);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No untagged union" };
		},
	},
	{
		id: "pi-prime-20",
		name: "Discriminated Union, Literal Tag",
		family: "E",
		refines: "pi-05",
		description: "Union with a literal-typed tag field mapping to branches",
		evaluate(term: TypeTerm) {
			function isDiscriminated(n: TypeTerm): boolean {
				if (n.kind !== "apply" || n.constructor !== "union" || n.args.length < 2) return false;
				return n.args.every((a: TypeTerm) => {
					if (a.kind !== "apply" || a.constructor !== "product" || !a.fields) return false;
					return a.fields.some((f) => f.type.kind === "literal");
				});
			}
			if (isDiscriminated(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isDiscriminated);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No discriminated union" };
		},
	},
	{
		id: "pi-prime-21",
		name: "Shape-Discriminated Union",
		family: "E",
		description: "Union discriminated by disjoint key sets, no shared literal tag",
		evaluate(term: TypeTerm) {
			function isShapeDiscriminated(n: TypeTerm): boolean {
				if (n.kind !== "apply" || n.constructor !== "union" || n.args.length < 2) return false;
				const keySets = n.args.map((a: TypeTerm) => {
					if (a.kind !== "apply" || a.constructor !== "product" || !a.fields)
						return new Set<string>();
					return new Set(a.fields.map((f) => f.name));
				});
				for (let i = 0; i < keySets.length; i++) {
					for (let j = i + 1; j < keySets.length; j++) {
						const ki = keySets[i]!;
						const kj = keySets[j]!;
						const same = [...ki].every((k) => kj.has(k)) && [...kj].every((k) => ki.has(k));
						if (same) return false;
					}
				}
				return keySets.length >= 2;
			}
			if (isShapeDiscriminated(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isShapeDiscriminated);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No shape-discriminated union" };
		},
	},
	{
		id: "pi-prime-22",
		name: "Exhaustive / Closed Union",
		family: "E",
		meta: "meta-annot",
		description: "Union with meta-assertion that case set is complete",
		evaluate(term: TypeTerm) {
			const isExhaustive = (n: TypeTerm) => isUnion(n) && n.annotations?.exhaustive === true;
			if (isExhaustive(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isExhaustive);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No exhaustive union" };
		},
	},
];
