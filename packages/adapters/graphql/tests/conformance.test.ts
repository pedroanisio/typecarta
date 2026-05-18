import { array, base, bottom, field, forall, literal, product, union } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { GraphQLAdapter } from "../src/adapter.js";
import type { GraphQLTypeDescriptor } from "../src/adapter.js";

const adapter = new GraphQLAdapter();

describe("GraphQLAdapter", () => {
	describe("parse → encode roundtrip", () => {
		it("roundtrips String scalar", () => {
			const desc: GraphQLTypeDescriptor = { type: "scalar", name: "String" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips Int scalar", () => {
			const desc: GraphQLTypeDescriptor = { type: "scalar", name: "Int" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips Float scalar", () => {
			const desc: GraphQLTypeDescriptor = { type: "scalar", name: "Float" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips Boolean scalar", () => {
			const desc: GraphQLTypeDescriptor = { type: "scalar", name: "Boolean" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips ID scalar", () => {
			const desc: GraphQLTypeDescriptor = { type: "scalar", name: "ID" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips list type", () => {
			const desc: GraphQLTypeDescriptor = {
				type: "list",
				element: { type: "scalar", name: "String" },
			};
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});
	});

	describe("parse complex types", () => {
		it("parses an object type", () => {
			const desc: GraphQLTypeDescriptor = {
				type: "object",
				name: "User",
				fields: [
					{ name: "id", type: { type: "scalar", name: "ID" } },
					{ name: "name", type: { type: "scalar", name: "String" } },
				],
			};
			const term = adapter.parse(desc);
			expect(term.kind).toBe("apply");
		});

		it("parses an enum type", () => {
			const desc: GraphQLTypeDescriptor = {
				type: "enum",
				name: "Status",
				values: ["ACTIVE", "INACTIVE"],
			};
			const term = adapter.parse(desc);
			expect(term.kind).toBe("apply");
		});

		it("parses a union type", () => {
			const desc: GraphQLTypeDescriptor = {
				type: "union",
				name: "SearchResult",
				members: [
					{ type: "ref", name: "User" },
					{ type: "ref", name: "Post" },
				],
			};
			const term = adapter.parse(desc);
			expect(term.kind).toBe("apply");
		});

		it("parses an input type", () => {
			const desc: GraphQLTypeDescriptor = {
				type: "input",
				name: "CreateUserInput",
				fields: [{ name: "name", type: { type: "scalar", name: "String" } }],
			};
			const term = adapter.parse(desc);
			expect(term.kind).toBe("apply");
		});

		it("parses an interface type", () => {
			const desc: GraphQLTypeDescriptor = {
				type: "interface",
				name: "Node",
				fields: [{ name: "id", type: { type: "scalar", name: "ID" } }],
			};
			const term = adapter.parse(desc);
			expect(term.kind).toBe("apply");
		});
	});

	describe("inhabits: true for matching values", () => {
		it("string value inhabits String scalar", () => {
			const term = adapter.parse({ type: "scalar", name: "String" });
			expect(adapter.inhabits("hello", term)).toBe(true);
		});

		it("integer value inhabits Int scalar", () => {
			const term = adapter.parse({ type: "scalar", name: "Int" });
			expect(adapter.inhabits(42, term)).toBe(true);
		});

		it("float value inhabits Float scalar", () => {
			const term = adapter.parse({ type: "scalar", name: "Float" });
			expect(adapter.inhabits(3.14, term)).toBe(true);
		});

		it("boolean value inhabits Boolean scalar", () => {
			const term = adapter.parse({ type: "scalar", name: "Boolean" });
			expect(adapter.inhabits(true, term)).toBe(true);
		});

		it("string value inhabits ID scalar", () => {
			const term = adapter.parse({ type: "scalar", name: "ID" });
			expect(adapter.inhabits("abc123", term)).toBe(true);
		});

		it("number value inhabits ID scalar", () => {
			const term = adapter.parse({ type: "scalar", name: "ID" });
			expect(adapter.inhabits(123, term)).toBe(true);
		});

		it("object value inhabits object type", () => {
			const term = adapter.parse({
				type: "object",
				name: "User",
				fields: [{ name: "name", type: { type: "scalar", name: "String" } }],
			});
			expect(adapter.inhabits({ name: "Alice" }, term)).toBe(true);
		});

		it("array value inhabits list type", () => {
			const term = adapter.parse({
				type: "list",
				element: { type: "scalar", name: "String" },
			});
			expect(adapter.inhabits(["a", "b"], term)).toBe(true);
		});
	});

	describe("inhabits: false for non-matching values", () => {
		it("number does not inhabit String scalar", () => {
			const term = adapter.parse({ type: "scalar", name: "String" });
			expect(adapter.inhabits(42, term)).toBe(false);
		});

		it("float does not inhabit Int scalar", () => {
			const term = adapter.parse({ type: "scalar", name: "Int" });
			expect(adapter.inhabits(3.14, term)).toBe(false);
		});

		it("string does not inhabit Boolean scalar", () => {
			const term = adapter.parse({ type: "scalar", name: "Boolean" });
			expect(adapter.inhabits("true", term)).toBe(false);
		});

		it("boolean does not inhabit ID scalar", () => {
			const term = adapter.parse({ type: "scalar", name: "ID" });
			expect(adapter.inhabits(true, term)).toBe(false);
		});
	});

	describe("isEncodable", () => {
		it("returns true for supported terms", () => {
			expect(adapter.isEncodable(base("String"))).toBe(true);
			expect(adapter.isEncodable(base("Int"))).toBe(true);
			expect(adapter.isEncodable(base("Float"))).toBe(true);
			expect(adapter.isEncodable(base("Boolean"))).toBe(true);
			expect(adapter.isEncodable(base("ID"))).toBe(true);
			expect(adapter.isEncodable(array(base("String")))).toBe(true);
			expect(adapter.isEncodable(product([field("x", base("String"))]))).toBe(true);
		});

		it("returns false for unsupported terms", () => {
			expect(adapter.isEncodable(bottom())).toBe(false);
			expect(adapter.isEncodable(forall("T", base("String")))).toBe(false);
		});
	});

	// Regression for the encode/inhabits case-mismatch bug surfaced by the
	// bench:fidelity reviewer (2026-05-18). The encoder wrote IR-canonical
	// lowercase names (`string`, `number`) into `{type: "ref", name: …}`;
	// inhabits only matched the GraphQL-canonical names (`String`, `Int`,
	// `Float`). Round-tripped terms inhabits-checked as false for every
	// value — including the legitimate ones — surfacing as the
	// `product-person Sound=no` cell in the fidelity bench.
	describe("regression: encode/inhabits agree on base names", () => {
		it("IR-canonical base names normalize to GraphQL names through encode", () => {
			expect(adapter.encode(base("string"))).toEqual({ type: "scalar", name: "String" });
			expect(adapter.encode(base("number"))).toEqual({ type: "scalar", name: "Float" });
			expect(adapter.encode(base("integer"))).toEqual({ type: "scalar", name: "Int" });
			expect(adapter.encode(base("boolean"))).toEqual({ type: "scalar", name: "Boolean" });
		});

		it("GraphQL-canonical scalars parse back to IR-canonical base names", () => {
			expect(adapter.parse({ type: "scalar", name: "String" })).toEqual(base("string"));
			expect(adapter.parse({ type: "scalar", name: "Float" })).toEqual(base("number"));
			expect(adapter.parse({ type: "scalar", name: "Int" })).toEqual(base("integer"));
			expect(adapter.parse({ type: "scalar", name: "Boolean" })).toEqual(base("boolean"));
		});

		it("inhabits accepts the round-tripped product (Sound check)", () => {
			const term = product([field("name", base("string")), field("age", base("number"))]);
			const parsed = adapter.parse(adapter.encode(term));
			// The legitimate value MUST inhabit the round-tripped term.
			expect(adapter.inhabits({ name: "Alice", age: 30 }, parsed)).toBe(true);
			// A wrong-typed value must still be rejected (not over-accepting).
			expect(adapter.inhabits({ name: 42, age: 30 }, parsed)).toBe(false);
		});

		it("inhabits accepts both name conventions defensively", () => {
			// A caller who constructs base("String") (capitalized) shouldn't be
			// surprised either — same semantic, both spellings work.
			expect(adapter.inhabits("hello", base("String"))).toBe(true);
			expect(adapter.inhabits("hello", base("string"))).toBe(true);
			expect(adapter.inhabits(42, base("Int"))).toBe(true);
			expect(adapter.inhabits(42, base("integer"))).toBe(true);
		});
	});

	// P0.4 — bench:fidelity soundness on product-person (2026-05-18).
	// GraphQL's SDL convention: an unmarked field is nullable (the parsed
	// IR adds `optional: true`). When the IR's source term has a required
	// field (`optional` falsy / undefined), the encoder must wrap that
	// field's type in `NonNull` so the round-trip preserves required-ness.
	// Without this, `{}` is accepted by the parsed term but rejected by
	// the original IR — a soundness violation.
	describe("Required-field round-trip via NonNull", () => {
		it("emits NonNull around required field types", () => {
			const term = product([
				field("name", base("string")),
				field("age", base("number")),
			]);
			const encoded = adapter.encode(term) as { type: "object"; fields: Array<{ name: string; type: { type: string } }> };
			expect(encoded.type).toBe("object");
			expect(encoded.fields[0]!.type.type).toBe("nonNull");
			expect(encoded.fields[1]!.type.type).toBe("nonNull");
		});

		it("emits a bare type for optional fields", () => {
			const term = product([
				field("name", base("string"), { optional: true }),
				field("age", base("number")),
			]);
			const encoded = adapter.encode(term) as { type: "object"; fields: Array<{ name: string; type: { type: string } }> };
			// optional → bare scalar; required → NonNull-wrapped
			expect(encoded.fields[0]!.type.type).toBe("scalar");
			expect(encoded.fields[1]!.type.type).toBe("nonNull");
		});

		it("product-person round-trips with required fields preserved (soundness)", () => {
			const term = product([
				field("name", base("string")),
				field("age", base("number")),
			]);
			const parsed = adapter.parse(adapter.encode(term));
			// Soundness: a value rejected by the original IR must also be
			// rejected by the round-tripped term. Empty object lacks `name`
			// and `age`, so both terms must reject it.
			expect(adapter.inhabits({}, term)).toBe(false);
			expect(adapter.inhabits({}, parsed)).toBe(false);
			// And the valid value still inhabits both.
			expect(adapter.inhabits({ name: "Alice", age: 30 }, term)).toBe(true);
			expect(adapter.inhabits({ name: "Alice", age: 30 }, parsed)).toBe(true);
		});
	});
});
