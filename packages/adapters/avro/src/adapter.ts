// Apache Avro adapter.
//
// Implement IRAdapter<Signature, AvroSchema> using descriptor objects
// that represent Avro schema definitions, not the actual avro-js library.

import type { IRAdapter, Signature, TypeTerm } from "@typecarta/core";
import {
	array,
	base,
	bottom,
	createSignature,
	field,
	literal,
	map,
	product,
	top,
	union,
} from "@typecarta/core";

// ─── Descriptor types ──────────────────────────────────────────────

/** Describe a single field within an Avro record schema. */
export interface AvroFieldDescriptor {
	name: string;
	type: AvroSchema;
	default?: unknown;
	order?: "ascending" | "descending" | "ignore";
}

/** A descriptor object representing an Apache Avro schema. */
export type AvroSchema =
	| "null"
	| "boolean"
	| "int"
	| "long"
	| "float"
	| "double"
	| "bytes"
	| "string"
	| { type: "record"; name: string; namespace?: string; fields: AvroFieldDescriptor[] }
	| { type: "array"; items: AvroSchema }
	| { type: "map"; values: AvroSchema }
	| { type: "enum"; name: string; symbols: string[] }
	| { type: "fixed"; name: string; size: number }
	| AvroSchema[]; // union

// ─── Signature ─────────────────────────────────────────────────────

const AVRO_SIGNATURE: Signature = createSignature(
	["null", "boolean", "int", "long", "float", "double", "bytes", "string"],
	[
		{ name: "record", arity: 1 },
		{ name: "array", arity: 1 },
		{ name: "map", arity: 2 },
		{ name: "union", arity: 2 },
		{ name: "enum", arity: 1 },
		{ name: "fixed", arity: 1 },
	],
);

// ─── Adapter class ─────────────────────────────────────────────────

/** Convert between Apache Avro schema descriptors and the typecarta IR. */
export class AvroAdapter implements IRAdapter<Signature, AvroSchema> {
	readonly name = "Apache Avro";
	readonly signature = AVRO_SIGNATURE;

	/**
	 * Parse an Avro schema descriptor into a TypeTerm.
	 * @param source - Avro schema descriptor to parse.
	 * @returns Equivalent TypeTerm representation.
	 */
	parse(source: AvroSchema): TypeTerm {
		return parseAvroSchema(source);
	}

	/**
	 * Encode a TypeTerm into an Avro schema descriptor.
	 * @param term - TypeTerm to encode.
	 * @returns Equivalent Avro schema descriptor.
	 */
	encode(term: TypeTerm): AvroSchema {
		return encodeToAvroSchema(term);
	}

	/**
	 * Check whether a TypeTerm can be encoded as an Avro schema.
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

// Convert an AvroSchema descriptor into a TypeTerm.
function parseAvroSchema(schema: AvroSchema): TypeTerm {
	// Primitive string types
	if (typeof schema === "string") {
		return base(schema);
	}

	// Union (array of schemas)
	if (Array.isArray(schema)) {
		if (schema.length === 0) return bottom();
		if (schema.length === 1) return parseAvroSchema(schema[0] ?? "null");
		return union(schema.map(parseAvroSchema));
	}

	// Complex types
	switch (schema.type) {
		case "record": {
			const fields = schema.fields.map((f) => {
				const hasDefault = f.default !== undefined;
				return field(f.name, parseAvroSchema(f.type), {
					optional: hasDefault,
					...(hasDefault ? { defaultValue: f.default } : {}),
				});
			});
			return product(fields);
		}
		case "array":
			return array(parseAvroSchema(schema.items));
		case "map":
			return map(base("string"), parseAvroSchema(schema.values));
		case "enum":
			return union(schema.symbols.map((s) => literal(s)));
		case "fixed":
			return base("bytes");
		default:
			return top();
	}
}

// ─── Encode ────────────────────────────────────────────────────────

// Encode a TypeTerm into an AvroSchema descriptor.
function encodeToAvroSchema(term: TypeTerm): AvroSchema {
	switch (term.kind) {
		case "bottom":
			// Avro has no bottom type; empty union is closest
			return [];
		case "top":
			throw new Error("Cannot encode top type to Avro (no universal type)");
		case "literal":
			// Literal string values become single-symbol enums
			if (typeof term.value === "string") {
				return { type: "enum", name: "LiteralEnum", symbols: [term.value] };
			}
			throw new Error(`Cannot encode literal ${JSON.stringify(term.value)} to Avro`);
		case "base":
			return encodeBaseToAvro(term.name);
		case "apply":
			return encodeApply(term);
		default:
			throw new Error(`Cannot encode ${term.kind} to Avro`);
	}
}

// Map a base type name to an Avro primitive schema string.
function encodeBaseToAvro(name: string): AvroSchema {
	const primitives = new Set([
		"null",
		"boolean",
		"int",
		"long",
		"float",
		"double",
		"bytes",
		"string",
	]);
	if (primitives.has(name)) {
		return name as AvroSchema;
	}
	throw new Error(`Cannot encode base type "${name}" to Avro`);
}

// Encode an apply-kind TypeTerm into the corresponding Avro complex type.
function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): AvroSchema {
	switch (term.constructor) {
		case "product": {
			const fields: AvroFieldDescriptor[] = (term.fields ?? []).map((f) => ({
				name: f.name,
				type: encodeToAvroSchema(f.type),
				...(f.defaultValue !== undefined ? { default: f.defaultValue } : {}),
			}));
			return { type: "record", name: "Record", fields };
		}
		case "array":
			if (term.args[0] === undefined)
				throw new Error("Array type requires an element type argument");
			return { type: "array", items: encodeToAvroSchema(term.args[0]) };
		case "map":
			// Avro maps always have string keys
			if (term.args[1] === undefined) throw new Error("Map type requires a value type argument");
			return { type: "map", values: encodeToAvroSchema(term.args[1]) };
		case "union":
			return term.args.map(encodeToAvroSchema);
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to Avro`);
	}
}

// ─── Inhabitation ──────────────────────────────────────────────────

// Check whether a value inhabits a TypeTerm under Avro semantics.
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
				case "null":
					return value === null;
				case "boolean":
					return typeof value === "boolean";
				case "int":
				case "long":
					return typeof value === "number" && Number.isInteger(value);
				case "float":
				case "double":
					return typeof value === "number";
				case "bytes":
					return (
						value instanceof Uint8Array ||
						(Array.isArray(value) &&
							value.every((b) => typeof b === "number" && b >= 0 && b <= 255))
					);
				case "string":
					return typeof value === "string";
				default:
					return false;
			}
		case "apply":
			return checkApplyInhabitation(value, term);
		default:
			return false;
	}
}

// Check inhabitation for apply-kind terms (product, array, union, map).
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
			return (
				Array.isArray(value) &&
				term.args[0] !== undefined &&
				value.every((v) => checkInhabitation(v, term.args[0]))
			);
		case "union":
			return term.args.some((a) => checkInhabitation(value, a));
		case "map": {
			if (typeof value !== "object" || value === null) return false;
			const obj = value as Record<string, unknown>;
			const keyType = term.args[0];
			const valueType = term.args[1];
			if (keyType === undefined || valueType === undefined) return false;
			return Object.entries(obj).every(
				([k, v]) => checkInhabitation(k, keyType) && checkInhabitation(v, valueType),
			);
		}
		default:
			return false;
	}
}
