// JSON Schema draft-07 adapter.
// Implement IRAdapter<Signature, JsonSchemaDocument>.

import type { IRAdapter, Signature, TypeTerm } from "@typecarta/core";
import {
	array,
	base,
	bottom,
	createSignature,
	field,
	intersection,
	literal,
	patternConstraint,
	product,
	rangeConstraint,
	refinement,
	top,
	union,
} from "@typecarta/core";

/** A JSON Schema document (draft-07 compatible). */
export type JsonSchemaDocument = Record<string, unknown>;

const JSON_SCHEMA_SIGNATURE: Signature = createSignature(
	["string", "number", "integer", "boolean", "null"],
	[
		{ name: "product", arity: 1 },
		{ name: "array", arity: 1 },
		{ name: "union", arity: 2 },
		{ name: "intersection", arity: 2 },
		{ name: "map", arity: 2 },
	],
);

/** JSON Schema draft-07 adapter — implements IRAdapter for JSON Schema documents. */
export class JsonSchemaAdapter implements IRAdapter<Signature, JsonSchemaDocument> {
	readonly name = "JSON Schema draft-07";
	readonly signature = JSON_SCHEMA_SIGNATURE;

	/**
	 * Parse a JSON Schema document into a TypeTerm.
	 * @param source - JSON Schema document to parse.
	 * @returns Parsed TypeTerm representation.
	 */
	parse(source: JsonSchemaDocument): TypeTerm {
		return parseJsonSchema(source);
	}

	/**
	 * Encode a TypeTerm into a JSON Schema document.
	 * @param term - TypeTerm to encode.
	 * @returns JSON Schema document representing the term.
	 */
	encode(term: TypeTerm): JsonSchemaDocument {
		return encodeToJsonSchema(term);
	}

	/**
	 * Check whether a TypeTerm can be encoded as JSON Schema.
	 * @param term - TypeTerm to test.
	 * @returns `true` if encoding succeeds without error.
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
	 * Test whether a value inhabits a given TypeTerm.
	 * @param value - Runtime value to check.
	 * @param term - TypeTerm the value is tested against.
	 * @returns `true` if the value satisfies the term.
	 */
	inhabits(value: unknown, term: TypeTerm): boolean {
		return checkInhabitation(value, term);
	}
}

/** Parse a JSON Schema document into a TypeTerm. */
function parseJsonSchema(schema: JsonSchemaDocument): TypeTerm {
	const s = schema as Record<string, unknown>;
	if (
		"not" in s &&
		typeof s.not === "object" &&
		s.not !== null &&
		Object.keys(s.not).length === 0
	) {
		return bottom();
	}
	if (Object.keys(s).length === 0) {
		return top();
	}

	// const/enum
	if ("const" in s) {
		return literal(s.const as string | number | boolean | null);
	}
	if ("enum" in s && Array.isArray(s.enum)) {
		if (s.enum.length === 1) return literal(s.enum[0] as string | number | boolean | null);
		return union(s.enum.map((v: unknown) => literal(v as string | number | boolean | null)));
	}

	// allOf
	if ("allOf" in s && Array.isArray(s.allOf)) {
		return intersection(s.allOf.map((sub: unknown) => parseJsonSchema(sub as JsonSchemaDocument)));
	}

	// anyOf / oneOf
	if ("anyOf" in s && Array.isArray(s.anyOf)) {
		return union(s.anyOf.map((sub: unknown) => parseJsonSchema(sub as JsonSchemaDocument)));
	}
	if ("oneOf" in s && Array.isArray(s.oneOf)) {
		return union(s.oneOf.map((sub: unknown) => parseJsonSchema(sub as JsonSchemaDocument)));
	}

	// type-based
	const type = s.type as string | undefined;
	switch (type) {
		case "string": {
			const b = base("string");
			if ("pattern" in s && typeof s.pattern === "string") {
				return refinement(b, patternConstraint(s.pattern));
			}
			return b;
		}
		case "number":
		case "integer": {
			const b = base(type);
			if ("minimum" in s || "maximum" in s) {
				return refinement(
					b,
					rangeConstraint(s.minimum as number | undefined, s.maximum as number | undefined),
				);
			}
			return b;
		}
		case "boolean":
			return base("boolean");
		case "null":
			return base("null");
		case "array": {
			const items = s.items as JsonSchemaDocument | undefined;
			return array(items ? parseJsonSchema(items) : top());
		}
		case "object": {
			const properties = (s.properties ?? {}) as Record<string, JsonSchemaDocument>;
			const required = new Set((s.required ?? []) as string[]);
			const fields = Object.entries(properties).map(([name, propSchema]) =>
				field(name, parseJsonSchema(propSchema), { optional: !required.has(name) }),
			);
			return product(fields);
		}
		default:
			return top();
	}
}

