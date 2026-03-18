// TypeScript type adapter.
//
// Implement IRAdapter<Signature, TSTypeDescriptor> using descriptor objects
// that represent TypeScript types, not the actual TypeScript compiler API.

import type { IRAdapter, Signature, TypeTerm } from "@typecarta/core";
import {
	array,
	base,
	bottom,
	createSignature,
	field,
	intersection,
	literal,
	map,
	product,
	top,
	tuple,
	union,
} from "@typecarta/core";

// ─── Descriptor types — discriminated union of TS type descriptors ──

/** Represent a TypeScript type as a plain descriptor object. */
export type TSTypeDescriptor =
	| { type: "string" }
	| { type: "number" }
	| { type: "boolean" }
	| { type: "null" }
	| { type: "undefined" }
	| { type: "void" }
	| { type: "never" }
	| { type: "unknown" }
	| { type: "any" }
	| { type: "symbol" }
	| { type: "bigint" }
	| { type: "literal"; value: string | number | boolean | null }
	| {
			type: "object";
			properties: Record<
				string,
				{ type: TSTypeDescriptor; optional?: boolean; readonly?: boolean }
			>;
	  }
	| { type: "array"; element: TSTypeDescriptor }
	| { type: "tuple"; elements: TSTypeDescriptor[] }
	| { type: "union"; members: TSTypeDescriptor[] }
	| { type: "intersection"; members: TSTypeDescriptor[] }
	| { type: "record"; key: TSTypeDescriptor; value: TSTypeDescriptor }
	| { type: "enum"; members: Record<string, string | number> };

// ─── Signature — base sorts and type constructors for the TS adapter ──

const TS_SIGNATURE: Signature = createSignature(
	[
		"string",
		"number",
		"boolean",
		"null",
		"undefined",
		"void",
		"never",
		"unknown",
		"symbol",
		"bigint",
	],
	[
		{ name: "product", arity: 1 },
		{ name: "array", arity: 1 },
		{ name: "union", arity: 2 },
		{ name: "intersection", arity: 2 },
		{ name: "tuple", arity: 1 },
		{ name: "map", arity: 2 },
	],
);

// ─── Adapter class — IRAdapter implementation for TypeScript descriptors ──

/** Adapt TypeScript type descriptors to and from the typecarta IR. */
export class TypeScriptAdapter implements IRAdapter<Signature, TSTypeDescriptor> {
	readonly name = "TypeScript";
	readonly signature = TS_SIGNATURE;

	/**
	 * Parse a TS type descriptor into an IR type term.
	 *
	 * @param source - TS type descriptor to parse.
	 * @returns The corresponding IR {@link TypeTerm}.
	 */
	parse(source: TSTypeDescriptor): TypeTerm {
		return parseTSDescriptor(source);
	}

	/**
	 * Encode an IR type term back into a TS type descriptor.
	 *
	 * @param term - IR type term to encode.
	 * @returns The corresponding {@link TSTypeDescriptor}.
	 * @throws Error if the term contains constructs not representable in TypeScript.
	 */
	encode(term: TypeTerm): TSTypeDescriptor {
		return encodeToTSDescriptor(term);
	}

