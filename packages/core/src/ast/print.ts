// Print
// Pretty-print TypeTerm AST nodes as human-readable strings.

import type { FieldDescriptor, RefinementPredicate, TypeTerm } from "./type-term.js";

/**
 * Pretty-print a {@link TypeTerm} as a human-readable string.
 * @param term - The type term to render.
 * @returns A string representation using mathematical notation where applicable.
 */
export function printTerm(term: TypeTerm): string {
	switch (term.kind) {
		case "bottom":
			return "⊥";
		case "top":
			return "⊤";
		case "literal":
			return typeof term.value === "string" ? `"${term.value}"` : String(term.value);
		case "base":
			return term.name;
		case "var":
			return term.name;
		case "apply":
			return printApply(term);
		case "forall":
			return printForall(term);
		case "mu":
			return `μ${term.var}. ${printTerm(term.body)}`;
		case "refinement":
			return `{v: ${printTerm(term.base)} | ${printPredicate(term.predicate)}}`;
		case "complement":
			return `¬${printTerm(term.inner)}`;
		case "keyof":
			return `keyof ${printTerm(term.inner)}`;
		case "conditional":
			return `${printTerm(term.check)} extends ${printTerm(term.extends)} ? ${printTerm(term.then)} : ${printTerm(term.else)}`;
		case "mapped":
			return `{[K in ${printTerm(term.keySource)}]: ${printTerm(term.valueTransform)}}`;
		case "rowpoly":
			return `{${term.fields.map(printField).join(", ")} | ${term.rowVar}}`;
		case "nominal":
			return term.sealed
				? `opaque(${term.tag}, ${printTerm(term.inner)})`
				: `nominal(${term.tag}, ${printTerm(term.inner)})`;
		case "let":
			return `let ${term.name} = ${printTerm(term.binding)} in ${printTerm(term.body)}`;
		case "extension":
			return `extension<${term.extensionKind}>`;
	}
}

function printApply(term: Extract<TypeTerm, { kind: "apply" }>): string {
	switch (term.constructor) {
		case "product": {
			const fields = term.fields ?? [];
			return `{${fields.map(printField).join(", ")}}`;
		}
		case "union":
			return term.args.map(printTerm).join(" | ");
		case "intersection":
			return term.args.map(printTerm).join(" & ");
		case "array":
			return `${printTerm(term.args[0]!)}[]`;
		case "set":
			return `Set<${printTerm(term.args[0]!)}>`;
		case "map":
			return `Map<${printTerm(term.args[0]!)}, ${printTerm(term.args[1]!)}>`;
		case "arrow": {
			const params = term.args.slice(0, -1).map(printTerm).join(", ");
			const ret = printTerm(term.args[term.args.length - 1]!);
			return `(${params}) => ${ret}`;
		}
		case "tuple":
			return `[${term.args.map(printTerm).join(", ")}]`;
		case "concat":
			return `\`${term.args.map(printTerm).join("")}\``;
		default:
			return `${term.constructor}(${term.args.map(printTerm).join(", ")})`;
	}
}

function printForall(term: Extract<TypeTerm, { kind: "forall" }>): string {
	let param = term.var;
	if (term.variance) {
		const prefix =
			term.variance === "covariant" ? "+" : term.variance === "contravariant" ? "-" : "";
		param = `${prefix}${param}`;
	}
	if (term.bound) param = `${param} extends ${printTerm(term.bound)}`;
	if (term.default) param = `${param} = ${printTerm(term.default)}`;
	return `Λ${param}. ${printTerm(term.body)}`;
}

function printField(f: FieldDescriptor): string {
	const ro = f.readonly ? "readonly " : "";
	const opt = f.optional ? "?" : "";
	return `${ro}${f.name}${opt}: ${printTerm(f.type)}`;
}

function printPredicate(p: RefinementPredicate): string {
	switch (p.kind) {
		case "range": {
			const parts: string[] = [];
			if (p.min !== undefined) parts.push(`v >= ${p.min}`);
			if (p.max !== undefined) parts.push(`v <= ${p.max}`);
			return parts.join(" ∧ ") || "true";
		}
		case "pattern":
			return `v ~ /${p.regex}/`;
		case "multipleOf":
			return `v mod ${p.divisor} = 0`;
		case "custom":
			return p.name;
		case "and":
			return `(${printPredicate(p.left)} ∧ ${printPredicate(p.right)})`;
		case "or":
			return `(${printPredicate(p.left)} ∨ ${printPredicate(p.right)})`;
		case "not":
			return `¬(${printPredicate(p.inner)})`;
	}
}
