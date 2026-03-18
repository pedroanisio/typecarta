// Substitution
// Perform capture-avoiding substitution on TypeTerm trees, renaming
// bound variables as needed to prevent variable capture.

import { freeVars } from "./free-vars.js";
import type { FieldDescriptor, TypeTerm } from "./type-term.js";

let counter = 0;

function freshVar(base: string): string {
	return `${base}$${++counter}`;
}

/**
 * Reset the fresh variable counter to zero.
 * @remarks Intended for test isolation only.
 */
export function resetFreshCounter(): void {
	counter = 0;
}

/**
 * Perform capture-avoiding substitution: term[varName := replacement].
 * @param term - The type term in which to substitute.
 * @param varName - The variable name to replace.
 * @param replacement - The type term to substitute in place of `varName`.
 * @returns A new TypeTerm with all free occurrences of `varName` replaced.
 */
export function substitute(term: TypeTerm, varName: string, replacement: TypeTerm): TypeTerm {
	switch (term.kind) {
		case "var":
			return term.name === varName ? replacement : term;

		case "bottom":
		case "top":
		case "literal":
		case "base":
			return term;

		case "apply": {
			const newArgs = term.args.map((a) => substitute(a, varName, replacement));
			const newFields = term.fields?.map((f) => substField(f, varName, replacement));
			return { ...term, args: newArgs, ...(newFields ? { fields: newFields } : {}) };
		}

		case "forall": {
			if (term.var === varName) {
				// varName is shadowed — only substitute in bound/default, not body
				return {
					...term,
					...(term.bound ? { bound: substitute(term.bound, varName, replacement) } : {}),
					...(term.default ? { default: substitute(term.default, varName, replacement) } : {}),
				};
			}
			const repFV = freeVars(replacement);
			if (repFV.has(term.var)) {
				// Rename to avoid capture
				const fresh = freshVar(term.var);
				const renamedBody = substitute(term.body, term.var, { kind: "var", name: fresh });
				return {
					...term,
					var: fresh,
					body: substitute(renamedBody, varName, replacement),
					...(term.bound ? { bound: substitute(term.bound, varName, replacement) } : {}),
					...(term.default ? { default: substitute(term.default, varName, replacement) } : {}),
				};
			}
			return {
				...term,
				body: substitute(term.body, varName, replacement),
				...(term.bound ? { bound: substitute(term.bound, varName, replacement) } : {}),
				...(term.default ? { default: substitute(term.default, varName, replacement) } : {}),
			};
		}

		case "mu": {
			if (term.var === varName) return term;
			const repFV = freeVars(replacement);
			if (repFV.has(term.var)) {
				const fresh = freshVar(term.var);
				const renamedBody = substitute(term.body, term.var, { kind: "var", name: fresh });
				return { ...term, var: fresh, body: substitute(renamedBody, varName, replacement) };
			}
			return { ...term, body: substitute(term.body, varName, replacement) };
		}

		case "let": {
			const newBinding = substitute(term.binding, varName, replacement);
			if (term.name === varName) {
				return { ...term, binding: newBinding };
			}
			const repFV = freeVars(replacement);
			if (repFV.has(term.name)) {
				const fresh = freshVar(term.name);
				const renamedBody = substitute(term.body, term.name, { kind: "var", name: fresh });
				return {
					...term,
					name: fresh,
					binding: newBinding,
					body: substitute(renamedBody, varName, replacement),
				};
			}
			return { ...term, binding: newBinding, body: substitute(term.body, varName, replacement) };
		}

		case "rowpoly": {
			if (term.rowVar === varName) {
				return { ...term, fields: term.fields.map((f) => substField(f, varName, replacement)) };
			}
			const repFV = freeVars(replacement);
			if (repFV.has(term.rowVar)) {
				const fresh = freshVar(term.rowVar);
				const renamedFields = term.fields.map((f) => {
					const substituted = substitute(f.type, term.rowVar, { kind: "var", name: fresh });
					return { ...f, type: substitute(substituted, varName, replacement) };
				});
				return { ...term, rowVar: fresh, fields: renamedFields };
			}
			return { ...term, fields: term.fields.map((f) => substField(f, varName, replacement)) };
		}

		case "refinement":
			return { ...term, base: substitute(term.base, varName, replacement) };
		case "complement":
			return { ...term, inner: substitute(term.inner, varName, replacement) };
		case "keyof":
			return { ...term, inner: substitute(term.inner, varName, replacement) };
		case "conditional":
			return {
				...term,
				check: substitute(term.check, varName, replacement),
				extends: substitute(term.extends, varName, replacement),
				then: substitute(term.then, varName, replacement),
				else: substitute(term.else, varName, replacement),
			};
		case "mapped":
			return {
				...term,
				keySource: substitute(term.keySource, varName, replacement),
				valueTransform: substitute(term.valueTransform, varName, replacement),
			};
		case "nominal":
			return { ...term, inner: substitute(term.inner, varName, replacement) };
		case "extension":
			return term.children
				? { ...term, children: term.children.map((c) => substitute(c, varName, replacement)) }
				: term;
	}
}

function substField(f: FieldDescriptor, varName: string, replacement: TypeTerm): FieldDescriptor {
	return { ...f, type: substitute(f.type, varName, replacement) };
}
