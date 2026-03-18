// Zod schema adapter for typecarta.
//
// Implement IRAdapter<Signature, ZodDescriptor> using descriptor
// objects that represent Zod schemas, not the actual Zod library
// at runtime.

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
	tuple,
	union,
} from "@typecarta/core";

// ─── Descriptor types ──────────────────────────────────────────────

/** Describe a Zod schema as a plain discriminated-union object. */
export type ZodDescriptor =
	| { type: "string" }
	| { type: "number" }
	| { type: "boolean" }
	| { type: "date" }
	| { type: "null" }
	| { type: "undefined" }
	| { type: "literal"; value: string | number | boolean | null }
	| { type: "object"; shape: Record<string, ZodDescriptor>; optional?: string[] }
	| { type: "array"; element: ZodDescriptor }
	| { type: "tuple"; elements: ZodDescriptor[] }
	| { type: "union"; options: ZodDescriptor[] }
	| { type: "intersection"; left: ZodDescriptor; right: ZodDescriptor }
	| { type: "optional"; inner: ZodDescriptor }
	| { type: "nullable"; inner: ZodDescriptor }
	| { type: "enum"; values: string[] }
	| { type: "never" }
	| { type: "any" }
	| { type: "unknown" };

// ─── Signature ─────────────────────────────────────────────────────

const ZOD_SIGNATURE: Signature = createSignature(
	["string", "number", "boolean", "date", "null", "undefined"],
	[
		{ name: "product", arity: 1 },
		{ name: "array", arity: 1 },
		{ name: "union", arity: 2 },
		{ name: "intersection", arity: 2 },
		{ name: "tuple", arity: 1 },
	],
);

// ─── Adapter class ─────────────────────────────────────────────────

/** Convert between Zod schema descriptors and typecarta IR type terms. */
export class ZodAdapter implements IRAdapter<Signature, ZodDescriptor> {
	readonly name = "Zod";
	readonly signature = ZOD_SIGNATURE;

	/**
	 * Parse a Zod descriptor into an IR type term.
	 *
	 * @param source - Zod schema descriptor to parse.
	 * @returns The equivalent IR {@link TypeTerm}.
	 */
	parse(source: ZodDescriptor): TypeTerm {
		return parseZodDescriptor(source);
	}

	/**
	 * Encode an IR type term into a Zod descriptor.
	 *
	 * @param term - IR type term to encode.
	 * @returns The equivalent {@link ZodDescriptor}.
	 * @throws Error if the term contains constructs not representable in Zod.
	 */
	encode(term: TypeTerm): ZodDescriptor {
		return encodeToZodDescriptor(term);
	}

	/**
	 * Test whether a type term can be encoded as a Zod descriptor.
	 *
	 * @param term - IR type term to check.
	 * @returns `true` when {@link encode} would succeed for this term.
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
	 * Check whether a runtime value inhabits the given type term.
	 *
	 * @param value - Runtime value to test.
	 * @param term - IR type term describing the expected type.
	 * @returns `true` when the value satisfies the type.
	 */
	inhabits(value: unknown, term: TypeTerm): boolean {
		return checkInhabitation(value, term);
	}
}

// ─── Parse ─────────────────────────────────────────────────────────

// Convert a ZodDescriptor into an IR TypeTerm via recursive pattern match.
function parseZodDescriptor(desc: ZodDescriptor): TypeTerm {
	switch (desc.type) {
		case "string":
			return base("string");
		case "number":
			return base("number");
		case "boolean":
			return base("boolean");
		case "date":
			return base("date");
		case "null":
			return base("null");
		case "undefined":
			return base("undefined");
		case "literal":
			return literal(desc.value);
		case "never":
			return bottom();
		case "any":
		case "unknown":
			return top();
		case "object": {
			const optionalSet = new Set(desc.optional ?? []);
			const fields = Object.entries(desc.shape).map(([name, schema]) =>
				field(name, parseZodDescriptor(schema), { optional: optionalSet.has(name) }),
			);
			return product(fields);
		}
		case "array":
			return array(parseZodDescriptor(desc.element));
		case "tuple":
			return tuple(desc.elements.map(parseZodDescriptor));
		case "union":
			return union(desc.options.map(parseZodDescriptor));
		case "intersection":
			return intersection([parseZodDescriptor(desc.left), parseZodDescriptor(desc.right)]);
		case "optional":
			return union([parseZodDescriptor(desc.inner), base("undefined")]);
		case "nullable":
			return union([parseZodDescriptor(desc.inner), base("null")]);
		case "enum":
			return union(desc.values.map((v) => literal(v)));
		default:
			return top();
	}
}

// ─── Encode ────────────────────────────────────────────────────────

// Convert an IR TypeTerm back into a ZodDescriptor.
function encodeToZodDescriptor(term: TypeTerm): ZodDescriptor {
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
				case "date":
					return { type: "date" };
				case "null":
					return { type: "null" };
				case "undefined":
					return { type: "undefined" };
				default:
					throw new Error(`Cannot encode base type "${term.name}" to Zod`);
			}
		case "apply":
			return encodeApply(term);
		default:
			throw new Error(`Cannot encode ${term.kind} to Zod`);
	}
}

// Encode an "apply" term (product, array, tuple, union, intersection).
function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): ZodDescriptor {
	switch (term.constructor) {
		case "product": {
			const shape: Record<string, ZodDescriptor> = {};
			const optional: string[] = [];
			for (const f of term.fields ?? []) {
				shape[f.name] = encodeToZodDescriptor(f.type);
				if (f.optional) optional.push(f.name);
			}
			return { type: "object", shape, ...(optional.length > 0 ? { optional } : {}) };
		}
		case "array":
			return { type: "array", element: encodeToZodDescriptor(term.args[0]!) };
		case "tuple":
			return { type: "tuple", elements: term.args.map(encodeToZodDescriptor) };
		case "union":
			return { type: "union", options: term.args.map(encodeToZodDescriptor) };
		case "intersection":
			if (term.args.length !== 2) {
				throw new Error("Zod intersection requires exactly 2 members");
			}
			return {
				type: "intersection",
				left: encodeToZodDescriptor(term.args[0]!),
				right: encodeToZodDescriptor(term.args[1]!),
			};
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to Zod`);
	}
}

// ─── Inhabitation ──────────────────────────────────────────────────

// Test whether a runtime value inhabits a TypeTerm.
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
				case "date":
					return value instanceof Date;
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

// Test inhabitation for "apply" terms (product, array, tuple, union, intersection).
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
		case "array":
			return Array.isArray(value) && value.every((v) => checkInhabitation(v, term.args[0]!));
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
		default:
			return false;
	}
}
