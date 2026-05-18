import {
	array,
	base,
	bottom,
	complement,
	field,
	forall,
	literal,
	product,
	union,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { JsonSchemaAdapter } from "../src/adapter.js";
import type { JsonSchemaDocument } from "../src/adapter.js";

const adapter = new JsonSchemaAdapter();

describe("JsonSchemaAdapter", () => {
	describe("parse -> encode roundtrip", () => {
		it("roundtrips primitive string schema", () => {
			const schema: JsonSchemaDocument = { type: "string" };
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips object schema with required and optional properties", () => {
			const schema: JsonSchemaDocument = {
				type: "object",
				properties: {
					name: { type: "string" },
					age: { type: "number" },
				},
				required: ["name"],
			};
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips arrays, unions, intersections, literals, and bottom", () => {
			expect(adapter.encode(adapter.parse({ type: "array", items: { type: "number" } }))).toEqual({
				type: "array",
				items: { type: "number" },
			});
			expect(
				adapter.encode(adapter.parse({ anyOf: [{ type: "string" }, { type: "number" }] })),
			).toEqual({
				anyOf: [{ type: "string" }, { type: "number" }],
			});
			expect(
				adapter.encode(
					adapter.parse({ allOf: [{ type: "string" }, { type: "string", pattern: "^a" }] }),
				),
			).toEqual({
				allOf: [{ type: "string" }, { type: "string", pattern: "^a" }],
			});
			expect(adapter.encode(adapter.parse({ const: "ready" }))).toEqual({ const: "ready" });
			expect(adapter.encode(adapter.parse({ not: {} }))).toEqual({ not: {} });
		});
	});

	describe("inhabits", () => {
		it("accepts matching primitive, product, array, and union values", () => {
			expect(adapter.inhabits("hello", base("string"))).toBe(true);
			expect(adapter.inhabits({ name: "Alice" }, product([field("name", base("string"))]))).toBe(
				true,
			);
			expect(adapter.inhabits([1, 2, 3], array(base("number")))).toBe(true);
			expect(adapter.inhabits("x", union([base("string"), base("number")]))).toBe(true);
		});

		it("rejects non-matching values and bottom", () => {
			expect(adapter.inhabits(42, base("string"))).toBe(false);
			expect(adapter.inhabits({ name: 42 }, product([field("name", base("string"))]))).toBe(false);
			expect(adapter.inhabits("anything", bottom())).toBe(false);
		});
	});

	describe("isEncodable", () => {
		it("returns true for JSON Schema representable terms", () => {
			expect(adapter.isEncodable(base("string"))).toBe(true);
			expect(adapter.isEncodable(literal("ready"))).toBe(true);
			expect(adapter.isEncodable(array(base("number")))).toBe(true);
			expect(adapter.isEncodable(product([field("name", base("string"))]))).toBe(true);
			expect(adapter.isEncodable(complement(base("string")))).toBe(true);
		});

		it("returns false for unsupported higher-order terms", () => {
			expect(adapter.isEncodable(forall("T", base("string")))).toBe(false);
		});
	});
});
