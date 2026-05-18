import {
	array,
	base,
	bottom,
	field,
	forall,
	literal,
	product,
	rangeConstraint,
	refinement,
	union,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { XsdAdapter } from "../src/adapter.js";
import type { XsdDescriptor } from "../src/adapter.js";

const adapter = new XsdAdapter();

describe("XsdAdapter", () => {
	describe("parse -> encode roundtrip", () => {
		it("roundtrips a primitive string descriptor", () => {
			const desc: XsdDescriptor = { kind: "primitive", name: "string" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips a complex type with required and optional elements", () => {
			const desc: XsdDescriptor = {
				kind: "complexType",
				name: "Person",
				elements: [
					{ name: "name", type: { kind: "primitive", name: "string" } },
					{ name: "age", type: { kind: "primitive", name: "integer" }, minOccurs: 0 },
				],
			};
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual({
				kind: "complexType",
				elements: [
					{ name: "name", type: { kind: "primitive", name: "string" } },
					{ name: "age", type: { kind: "primitive", name: "integer" }, minOccurs: 0 },
				],
			});
		});

		it("roundtrips lists, unions, literals, refinements, top, and bottom", () => {
			expect(
				adapter.encode(
					adapter.parse({ kind: "list", itemType: { kind: "primitive", name: "string" } }),
				),
			).toEqual({
				kind: "list",
				itemType: { kind: "primitive", name: "string" },
			});
			expect(
				adapter.encode(
					adapter.parse({
						kind: "union",
						members: [
							{ kind: "primitive", name: "string" },
							{ kind: "primitive", name: "integer" },
						],
					}),
				),
			).toEqual({
				kind: "union",
				members: [
					{ kind: "primitive", name: "string" },
					{ kind: "primitive", name: "integer" },
				],
			});
			expect(adapter.encode(adapter.parse({ kind: "anyType" }))).toEqual({ kind: "anyType" });
			expect(adapter.encode(adapter.parse({ kind: "empty" }))).toEqual({ kind: "empty" });
			expect(adapter.encode(literal("ready"))).toEqual({
				kind: "simpleType",
				base: { kind: "primitive", name: "string" },
				facets: { enumeration: ["ready"] },
			});
			expect(adapter.encode(refinement(base("integer"), rangeConstraint(1, 10)))).toEqual({
				kind: "simpleType",
				base: { kind: "primitive", name: "integer" },
				facets: { minInclusive: 1, maxInclusive: 10 },
			});
		});
	});

	describe("inhabits", () => {
		it("accepts matching primitive, product, array, and union values", () => {
			expect(adapter.inhabits("hello", base("string"))).toBe(true);
			expect(adapter.inhabits({ name: "Alice" }, product([field("name", base("string"))]))).toBe(
				true,
			);
			expect(adapter.inhabits([1, 2, 3], array(base("integer")))).toBe(true);
			expect(adapter.inhabits("x", union([base("string"), base("integer")]))).toBe(true);
		});

		it("rejects non-matching values and bottom", () => {
			expect(adapter.inhabits(42, base("string"))).toBe(false);
			expect(adapter.inhabits(3.14, base("integer"))).toBe(false);
			expect(adapter.inhabits({ name: 42 }, product([field("name", base("string"))]))).toBe(false);
			expect(adapter.inhabits("anything", bottom())).toBe(false);
		});
	});

	describe("isEncodable", () => {
		it("returns true for XSD representable terms", () => {
			expect(adapter.isEncodable(base("string"))).toBe(true);
			expect(adapter.isEncodable(base("integer"))).toBe(true);
			expect(adapter.isEncodable(literal("ready"))).toBe(true);
			expect(adapter.isEncodable(array(base("string")))).toBe(true);
			expect(adapter.isEncodable(product([field("name", base("string"))]))).toBe(true);
		});

		it("returns false for unsupported higher-order terms", () => {
			expect(adapter.isEncodable(forall("T", base("string")))).toBe(false);
		});
	});
});
