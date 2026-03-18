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
});
