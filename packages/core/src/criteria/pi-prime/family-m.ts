import { collect } from "../../ast/traversal.js";
/** Family M — Computation Types (π'₄₈–π'₄₉). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_M: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-48",
		name: "Function / Arrow Type",
		family: "M",
		description: "First-class function type (τ₁ → τ₂)",
		evaluate(term: TypeTerm) {
			const isArrow = (n: TypeTerm) => n.kind === "apply" && n.constructor === "arrow";
			if (isArrow(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isArrow);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No function/arrow type" };
		},
	},
	{
		id: "pi-prime-49",
		name: "Overloaded Function",
		family: "M",
		description: "Intersection of arrow types representing overloaded signatures",
		evaluate(term: TypeTerm) {
			const isOverloaded = (n: TypeTerm) => {
				if (n.kind !== "apply" || n.constructor !== "intersection" || n.args.length < 2)
					return false;
				return n.args.every((a) => a.kind === "apply" && a.constructor === "arrow");
			};
			if (isOverloaded(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isOverloaded);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No overloaded function type" };
		},
	},
];
