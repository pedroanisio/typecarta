import { collect } from "../../ast/traversal.js";
/** Family R — Unsound / Bivariant (π'₆₀). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_R: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-60",
		name: "Unsound Bivariant Type",
		family: "R",
		meta: "meta-op",
		description: "Extension or annotation marking a type parameter as unsoundly bivariant",
		evaluate(term: TypeTerm) {
			const isBivariant = (n: TypeTerm) =>
				(n.kind === "extension" && n.extensionKind === "bivariant") ||
				n.annotations?.bivariant === true;
			if (isBivariant(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isBivariant);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No bivariant type marker" };
		},
	},
];
