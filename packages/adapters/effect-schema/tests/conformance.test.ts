import {
	array,
	base,
	bottom,
	field,
	forall,
	intersection,
	literal,
	product,
	union,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { EffectSchemaAdapter } from "../src/adapter.js";
import type { EffectSchemaDescriptor } from "../src/adapter.js";

const adapter = new EffectSchemaAdapter();

describe("EffectSchemaAdapter", () => {
	describe("parse → encode roundtrip", () => {
		it("roundtrips string", () => {
			const desc: EffectSchemaDescriptor = { type: "string" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips number", () => {
			const desc: EffectSchemaDescriptor = { type: "number" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips boolean", () => {
			const desc: EffectSchemaDescriptor = { type: "boolean" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips null", () => {
			const desc: EffectSchemaDescriptor = { type: "null" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips undefined", () => {
			const desc: EffectSchemaDescriptor = { type: "undefined" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips never", () => {
			const desc: EffectSchemaDescriptor = { type: "never" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips unknown", () => {
			const desc: EffectSchemaDescriptor = { type: "unknown" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips struct", () => {
			const desc: EffectSchemaDescriptor = {
				type: "struct",
				fields: {
					name: { schema: { type: "string" } },
					age: { schema: { type: "number" } },
				},
			};
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips array", () => {
			const desc: EffectSchemaDescriptor = { type: "array", element: { type: "string" } };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips literal", () => {
			const desc: EffectSchemaDescriptor = { type: "literal", value: "hello" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});
	});

	describe("inhabits: true for matching values", () => {
		it("string value inhabits string schema", () => {
			const term = adapter.parse({ type: "string" });
			expect(adapter.inhabits("hello", term)).toBe(true);
		});

		it("number value inhabits number schema", () => {
			const term = adapter.parse({ type: "number" });
			expect(adapter.inhabits(42, term)).toBe(true);
		});

		it("boolean value inhabits boolean schema", () => {
			const term = adapter.parse({ type: "boolean" });
			expect(adapter.inhabits(true, term)).toBe(true);
		});

		it("null value inhabits null schema", () => {
			const term = adapter.parse({ type: "null" });
			expect(adapter.inhabits(null, term)).toBe(true);
		});

		it("object value inhabits struct schema", () => {
			const term = adapter.parse({
				type: "struct",
				fields: {
					name: { schema: { type: "string" } },
					age: { schema: { type: "number" } },
				},
			});
			expect(adapter.inhabits({ name: "Alice", age: 30 }, term)).toBe(true);
		});

		it("array value inhabits array schema", () => {
			const term = adapter.parse({ type: "array", element: { type: "number" } });
			expect(adapter.inhabits([1, 2, 3], term)).toBe(true);
		});

		it("value inhabits union schema", () => {
			const term = adapter.parse({
				type: "union",
				members: [{ type: "string" }, { type: "number" }],
			});
			expect(adapter.inhabits("hello", term)).toBe(true);
			expect(adapter.inhabits(42, term)).toBe(true);
		});

		it("any value inhabits unknown schema", () => {
			const term = adapter.parse({ type: "unknown" });
			expect(adapter.inhabits("anything", term)).toBe(true);
		});
	});

	describe("inhabits: false for non-matching values", () => {
		it("number does not inhabit string schema", () => {
			const term = adapter.parse({ type: "string" });
			expect(adapter.inhabits(42, term)).toBe(false);
		});

		it("nothing inhabits never schema", () => {
			const term = adapter.parse({ type: "never" });
			expect(adapter.inhabits("anything", term)).toBe(false);
		});

		it("wrong fields do not inhabit struct schema", () => {
			const term = adapter.parse({
				type: "struct",
				fields: {
					name: { schema: { type: "string" } },
				},
			});
			expect(adapter.inhabits({ name: 42 }, term)).toBe(false);
		});

		it("wrong element type does not inhabit array schema", () => {
			const term = adapter.parse({ type: "array", element: { type: "number" } });
			expect(adapter.inhabits(["not", "numbers"], term)).toBe(false);
		});
	});

	describe("isEncodable", () => {
		it("returns true for supported terms", () => {
			expect(adapter.isEncodable(base("string"))).toBe(true);
			expect(adapter.isEncodable(base("number"))).toBe(true);
			expect(adapter.isEncodable(base("boolean"))).toBe(true);
			expect(adapter.isEncodable(array(base("string")))).toBe(true);
			expect(adapter.isEncodable(product([field("x", base("number"))]))).toBe(true);
			expect(adapter.isEncodable(union([base("string"), base("number")]))).toBe(true);
			expect(adapter.isEncodable(intersection([base("string"), base("number")]))).toBe(true);
			expect(adapter.isEncodable(bottom())).toBe(true);
			expect(adapter.isEncodable(literal("hello"))).toBe(true);
		});

		it("returns false for unsupported terms", () => {
			expect(adapter.isEncodable(forall("T", base("string")))).toBe(false);
			expect(adapter.isEncodable(base("date"))).toBe(false);
		});
	});
});