/** Encode a TypeTerm into a JSON Schema document. */
function encodeToJsonSchema(term: TypeTerm): JsonSchemaDocument {
	switch (term.kind) {
		case "bottom":
			return { not: {} };
		case "top":
			return {};
		case "literal":
			return { const: term.value };
		case "base":
			return { type: term.name };
		case "apply":
			return encodeApply(term);
		case "refinement":
			return encodeRefinement(term);
		case "complement":
			return { not: encodeToJsonSchema(term.inner) };
		default:
			throw new Error(`Cannot encode ${term.kind} to JSON Schema`);
	}
}

/** Encode an apply-kind term into a JSON Schema document. */
function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): JsonSchemaDocument {
	switch (term.constructor) {
		case "product": {
			const properties: Record<string, JsonSchemaDocument> = {};
			const required: string[] = [];
			for (const f of term.fields ?? []) {
				properties[f.name] = encodeToJsonSchema(f.type);
				if (!f.optional) required.push(f.name);
			}
			return { type: "object", properties, ...(required.length > 0 ? { required } : {}) };
		}
		case "union":
			return { anyOf: term.args.map(encodeToJsonSchema) };
		case "intersection":
			return { allOf: term.args.map(encodeToJsonSchema) };
		case "array": {
			const elementType = term.args[0];
			return {
				type: "array",
				...(elementType != null ? { items: encodeToJsonSchema(elementType) } : {}),
			};
		}
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to JSON Schema`);
	}
}

/** Encode a refinement-kind term into a JSON Schema document. */
function encodeRefinement(term: Extract<TypeTerm, { kind: "refinement" }>): JsonSchemaDocument {
	const baseSchema = encodeToJsonSchema(term.base);
	const pred = term.predicate;
	switch (pred.kind) {
		case "range":
			return {
				...baseSchema,
				...(pred.min !== undefined ? { minimum: pred.min } : {}),
				...(pred.max !== undefined ? { maximum: pred.max } : {}),
			};
		case "pattern":
			return { ...baseSchema, pattern: pred.regex };
		case "multipleOf":
			return { ...baseSchema, multipleOf: pred.divisor };
		default:
			return baseSchema;
	}
}

/** Check whether a value inhabits a TypeTerm. */
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
				case "integer":
					return typeof value === "number" && Number.isInteger(value);
				case "boolean":
					return typeof value === "boolean";
				case "null":
					return value === null;
				default:
					return false;
			}
		case "apply":
			return checkApplyInhabitation(value, term);
		case "refinement": {
			if (!checkInhabitation(value, term.base)) return false;
			return checkPredicateInhabitation(value, term.predicate);
		}
		case "complement":
			return !checkInhabitation(value, term.inner);
		default:
			return false;
	}
}

/** Check whether a value inhabits an apply-kind term. */
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
		case "union":
			return term.args.some((a) => checkInhabitation(value, a));
		case "intersection":
			return term.args.every((a) => checkInhabitation(value, a));
		case "array": {
			const elemType = term.args[0];
			return (
				Array.isArray(value) &&
				(elemType == null || value.every((v) => checkInhabitation(v, elemType)))
			);
		}
		default:
			return false;
	}
}

/** Check whether a value satisfies a refinement predicate. */
function checkPredicateInhabitation(
	value: unknown,
	pred: import("@typecarta/core").RefinementPredicate,
): boolean {
	switch (pred.kind) {
		case "range":
			if (typeof value !== "number") return false;
			if (pred.min !== undefined && value < pred.min) return false;
			if (pred.max !== undefined && value > pred.max) return false;
			return true;
		case "pattern":
			return typeof value === "string" && new RegExp(pred.regex).test(value);
		case "multipleOf":
			return typeof value === "number" && value % pred.divisor === 0;
		case "and":
			return (
				checkPredicateInhabitation(value, pred.left) &&
				checkPredicateInhabitation(value, pred.right)
			);
		case "or":
			return (
				checkPredicateInhabitation(value, pred.left) ||
				checkPredicateInhabitation(value, pred.right)
			);
		case "not":
			return !checkPredicateInhabitation(value, pred.inner);
		default:
			return true;
	}
}
