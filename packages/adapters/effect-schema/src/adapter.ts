// Effect Schema adapter.
//
// Implement IRAdapter<Signature, EffectSchemaDescriptor> using descriptor
// objects that represent Effect Schema definitions, not the actual
// @effect/schema library.

import type { IRAdapter, Signature, TypeTerm } from "@typecarta/core";
import {
	array,
	base,
	bottom,
	createSignature,
	field,
	intersection,
	literal,
	product,
	top,
	union,
} from "@typecarta/core";

// ─── Descriptor types ──────────────────────────────────────────────

/** A descriptor object representing an Effect Schema definition. */
export type EffectSchemaDescriptor =
	| { type: "string" }
	| { type: "number" }
	| { type: "boolean" }
	| { type: "null" }
	| { type: "undefined" }
	| { type: "literal"; value: string | number | boolean | null }
	| {
			type: "struct";
			fields: Record<string, { schema: EffectSchemaDescriptor; optional?: boolean }>;
	  }
	| { type: "array"; element: EffectSchemaDescriptor }
	| { type: "union"; members: EffectSchemaDescriptor[] }
	| { type: "intersection"; members: EffectSchemaDescriptor[] }
	| { type: "tuple"; elements: EffectSchemaDescriptor[] }
	| { type: "optional"; inner: EffectSchemaDescriptor }
	| { type: "nullable"; inner: EffectSchemaDescriptor }
	| { type: "enums"; values: Record<string, string | number> }
	| { type: "never" }
	| { type: "unknown" }
	| { type: "any" }
	| { type: "void" };

// ─── Signature ─────────────────────────────────────────────────────

const EFFECT_SCHEMA_SIGNATURE: Signature = createSignature(
	["string", "number", "boolean", "null", "undefined"],
	[
		{ name: "struct", arity: 1 },
		{ name: "array", arity: 1 },
		{ name: "union", arity: 2 },
		{ name: "intersection", arity: 2 },
	],
);

// ─── Adapter class ─────────────────────────────────────────────────

/** Convert between Effect Schema descriptors and the typecarta IR. */
export class EffectSchemaAdapter implements IRAdapter<Signature, EffectSchemaDescriptor> {
	readonly name = "Effect Schema";
	readonly signature = EFFECT_SCHEMA_SIGNATURE;

	/**
	 * Parse an Effect Schema descriptor into a TypeTerm.
	 * @param source - Effect Schema descriptor to parse.
	 * @returns Equivalent TypeTerm representation.
	 */
	parse(source: EffectSchemaDescriptor): TypeTerm {
		return parseEffectSchemaDescriptor(source);
	}

	/**
	 * Encode a TypeTerm into an Effect Schema descriptor.
	 * @param term - TypeTerm to encode.
	 * @returns Equivalent Effect Schema descriptor.
	 */
	encode(term: TypeTerm): EffectSchemaDescriptor {
		return encodeToEffectSchemaDescriptor(term);
	}

	/**
	 * Check whether a TypeTerm can be encoded as an Effect Schema descriptor.
	 * @param term - TypeTerm to test.
	 * @returns `true` if the term is encodable, `false` otherwise.
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
	 * Test whether a value inhabits the given TypeTerm.
	 * @param value - Runtime value to check.
	 * @param term - TypeTerm describing the expected type.
	 * @returns `true` if the value inhabits the term.
	 */
	inhabits(value: unknown, term: TypeTerm): boolean {
		return checkInhabitation(value, term);
	}
}

// ─── Parse ─────────────────────────────────────────────────────────

// Convert an EffectSchemaDescriptor into a TypeTerm.
function parseEffectSchemaDescriptor(desc: EffectSchemaDescriptor): TypeTerm {
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
		case "literal":
			return literal(desc.value);
		case "never":
			return bottom();
		case "unknown":
		case "any":
			return top();
		case "void":
			return base("undefined");
		case "struct": {
			const fields = Object.entries(desc.fields).map(([name, f]) =>
				field(name, parseEffectSchemaDescriptor(f.schema), { optional: f.optional }),
			);
			return product(fields);
		}
		case "array":
			return array(parseEffectSchemaDescriptor(desc.element));
		case "tuple":
			// Effect Schema tuples are encoded as product with positional fields
			return array(
				desc.elements.length === 1
					? parseEffectSchemaDescriptor(desc.elements[0] ?? { type: "never" as const })
					: union(desc.elements.map(parseEffectSchemaDescriptor)),
			);
		case "union":
			return union(desc.members.map(parseEffectSchemaDescriptor));
		case "intersection":
			return intersection(desc.members.map(parseEffectSchemaDescriptor));
		case "optional":
			return union([parseEffectSchemaDescriptor(desc.inner), base("undefined")]);
		case "nullable":
			return union([parseEffectSchemaDescriptor(desc.inner), base("null")]);
		case "enums":
			return union(Object.values(desc.values).map((v) => literal(v)));
		default:
			return top();
	}
}

// ─── Encode ────────────────────────────────────────────────────────

// Encode a TypeTerm into an EffectSchemaDescriptor.
function encodeToEffectSchemaDescriptor(term: TypeTerm): EffectSchemaDescriptor {
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
				default:
					throw new Error(`Cannot encode base type "${term.name}" to Effect Schema`);
			}
		case "apply":
			return encodeApply(term);
		default:
			throw new Error(`Cannot encode ${term.kind} to Effect Schema`);
	}
}

// Encode an apply-kind TypeTerm into the corresponding Effect Schema complex type.
function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): EffectSchemaDescriptor {
	switch (term.constructor) {
		case "product": {
			const fields: Record<string, { schema: EffectSchemaDescriptor; optional?: boolean }> = {};
			for (const f of term.fields ?? []) {
				fields[f.name] = {
					schema: encodeToEffectSchemaDescriptor(f.type),
					...(f.optional ? { optional: true } : {}),
				};
			}
			return { type: "struct", fields };
		}
		case "array": {
			const elementArg = term.args[0];
			if (!elementArg) throw new Error("Array term missing element argument");
			return { type: "array", element: encodeToEffectSchemaDescriptor(elementArg) };
		}
		case "union":
			return { type: "union", members: term.args.map(encodeToEffectSchemaDescriptor) };
		case "intersection":
			return { type: "intersection", members: term.args.map(encodeToEffectSchemaDescriptor) };
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to Effect Schema`);
	}
}

// ─── Inhabitation ──────────────────────────────────────────────────

// Check whether a value inhabits a TypeTerm under Effect Schema semantics.
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
				default:
					return false;
			}
		case "apply":
			return checkApplyInhabitation(value, term);
		default:
			return false;
	}
}

// Check inhabitation for apply-kind terms (product, array, union, intersection).
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
			const elementType = term.args[0];
			return (
				Array.isArray(value) &&
				!!elementType &&
				value.every((v) => checkInhabitation(v, elementType))
			);
		}
		case "union":
			return term.args.some((a) => checkInhabitation(value, a));
		case "intersection":
			return term.args.every((a) => checkInhabitation(value, a));
		default:
			return false;
	}
}
