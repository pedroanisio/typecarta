// Protocol Buffers adapter.
//
// Implement IRAdapter<Signature, ProtobufDescriptor> using descriptor
// objects that represent Protobuf message definitions, not the
// protobuf-js library at runtime.

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

/** Enumerate the scalar type names supported by Protocol Buffers. */
export type ProtobufScalarType =
	| "double"
	| "float"
	| "int32"
	| "int64"
	| "uint32"
	| "uint64"
	| "sint32"
	| "sint64"
	| "fixed32"
	| "fixed64"
	| "sfixed32"
	| "sfixed64"
	| "bool"
	| "string"
	| "bytes";

/** Describe a single field within a Protobuf message or oneof group. */
export interface ProtobufFieldDescriptor {
	name: string;
	type: ProtobufDescriptor;
	number: number;
	optional?: boolean;
}

/** A descriptor object representing a Protobuf type definition. */
export type ProtobufDescriptor =
	| { type: "scalar"; scalar: ProtobufScalarType }
	| { type: "message"; name: string; fields: ProtobufFieldDescriptor[] }
	| { type: "repeated"; element: ProtobufDescriptor }
	| { type: "oneof"; name: string; options: ProtobufFieldDescriptor[] }
	| { type: "map"; key: ProtobufDescriptor; value: ProtobufDescriptor }
	| { type: "enum"; name: string; values: Record<string, number> }
	| { type: "ref"; name: string };

// ─── Signature ─────────────────────────────────────────────────────

const PROTOBUF_SIGNATURE: Signature = createSignature(
	["double", "float", "int32", "int64", "uint32", "uint64", "bool", "string", "bytes"],
	[
		{ name: "message", arity: 1 },
		{ name: "repeated", arity: 1 },
		{ name: "oneof", arity: 2 },
		{ name: "map", arity: 2 },
		{ name: "enum", arity: 1 },
	],
);

// ─── Scalar mapping ────────────────────────────────────────────────

// Map a protobuf scalar type name to its base type name in the signature.
function scalarToBase(scalar: ProtobufScalarType): string {
	switch (scalar) {
		case "double":
		case "float":
			return scalar;
		case "int32":
		case "sint32":
		case "sfixed32":
		case "fixed32":
			return "int32";
		case "int64":
		case "sint64":
		case "sfixed64":
		case "fixed64":
			return "int64";
		case "uint32":
			return "uint32";
		case "uint64":
			return "uint64";
		case "bool":
			return "bool";
		case "string":
			return "string";
		case "bytes":
			return "bytes";
	}
}

// ─── Adapter class ─────────────────────────────────────────────────

/** Adapt Protobuf type descriptors to and from the typecarta IR. */
export class ProtobufAdapter implements IRAdapter<Signature, ProtobufDescriptor> {
	readonly name = "Protocol Buffers";
	readonly signature = PROTOBUF_SIGNATURE;

	/**
	 * Parse a Protobuf type descriptor into an IR type term.
	 *
	 * @param source - Protobuf type descriptor to parse.
	 * @returns The equivalent {@link TypeTerm} in the IR.
	 */
	parse(source: ProtobufDescriptor): TypeTerm {
		return parseProtobufDescriptor(source);
	}

	/**
	 * Encode an IR type term into a Protobuf type descriptor.
	 *
	 * @param term - IR type term to encode.
	 * @returns The equivalent {@link ProtobufDescriptor}.
	 * @throws Error if the term contains constructs not representable in Protobuf.
	 */
	encode(term: TypeTerm): ProtobufDescriptor {
		return encodeToProtobufDescriptor(term);
	}

	/**
	 * Test whether an IR type term can be encoded as a Protobuf descriptor.
	 *
	 * @param term - IR type term to check.
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
	 * Check whether a runtime value inhabits the given IR type term under Protobuf semantics.
	 *
	 * @param value - Runtime value to test.
	 * @param term - IR type term describing the expected type.
	 * @returns `true` if the value inhabits the type, `false` otherwise.
	 */
	inhabits(value: unknown, term: TypeTerm): boolean {
		return checkInhabitation(value, term);
	}
}

// ─── Parse ─────────────────────────────────────────────────────────

