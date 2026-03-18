// Free Variables
// Extract free type variables from TypeTerm trees.

import { children } from "./traversal.js";
import type { TypeTerm } from "./type-term.js";

/**
 * Extract all free type variables from a TypeTerm.
 * @param term - The type term to analyze.
 * @returns A read-only set of free variable names.
 * @remarks Binding forms (forall, mu, let, rowpoly) introduce bound variables
 * that shadow free occurrences in their bodies.
 */
export function freeVars(term: TypeTerm): ReadonlySet<string> {
	const result = new Set<string>();
	collectFreeVars(term, new Set(), result);
	return result;
}

function collectFreeVars(term: TypeTerm, bound: ReadonlySet<string>, result: Set<string>): void {
	switch (term.kind) {
		case "var":
			if (!bound.has(term.name)) result.add(term.name);
			return;

		case "forall": {
			const newBound = new Set(bound);
			newBound.add(term.var);
			if (term.bound) collectFreeVars(term.bound, bound, result);
			if (term.default) collectFreeVars(term.default, bound, result);
			collectFreeVars(term.body, newBound, result);
			return;
		}

		case "mu": {
			const newBound = new Set(bound);
			newBound.add(term.var);
			collectFreeVars(term.body, newBound, result);
			return;
		}

		case "let": {
			collectFreeVars(term.binding, bound, result);
			const newBound = new Set(bound);
			newBound.add(term.name);
			collectFreeVars(term.body, newBound, result);
			return;
		}

		case "rowpoly": {
			const newBound = new Set(bound);
			newBound.add(term.rowVar);
			for (const f of term.fields) {
				collectFreeVars(f.type, newBound, result);
			}
			return;
		}

		default:
			for (const child of children(term)) {
				collectFreeVars(child, bound, result);
			}
	}
}

/**
 * Check whether a variable occurs free in a term.
 * @param varName - The variable name to search for.
 * @param term - The type term to search within.
 * @returns `true` if `varName` appears free in `term`.
 */
export function occursFree(varName: string, term: TypeTerm): boolean {
	return freeVars(term).has(varName);
}
