import { collect } from "../../ast/traversal.js";
/** Family V — Temporal / Stateful (π'₇₀). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { Criterion } from "./types.js";

export const FAMILY_V: readonly Criterion[] = [
	{
		id: "pi-prime-70",
		name: "State-Machine Type",
		family: "V",
		meta: "meta-op",
		description: "Extension or annotation representing a state-machine type",
		evaluate(term: TypeTerm) {
			const isStateMachine = (n: TypeTerm) =>
				(n.kind === "extension" && n.extensionKind === "state-machine") ||
				n.annotations?.stateMachine === true;
			if (isStateMachine(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isStateMachine);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No state-machine type" };
		},
	},
];
