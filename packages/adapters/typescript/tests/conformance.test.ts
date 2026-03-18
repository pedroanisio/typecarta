import {
	array,
	base,
	bottom,
	field,
	forall,
	intersection,
	literal,
	map,
	product,
	tuple,
	union,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { TypeScriptAdapter } from "../src/adapter.js";
import type { TSTypeDescriptor } from "../src/adapter.js";

const adapter = new TypeScriptAdapter();

describe("TypeScriptAdapter", () => {
	describe("parse → encode roundtrip", () => {
		it("roundtrips string", () => {
			const desc: TSTypeDescriptor = { type: "string" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips number", () => {
			const desc: TSTypeDescriptor = { type: "number" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips boolean", () => {
			const desc: TSTypeDescriptor = { type: "boolean" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips null", () => {
			const desc: TSTypeDescriptor = { type: "null" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips undefined", () => {
			const desc: TSTypeDescriptor = { type: "undefined" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips void", () => {
			const desc: TSTypeDescriptor = { type: "void" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips never", () => {
			const desc: TSTypeDescriptor = { type: "never" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips unknown", () => {
			const desc: TSTypeDescriptor = { type: "unknown" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips symbol", () => {
			const desc: TSTypeDescriptor = { type: "symbol" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips bigint", () => {
			const desc: TSTypeDescriptor = { type: "bigint" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips object type", () => {
			const desc: TSTypeDescriptor = {
				type: "object",
				properties: {
					name: { type: { type: "string" } },
					age: { type: { type: "number" }, optional: true },
				},
			};
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips array type", () => {
			const desc: TSTypeDescriptor = { type: "array", element: { type: "string" } };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips literal type", () => {
			const desc: TSTypeDescriptor = { type: "literal", value: "hello" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips Record type", () => {
			const desc: TSTypeDescriptor = {
				type: "record",
				key: { type: "string" },
				value: { type: "number" },
			};
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});
	});

	describe("inhabits: true for matching values", () => {
		it("string value inhabits string type", () => {
			const term = adapter.parse({ type: "string" });
			expect(adapter.inhabits("hello", term)).toBe(true);
		});

		it("number value inhabits number type", () => {
			const term = adapter.parse({ type: "number" });
			expect(adapter.inhabits(42, term)).toBe(true);
		});

		it("undefined inhabits void", () => {
			const term = adapter.parse({ type: "void" });
			expect(adapter.inhabits(undefined, term)).toBe(true);
		});

		it("object value inhabits object type", () => {
			const term = adapter.parse({
				type: "object",
				properties: {
					name: { type: { type: "string" } },
				},
			});
			expect(adapter.inhabits({ name: "Alice" }, term)).toBe(true);
		});

		it("array value inhabits array type", () => {
			const term = adapter.parse({ type: "array", element: { type: "number" } });
			expect(adapter.inhabits([1, 2, 3], term)).toBe(true);
		});

		it("value inhabits union type", () => {
			const term = adapter.parse({
				type: "union",
				members: [{ type: "string" }, { type: "number" }],
			});
			expect(adapter.inhabits("hello", term)).toBe(true);
			expect(adapter.inhabits(42, term)).toBe(true);
		});

		it("any value inhabits unknown", () => {
			const term = adapter.parse({ type: "unknown" });
			expect(adapter.inhabits("anything", term)).toBe(true);
		});
	});

	describe("inhabits: false for non-matching values", () => {
		it("number does not inhabit string", () => {
			const term = adapter.parse({ type: "string" });
			expect(adapter.inhabits(42, term)).toBe(false);
		});

		it("nothing inhabits never", () => {
			const term = adapter.parse({ type: "never" });
			expect(adapter.inhabits("anything", term)).toBe(false);
		});

		it("wrong property types do not inhabit object", () => {
			const term = adapter.parse({
				type: "object",
				properties: {
					name: { type: { type: "string" } },
				},
			});
			expect(adapter.inhabits({ name: 42 }, term)).toBe(false);
		});
	});

	describe("isEncodable", () => {
		it("returns true for supported terms", () => {
			expect(adapter.isEncodable(base("string"))).toBe(true);
			expect(adapter.isEncodable(base("number"))).toBe(true);
			expect(adapter.isEncodable(base("void"))).toBe(true);
			expect(adapter.isEncodable(base("symbol"))).toBe(true);
			expect(adapter.isEncodable(base("bigint"))).toBe(true);
			expect(adapter.isEncodable(array(base("string")))).toBe(true);
			expect(adapter.isEncodable(product([field("x", base("number"))]))).toBe(true);
			expect(adapter.isEncodable(bottom())).toBe(true);
			expect(adapter.isEncodable(map(base("string"), base("number")))).toBe(true);
		});

		it("returns false for unsupported terms", () => {
			expect(adapter.isEncodable(forall("T", base("string")))).toBe(false);
			expect(adapter.isEncodable(base("date"))).toBe(false);
		});
	});

	describe("operationalSubtype", () => {
		it("string literal is subtype of string", () => {
			expect(adapter.operationalSubtype(literal("hello"), base("string"))).toBe(true);
		});

		it("string is not subtype of number", () => {
			expect(adapter.operationalSubtype(base("string"), base("number"))).toBe(false);
		});

		it("never is subtype of everything", () => {
			expect(adapter.operationalSubtype(bottom(), base("string"))).toBe(true);
		});

		it("product subtype with compatible fields", () => {
			const a = product([field("x", base("string")), field("y", base("number"))]);
			const b = product([field("x", base("string"))]);
			expect(adapter.operationalSubtype(a, b)).toBe(true);
		});

		it("product not subtype when missing required field", () => {
			const a = product([field("x", base("string"))]);
			const b = product([field("x", base("string")), field("y", base("number"))]);
			expect(adapter.operationalSubtype(a, b)).toBe(false);
		});

		it("array covariance", () => {
			// never[] <: string[]
			expect(adapter.operationalSubtype(array(bottom()), array(base("string")))).toBe(true);
		});
	});
});
