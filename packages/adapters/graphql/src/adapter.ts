// GraphQL schema adapter.
//
// Implement IRAdapter<Signature, GraphQLTypeDescriptor> using descriptor
// objects that represent GraphQL type definitions, not the graphql-js
// library at runtime.

import type { IRAdapter, Signature, TypeTerm } from "@typecarta/core";
import {
	array,
	base,
	bottom,
	createSignature,
	field,
	literal,
	product,
	top,
	union,
} from "@typecarta/core";

// ─── Descriptor types ──────────────────────────────────────────────

/** Describe a single field within a GraphQL object, input, or interface type. */
export interface GraphQLFieldDescriptor {
	name: string;
	type: GraphQLTypeDescriptor;
}

/** A descriptor object representing a GraphQL type. */
export type GraphQLTypeDescriptor =
	| { type: "scalar"; name: "String" | "Int" | "Float" | "Boolean" | "ID" | string }
	| { type: "object"; name: string; fields: GraphQLFieldDescriptor[] }
	| { type: "list"; element: GraphQLTypeDescriptor }
	| { type: "nonNull"; inner: GraphQLTypeDescriptor }
	| { type: "union"; name: string; members: GraphQLTypeDescriptor[] }
	| { type: "enum"; name: string; values: string[] }
	| { type: "input"; name: string; fields: GraphQLFieldDescriptor[] }
	| { type: "interface"; name: string; fields: GraphQLFieldDescriptor[] }
	| { type: "ref"; name: string };

// ─── Signature ─────────────────────────────────────────────────────

const GRAPHQL_SIGNATURE: Signature = createSignature(
	["String", "Int", "Float", "Boolean", "ID"],
	[
		{ name: "object", arity: 1 },
		{ name: "list", arity: 1 },
		{ name: "nonNull", arity: 1 },
		{ name: "union", arity: 2 },
		{ name: "enum", arity: 1 },
		{ name: "input", arity: 1 },
		{ name: "interface", arity: 1 },
	],
);

// ─── Adapter class ─────────────────────────────────────────────────

/** Adapt GraphQL type descriptors to and from the typecarta IR. */
export class GraphQLAdapter implements IRAdapter<Signature, GraphQLTypeDescriptor> {
	readonly name = "GraphQL";
	readonly signature = GRAPHQL_SIGNATURE;

	/**
	 * Parse a GraphQL type descriptor into an IR type term.
	 *
	 * @param source - GraphQL type descriptor to parse.
	 * @returns The equivalent {@link TypeTerm} in the IR.
	 */
	parse(source: GraphQLTypeDescriptor): TypeTerm {
		return parseGraphQLDescriptor(source);
	}

	/**
	 * Encode an IR type term into a GraphQL type descriptor.
	 *
	 * @param term - IR type term to encode.
	 * @returns The equivalent {@link GraphQLTypeDescriptor}.
	 * @throws Error if the term contains constructs not representable in GraphQL.
	 */
	encode(term: TypeTerm): GraphQLTypeDescriptor {
		return encodeToGraphQLDescriptor(term);
	}

	/**
	 * Test whether an IR type term can be encoded as a GraphQL descriptor.
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
	 * Check whether a runtime value inhabits the given IR type term under GraphQL semantics.
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

function parseGraphQLDescriptor(desc: GraphQLTypeDescriptor): TypeTerm {
	switch (desc.type) {
		case "scalar":
			return base(desc.name);
		case "object":
		case "input":
		case "interface": {
			const fields = desc.fields.map((f) =>
				// GraphQL fields are nullable by default (optional)
				field(f.name, parseGraphQLDescriptor(f.type), { optional: true }),
			);
			return product(fields);
		}
		case "list":
			return array(parseGraphQLDescriptor(desc.element));
		case "nonNull":
			// NonNull removes the nullable wrapper -- parse inner as required
			return parseGraphQLDescriptor(desc.inner);
		case "union":
			return union(desc.members.map(parseGraphQLDescriptor));
		case "enum":
			return union(desc.values.map((v) => literal(v)));
		case "ref":
			return base(desc.name);
		default:
			return top();
	}
}

// ─── Encode ────────────────────────────────────────────────────────

function encodeToGraphQLDescriptor(term: TypeTerm): GraphQLTypeDescriptor {
	switch (term.kind) {
		case "bottom":
			throw new Error("Cannot encode bottom type to GraphQL");
		case "top":
			// GraphQL has no top type; use a scalar placeholder
			return { type: "scalar", name: "JSON" };
		case "literal":
			// Literal becomes a single-value enum
			if (typeof term.value === "string") {
				return { type: "enum", name: "LiteralEnum", values: [term.value] };
			}
			throw new Error(`Cannot encode literal ${JSON.stringify(term.value)} to GraphQL`);
		case "base":
			return encodeBaseToGraphQL(term.name);
		case "apply":
			return encodeApply(term);
		default:
			throw new Error(`Cannot encode ${term.kind} to GraphQL`);
	}
}

function encodeBaseToGraphQL(name: string): GraphQLTypeDescriptor {
	const builtins = new Set(["String", "Int", "Float", "Boolean", "ID"]);
	if (builtins.has(name)) {
		return { type: "scalar", name };
	}
	// Non-builtin base types become references
	return { type: "ref", name };
}

function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): GraphQLTypeDescriptor {
	switch (term.constructor) {
		case "product": {
			const fields: GraphQLFieldDescriptor[] = (term.fields ?? []).map((f) => ({
				name: f.name,
				type: encodeToGraphQLDescriptor(f.type),
			}));
			return { type: "object", name: "Object", fields };
		}
		case "array": {
			const elementType = term.args[0];
			if (elementType === undefined) {
				throw new Error("Cannot encode array type with no element type to GraphQL");
			}
			return { type: "list", element: encodeToGraphQLDescriptor(elementType) };
		}
		case "union":
			return {
				type: "union",
				name: "Union",
				members: term.args.map(encodeToGraphQLDescriptor),
			};
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to GraphQL`);
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
				case "String":
					return typeof value === "string";
				case "Int":
					return typeof value === "number" && Number.isInteger(value);
				case "Float":
					return typeof value === "number";
				case "Boolean":
					return typeof value === "boolean";
				case "ID":
					return typeof value === "string" || typeof value === "number";
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
			if (elementType === undefined) return false;
			return Array.isArray(value) && value.every((v) => checkInhabitation(v, elementType));
		}
		case "union":
			return term.args.some((a) => checkInhabitation(value, a));
		default:
			return false;
	}
}
