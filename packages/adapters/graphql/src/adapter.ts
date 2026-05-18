// GraphQL schema adapter.
//
// Implement IRAdapter<Signature, GraphQLTypeDescriptor> using descriptor
// objects that represent GraphQL type definitions, not the graphql-js
// library at runtime.

import type { IRAdapter, Signature, TypeTerm } from "@typecarta/core";
import { array, base, createSignature, field, literal, product, top, union } from "@typecarta/core";

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

const GRAPHQL_SUPPORTED_KINDS: ReadonlySet<TypeTerm["kind"]> = new Set([
	"bottom",
	"top",
	"literal",
	"base",
	"apply",
]);

// ─── Adapter class ─────────────────────────────────────────────────

/** Adapt GraphQL type descriptors to and from the typecarta IR. */
export class GraphQLAdapter implements IRAdapter<Signature, GraphQLTypeDescriptor> {
	readonly name = "GraphQL";
	readonly specVersion = "October 2021";
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

	supportsKind(kind: TypeTerm["kind"]): boolean {
		return GRAPHQL_SUPPORTED_KINDS.has(kind);
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

/**
 * Map GraphQL-canonical scalar names back to IR-canonical base names so
 * round-tripped terms can be compared structurally against the original
 * IR term. The inverse of `normalizeIrBaseToGraphQL`.
 */
function normalizeGraphQLBaseToIr(name: string): string {
	switch (name) {
		case "String":
			return "string";
		case "Int":
			return "integer";
		case "Float":
			return "number";
		case "Boolean":
			return "boolean";
		// `ID` and `JSON` (top placeholder) have no IR equivalent; keep verbatim.
		default:
			return name;
	}
}

function parseGraphQLDescriptor(desc: GraphQLTypeDescriptor): TypeTerm {
	switch (desc.type) {
		case "scalar":
			return base(normalizeGraphQLBaseToIr(desc.name));
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
			return base(normalizeGraphQLBaseToIr(desc.name));
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

/**
 * Map IR-canonical base names (lowercase, JSON-Schema-flavored) to the
 * GraphQL-canonical scalar names. Returns `undefined` for non-GraphQL
 * primitives so the caller can fall through to the `ref` path.
 *
 * The IR convention is `string` / `number` / `integer` / `boolean`; the
 * GraphQL convention is `String` / `Float` / `Int` / `Boolean` / `ID`.
 * Without this normalization, encode emits `ref` (treating IR names as
 * user types) and `inhabits` later fails to recognize the round-tripped
 * `base("string")` term — the case-mismatch bug the bench:fidelity
 * reviewer flagged on the `product-person` row.
 */
function normalizeIrBaseToGraphQL(name: string): string | undefined {
	switch (name) {
		case "String":
		case "Int":
		case "Float":
		case "Boolean":
		case "ID":
			return name;
		case "string":
			return "String";
		case "integer":
			return "Int";
		case "number":
			return "Float";
		case "boolean":
			return "Boolean";
		default:
			return undefined;
	}
}

function encodeBaseToGraphQL(name: string): GraphQLTypeDescriptor {
	const normalized = normalizeIrBaseToGraphQL(name);
	if (normalized !== undefined) {
		return { type: "scalar", name: normalized };
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
			// Accept both GraphQL-canonical (String/Int/Float/Boolean) and
			// IR-canonical (string/integer/number/boolean) names so callers
			// can construct terms in either convention. The encoder + parser
			// normalize to IR-canonical, but defensive matching here avoids
			// strict ordering assumptions on construction.
			switch (term.name) {
				case "String":
				case "string":
					return typeof value === "string";
				case "Int":
				case "integer":
					return typeof value === "number" && Number.isInteger(value);
				case "Float":
				case "number":
					return typeof value === "number";
				case "Boolean":
				case "boolean":
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
