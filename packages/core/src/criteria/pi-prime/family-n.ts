import { collect } from "../../ast/traversal.js";
/** Family N — Modularity & Scoping [meta-annot] (π'₅₀–π'₅₂). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_N: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-50",
		name: "Named Type Alias",
		family: "N",
		meta: "meta-annot",
		description: "A let-binding introducing a named type alias (let n = τ in body)",
		evaluate(term: TypeTerm) {
			const isLet = (n: TypeTerm) => n.kind === "let";
			if (isLet(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isLet);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No named type alias (let node)" };
		},
	},
	{
		id: "pi-prime-51",
		name: "Module / Namespace",
		family: "N",
		meta: "meta-annot",
		description: "Extension node representing a module or namespace grouping",
		evaluate(term: TypeTerm) {
			const isModule = (n: TypeTerm) => n.kind === "extension" && n.extensionKind === "module";
			if (isModule(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isModule);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No module/namespace extension" };
		},
	},
	{
		id: "pi-prime-52",
		name: "Visibility / Export Control",
		family: "N",
		meta: "meta-annot",
		description: "Extension or annotation controlling visibility/export of a type",
		evaluate(term: TypeTerm) {
			const isVisibility = (n: TypeTerm) =>
				(n.kind === "extension" && n.extensionKind === "visibility") ||
				n.annotations?.visibility !== undefined;
			if (isVisibility(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isVisibility);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No visibility/export control" };
		},
	},
];
