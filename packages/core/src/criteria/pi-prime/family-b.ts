import { collect } from "../../ast/traversal.js";
/** Family B — Products, Records, and Tuples (π'₈–π'₁₀). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_B: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-08",
		name: "Positional Tuple",
		family: "B",
		refines: "pi-04",
		description: "Ordered, index-addressed product (τ₁, τ₂, …, τₙ)",
		evaluate(term: TypeTerm) {
			const isTuple = (n: TypeTerm) =>
				n.kind === "apply" && n.constructor === "tuple" && n.args.length >= 1;
			if (isTuple(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isTuple);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No positional tuple" };
		},
	},
	{
		id: "pi-prime-09",
		name: "Labelled Record",
		family: "B",
		refines: "pi-04",
		description: "Product with named fields {l₁: τ₁, …, lₙ: τₙ}",
		evaluate(term: TypeTerm) {
			const isRecord = (n: TypeTerm) =>
				n.kind === "apply" && n.constructor === "product" && (n.fields?.length ?? 0) > 0;
			if (isRecord(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isRecord);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No labelled record" };
		},
	},
	{
		id: "pi-prime-10",
		name: "Variadic / Rest Element",
		family: "B",
		description: "Tuple with fixed prefix and variable-length homogeneous tail",
		evaluate(term: TypeTerm) {
			// A tuple with a rest annotation, or a tuple containing an array as last element
			const isVariadic = (n: TypeTerm) => {
				if (n.kind !== "apply" || n.constructor !== "tuple" || n.args.length < 2) return false;
				const last = n.args[n.args.length - 1];
				return last !== undefined && last.kind === "apply" && last.constructor === "array";
			};
			if (isVariadic(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isVariadic);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No variadic tuple" };
		},
	},
];