function parseProtobufDescriptor(desc: ProtobufDescriptor): TypeTerm {
	switch (desc.type) {
		case "scalar":
			return base(scalarToBase(desc.scalar));
		case "message": {
			const fields = desc.fields.map((f) =>
				field(f.name, parseProtobufDescriptor(f.type), { optional: f.optional }),
			);
			return product(fields);
		}
		case "repeated":
			return array(parseProtobufDescriptor(desc.element));
		case "oneof":
			return union(desc.options.map((opt) => parseProtobufDescriptor(opt.type)));
		case "map":
			return map(parseProtobufDescriptor(desc.key), parseProtobufDescriptor(desc.value));
		case "enum":
			return union(Object.keys(desc.values).map((name) => literal(name)));
		case "ref":
			// References are encoded as base types by name
			return base(desc.name);
		default:
			return top();
	}
}

// ─── Encode ────────────────────────────────────────────────────────

function encodeToProtobufDescriptor(term: TypeTerm): ProtobufDescriptor {
	switch (term.kind) {
		case "base":
			return encodeBaseType(term.name);
		case "literal":
			// Literals in protobuf context are enum-like values
			if (typeof term.value === "string") {
				return { type: "enum", name: "LiteralEnum", values: { [term.value]: 0 } };
			}
			throw new Error(`Cannot encode literal ${JSON.stringify(term.value)} to Protobuf`);
		case "apply":
			return encodeApply(term);
		default:
			throw new Error(`Cannot encode ${term.kind} to Protobuf`);
	}
}

function encodeBaseType(name: string): ProtobufDescriptor {
	const scalarMap: Record<string, ProtobufScalarType> = {
		double: "double",
		float: "float",
		int32: "int32",
		int64: "int64",
		uint32: "uint32",
		uint64: "uint64",
		bool: "bool",
		string: "string",
		bytes: "bytes",
	};
	const scalar = scalarMap[name];
	if (scalar) return { type: "scalar", scalar };
	// Non-scalar base types become references
	return { type: "ref", name };
}

function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): ProtobufDescriptor {
	switch (term.constructor) {
		case "product": {
			const fields: ProtobufFieldDescriptor[] = (term.fields ?? []).map((f, i) => ({
				name: f.name,
				type: encodeToProtobufDescriptor(f.type),
				number: i + 1,
				...(f.optional ? { optional: true } : {}),
			}));
			return { type: "message", name: "Message", fields };
		}
		case "array": {
			const elementType = term.args[0];
			if (!elementType) throw new Error("Array type requires an element type argument");
			return { type: "repeated", element: encodeToProtobufDescriptor(elementType) };
		}
		case "union": {
			const options: ProtobufFieldDescriptor[] = term.args.map((a, i) => ({
				name: `option_${i}`,
				type: encodeToProtobufDescriptor(a),
				number: i + 1,
			}));
			return { type: "oneof", name: "OneOf", options };
		}
		case "map": {
			const keyType = term.args[0];
			const valueType = term.args[1];
			if (!keyType || !valueType) throw new Error("Map type requires key and value type arguments");
			return {
				type: "map",
				key: encodeToProtobufDescriptor(keyType),
				value: encodeToProtobufDescriptor(valueType),
			};
		}
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to Protobuf`);
	}
}

// ─── Inhabitation ──────────────────────────────────────────────────

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
				case "double":
				case "float":
					return typeof value === "number";
				case "int32":
				case "int64":
				case "uint32":
				case "uint64":
					return typeof value === "number" && Number.isInteger(value);
				case "bool":
					return typeof value === "boolean";
				case "string":
					return typeof value === "string";
				case "bytes":
					return (
						value instanceof Uint8Array ||
						(Array.isArray(value) &&
							value.every((b) => typeof b === "number" && b >= 0 && b <= 255))
					);
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
			const elementType = term.args[0];
			if (!elementType) return false;
			return Array.isArray(value) && value.every((v) => checkInhabitation(v, elementType));
		}
		case "union":
			return term.args.some((a) => checkInhabitation(value, a));
		case "map": {
			if (typeof value !== "object" || value === null) return false;
			const obj = value as Record<string, unknown>;
			const mapKeyType = term.args[0];
			const mapValueType = term.args[1];
			if (!mapKeyType || !mapValueType) return false;
			return Object.entries(obj).every(
				([k, v]) => checkInhabitation(k, mapKeyType) && checkInhabitation(v, mapValueType),
			);
		}
		default:
			return false;
	}
}
