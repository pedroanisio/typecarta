import { collect } from "../../ast/traversal.js";
/** Family I — Nominal & Branding (π'₃₄–π'₃₇). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_I: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-34",
		name: "Structural Identity Only",
		family: "I",
		description: "No nominal tags — type identity determined purely by structure",
		evaluate(term: TypeTerm) {
			const nominals = collect(term, (n) => n.kind === "nominal");
			return nominals.length === 0
				? { status: "satisfied" }
				: { status: "not-satisfied", reason: "Nominal nodes present — not purely structural" };
		},
	},
	{
		id: "pi-prime-35",
		name: "Nominal Tag / Brand",
		family: "I",
		refines: "pi-12",
		description: "nominal(Tag, τ) — type distinguished by a nominal tag",
		evaluate(term: TypeTerm) {
			if (term.kind === "nominal") return { status: "satisfied", witness: term };
			const m = collect(term, (n) => n.kind === "nominal");
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No nominal tag node" };
		},
	},
	{
		id: "pi-prime-36",
		name: "Opaque / Newtype Wrapper",
		family: "I",
		description: "Sealed nominal — inner type hidden from structural matching",
		evaluate(term: TypeTerm) {
			const isOpaque = (n: TypeTerm) => n.kind === "nominal" && n.sealed === true;
			if (isOpaque(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isOpaque);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No sealed nominal (opaque/newtype)" };
		},
	},
	{
		id: "pi-prime-37",
		name: "Explicit Coercion Edge",
		family: "I",
		meta: "meta-op",
		description: "Extension node encoding an explicit coercion between nominal types",
		evaluate(term: TypeTerm) {
			const isCoercion = (n: TypeTerm) => n.kind === "extension" && n.extensionKind === "coercion";
			if (isCoercion(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isCoercion);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No coercion extension node" };
		},
	},
];