	/**
	 * Check whether an IR type term can be encoded as a TS descriptor.
	 *
	 * @param term - IR type term to test.
	 * @returns `true` if encoding would succeed, `false` otherwise.
	 */
	isEncodable(term: TypeTerm): boolean {
		try {
			this.encode(term);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Check whether a runtime value inhabits an IR type term.
	 *
	 * @param value - Runtime value to test.
	 * @param term - IR type term describing the expected type.
	 * @returns `true` if the value satisfies the type.
	 */
	inhabits(value: unknown, term: TypeTerm): boolean {
		return checkInhabitation(value, term);
	}

	/**
	 * Check structural assignability between two IR type terms (a <: b).
	 *
	 * @param a - Candidate subtype.
	 * @param b - Candidate supertype.
	 * @returns `true` if `a` is structurally assignable to `b`.
	 */
	operationalSubtype(a: TypeTerm, b: TypeTerm): boolean {
		return checkStructuralAssignability(a, b);
	}
}

// ─── Parse — convert TS descriptors to IR terms ──

function parseTSDescriptor(desc: TSTypeDescriptor): TypeTerm {
	switch (desc.type) {
		case "string":
			return base("string");
		case "number":
			return base("number");
		case "boolean":
			return base("boolean");
		case "null":
			return base("null");
		case "undefined":
			return base("undefined");
		case "void":
			return base("void");
		case "never":
			return bottom();
		case "unknown":
		case "any":
			return top();
		case "symbol":
			return base("symbol");
		case "bigint":
			return base("bigint");
		case "literal":
			return literal(desc.value);
		case "object": {
			const fields = Object.entries(desc.properties).map(([name, prop]) =>
				field(name, parseTSDescriptor(prop.type), {
					optional: prop.optional,
					readonly: prop.readonly,
				}),
			);
			return product(fields);
		}
		case "array":
			return array(parseTSDescriptor(desc.element));
		case "tuple":
			return tuple(desc.elements.map(parseTSDescriptor));
		case "union":
			return union(desc.members.map(parseTSDescriptor));
		case "intersection":
			return intersection(desc.members.map(parseTSDescriptor));
		case "record":
			return map(parseTSDescriptor(desc.key), parseTSDescriptor(desc.value));
		case "enum":
			return union(Object.values(desc.members).map((v) => literal(v)));
		default:
			return top();
	}
}

// ─── Encode — convert IR terms back to TS descriptors ──

function encodeToTSDescriptor(term: TypeTerm): TSTypeDescriptor {
	switch (term.kind) {
		case "bottom":
			return { type: "never" };
		case "top":
			return { type: "unknown" };
		case "literal":
			return { type: "literal", value: term.value };
		case "base":
			switch (term.name) {
				case "string":
					return { type: "string" };
				case "number":
					return { type: "number" };
				case "boolean":
					return { type: "boolean" };
				case "null":
					return { type: "null" };
				case "undefined":
					return { type: "undefined" };
				case "void":
					return { type: "void" };
				case "symbol":
					return { type: "symbol" };
				case "bigint":
					return { type: "bigint" };
				default:
					throw new Error(`Cannot encode base type "${term.name}" to TypeScript`);
			}
		case "apply":
			return encodeApply(term);
		default:
			throw new Error(`Cannot encode ${term.kind} to TypeScript`);
	}
}

function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): TSTypeDescriptor {
	switch (term.constructor) {
		case "product": {
			const properties: Record<
				string,
				{ type: TSTypeDescriptor; optional?: boolean; readonly?: boolean }
			> = {};
			for (const f of term.fields ?? []) {
				properties[f.name] = {
					type: encodeToTSDescriptor(f.type),
					...(f.optional ? { optional: true } : {}),
					...(f.readonly ? { readonly: true } : {}),
				};
			}
			return { type: "object", properties };
		}
		case "array": {
			const el = term.args[0];
			if (!el) throw new Error("array constructor requires one argument");
			return { type: "array", element: encodeToTSDescriptor(el) };
		}
		case "tuple":
			return { type: "tuple", elements: term.args.map(encodeToTSDescriptor) };
		case "union":
			return { type: "union", members: term.args.map(encodeToTSDescriptor) };
		case "intersection":
			return { type: "intersection", members: term.args.map(encodeToTSDescriptor) };
		case "map": {
			const keyArg = term.args[0];
			const valArg = term.args[1];
			if (!keyArg || !valArg) throw new Error("map constructor requires two arguments");
			return {
				type: "record",
				key: encodeToTSDescriptor(keyArg),
				value: encodeToTSDescriptor(valArg),
			};
		}
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to TypeScript`);
	}
}

// ─── Inhabitation — runtime value-in-type checks ──

function checkInhabitation(value: unknown, term: TypeTerm): boolean {
	switch (term.kind) {
		case "bottom":
			return false;
		case "top":
			return true;
		case "literal":
			return value === term.value;
		case "base":
			switch (term.name) {
				case "string":
					return typeof value === "string";
				case "number":
					return typeof value === "number";
				case "boolean":
					return typeof value === "boolean";
				case "null":
					return value === null;
				case "undefined":
					return value === undefined;
				case "void":
					return value === undefined;
				case "symbol":
					return typeof value === "symbol";
				case "bigint":
					return typeof value === "bigint";
				default:
					return false;
			}
		case "apply":
			return checkApplyInhabitation(value, term);
		default:
			return false;
	}
}

function checkApplyInhabitation(
	value: unknown,
	term: Extract<TypeTerm, { kind: "apply" }>,
): boolean {
	switch (term.constructor) {
		case "product": {
			if (typeof value !== "object" || value === null) return false;
			const obj = value as Record<string, unknown>;
			for (const f of term.fields ?? []) {
				if (!f.optional && !(f.name in obj)) return false;
				if (f.name in obj && !checkInhabitation(obj[f.name], f.type)) return false;
			}
			return true;
		}
		case "array": {
			const elType = term.args[0];
			return Array.isArray(value) && !!elType && value.every((v) => checkInhabitation(v, elType));
		}
		case "tuple":
			return (
				Array.isArray(value) &&
				value.length === term.args.length &&
				term.args.every((t, i) => checkInhabitation(value[i], t))
			);
		case "union":
			return term.args.some((a) => checkInhabitation(value, a));
		case "intersection":
			return term.args.every((a) => checkInhabitation(value, a));
		case "map": {
			if (typeof value !== "object" || value === null) return false;
			const keyType = term.args[0];
			const valType = term.args[1];
			if (!keyType || !valType) return false;
			const obj = value as Record<string, unknown>;
			return Object.entries(obj).every(
				([k, v]) => checkInhabitation(k, keyType) && checkInhabitation(v, valType),
			);
		}
		default:
			return false;
	}
}

// ─── Structural assignability — simplified a <: b mirroring TS rules ──

// Check structural assignability (a <: b) using TypeScript's structural rules.
function checkStructuralAssignability(a: TypeTerm, b: TypeTerm): boolean {
	// bottom is subtype of everything
	if (a.kind === "bottom") return true;
	// everything is subtype of top
	if (b.kind === "top") return true;
	// top is not subtype of anything except top
	if (a.kind === "top") return b.kind === "top";
	// bottom is supertype of nothing except bottom
	if (b.kind === "bottom") return a.kind === "bottom";

	// same literal
	if (a.kind === "literal" && b.kind === "literal") return a.value === b.value;

	// literal assignable to its base type
	if (a.kind === "literal" && b.kind === "base") {
		if (b.name === "string" && typeof a.value === "string") return true;
		if (b.name === "number" && typeof a.value === "number") return true;
		if (b.name === "boolean" && typeof a.value === "boolean") return true;
		if (b.name === "null" && a.value === null) return true;
		return false;
	}

	// same base type
	if (a.kind === "base" && b.kind === "base") return a.name === b.name;

	// union: a union is subtype of b if every branch of a is subtype of b
	if (a.kind === "apply" && a.constructor === "union") {
		return a.args.every((branch) => checkStructuralAssignability(branch, b));
	}
	// b is a union: a is subtype if a is subtype of some branch
	if (b.kind === "apply" && b.constructor === "union") {
		return b.args.some((branch) => checkStructuralAssignability(a, branch));
	}

	// intersection: a is subtype of an intersection if a is subtype of every member
	if (b.kind === "apply" && b.constructor === "intersection") {
		return b.args.every((member) => checkStructuralAssignability(a, member));
	}
	// a is an intersection: a is subtype of b if some member of a is subtype of b
	if (a.kind === "apply" && a.constructor === "intersection") {
		return a.args.some((member) => checkStructuralAssignability(member, b));
	}

	// product (structural): a product is subtype if it has all required fields of b
	if (
		a.kind === "apply" &&
		a.constructor === "product" &&
		b.kind === "apply" &&
		b.constructor === "product"
	) {
		const aFields = new Map((a.fields ?? []).map((f) => [f.name, f]));
		for (const bf of b.fields ?? []) {
			const af = aFields.get(bf.name);
			if (!af) {
				if (!bf.optional) return false;
				continue;
			}
			if (!checkStructuralAssignability(af.type, bf.type)) return false;
			// optional in a but required in b is not assignable
			if (af.optional && !bf.optional) return false;
		}
		return true;
	}

	// array covariance
	if (
		a.kind === "apply" &&
		a.constructor === "array" &&
		b.kind === "apply" &&
		b.constructor === "array"
	) {
		const aEl = a.args[0];
		const bEl = b.args[0];
		if (!aEl || !bEl) return false;
		return checkStructuralAssignability(aEl, bEl);
	}

	// tuple: same length, element-wise subtype
	if (
		a.kind === "apply" &&
		a.constructor === "tuple" &&
		b.kind === "apply" &&
		b.constructor === "tuple"
	) {
		if (a.args.length !== b.args.length) return false;
		return a.args.every((at, i) => {
			const bt = b.args[i];
			return bt !== undefined && checkStructuralAssignability(at, bt);
		});
	}

	// map covariance on value
	if (
		a.kind === "apply" &&
		a.constructor === "map" &&
		b.kind === "apply" &&
		b.constructor === "map"
	) {
		const aKey = a.args[0];
		const aVal = a.args[1];
		const bKey = b.args[0];
		const bVal = b.args[1];
		if (!aKey || !aVal || !bKey || !bVal) return false;
		return checkStructuralAssignability(aKey, bKey) && checkStructuralAssignability(aVal, bVal);
	}

	return false;
}
