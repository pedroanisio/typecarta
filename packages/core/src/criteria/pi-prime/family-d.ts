import { collect } from "../../ast/traversal.js";
/** Family D — Shape Closure (π'₁₆–π'₁₈). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_D: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-16",
		name: "Closed Record",
		family: "D",
		description: "∀v ∈ ⟦S⟧: dom(v) = {l₁,…,lₙ} — no extra keys",
		evaluate(term: TypeTerm) {
			const isClosed = (n: TypeTerm) =>
				n.kind === "apply" &&
				n.constructor === "product" &&
				(n.fields?.length ?? 0) > 0 &&
				n.annotations?.open !== true;
			if (isClosed(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isClosed);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No closed record" };
		},
	},
	{
		id: "pi-prime-17",
		name: "Open Record, Unconstrained Extras",
		family: "D",
		refines: "pi-13",
		description: "Known fields + arbitrary extra keys",
		evaluate(term: TypeTerm) {
			const isOpen = (n: TypeTerm) =>
				(n.kind === "apply" && n.constructor === "product" && n.annotations?.open === true) ||
				n.kind === "rowpoly";
			if (isOpen(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isOpen);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No open record" };
		},
	},
	{
		id: "pi-prime-18",
		name: "Open Record, Typed Extras",
		family: "D",
		description: "Extra keys constrained to a specific type (additionalProperties: {type: ...})",
		evaluate(term: TypeTerm) {
			const hasTypedExtras = (n: TypeTerm) =>
				n.kind === "apply" &&
				n.constructor === "product" &&
				n.annotations?.additionalProperties !== undefined;
			if (hasTypedExtras(term)) return { status: "satisfied", witness: term };
			const m = collect(term, hasTypedExtras);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No typed extras" };
		},
	},
];
