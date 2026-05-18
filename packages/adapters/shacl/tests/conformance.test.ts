import {
	array,
	base,
	complement,
	field,
	forall,
	literal,
	nominal,
	product,
	rangeConstraint,
	refinement,
	union,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { ShaclAdapter } from "../src/adapter.js";
import type { ShaclDescriptor } from "../src/adapter.js";

const adapter = new ShaclAdapter();

describe("ShaclAdapter", () => {
	describe("identity", () => {
		it("names itself with its spec version", () => {
			expect(adapter.name).toBe("shacl-1-0");
			expect(adapter.specVersion).toBe("1.0");
		});
	});

	describe("encode: TypeTerm → ShaclDescriptor", () => {
		it("encodes base types as NodeShape with sh:datatype", () => {
			const desc = adapter.encode(base("string"));
			expect(desc).toEqual({ kind: "NodeShape", datatype: "xsd:string" });
		});

		it("encodes a singleton literal as sh:hasValue", () => {
			expect(adapter.encode(literal(42))).toEqual({
				kind: "NodeShape",
				hasValue: [42],
			});
		});

		it("encodes a closed record as NodeShape with property shapes", () => {
			const desc = adapter.encode(product([field("name", base("string"))]));
			expect(desc.kind).toBe("NodeShape");
			if (desc.kind === "NodeShape") {
				expect(desc.closed).toBe(true);
				expect(desc.properties).toHaveLength(1);
				expect(desc.properties?.[0]?.path).toBe("name");
				expect(desc.properties?.[0]?.datatype).toBe("xsd:string");
				expect(desc.properties?.[0]?.minCount).toBe(1);
			}
		});

		it("encodes an open record with closed=false", () => {
			const desc = adapter.encode(product([field("x", base("integer"))], { open: true }));
			expect(desc.kind).toBe("NodeShape");
			if (desc.kind === "NodeShape") {
				expect(desc.closed).toBe(false);
			}
		});

		it("encodes optional fields with minCount: 0", () => {
			const desc = adapter.encode(
				product([field("nickname", base("string"), { optional: true })]),
			);
			if (desc.kind === "NodeShape") {
				expect(desc.properties?.[0]?.minCount).toBe(0);
			}
		});

		it("encodes a union of literals as sh:in", () => {
			const desc = adapter.encode(
				product([field("status", union([literal("active"), literal("inactive")]))]),
			);
			if (desc.kind === "NodeShape") {
				expect(desc.properties?.[0]?.in).toEqual(["active", "inactive"]);
			}
		});

		it("encodes a range refinement as sh:minInclusive / sh:maxInclusive", () => {
			const desc = adapter.encode(
				product([field("age", refinement(base("integer"), rangeConstraint(0, 120)))]),
			);
			if (desc.kind === "NodeShape") {
				const prop = desc.properties?.[0];
				expect(prop?.minInclusive).toBe(0);
				expect(prop?.maxInclusive).toBe(120);
			}
		});

		it("encodes nominal as sh:class", () => {
			const desc = adapter.encode(nominal("Person", product([field("id", base("integer"))])));
			if (desc.kind === "NodeShape") {
				expect(desc.class).toContain("Person");
			}
		});

		it("encodes complement as sh:not", () => {
			const desc = adapter.encode(complement(base("string")));
			if (desc.kind === "NodeShape") {
				expect(desc.not).toBeDefined();
			}
		});

		it("encodes array-of-T as a property with no maxCount cap", () => {
			const desc = adapter.encode(product([field("tags", array(base("string")))]));
			if (desc.kind === "NodeShape") {
				const prop = desc.properties?.[0];
				expect(prop?.datatype).toBe("xsd:string");
				expect(prop?.maxCount).toBeUndefined();
			}
		});
	});

	describe("parse: ShaclDescriptor → TypeTerm", () => {
		it("parses sh:datatype back to a base type", () => {
			const term = adapter.parse({ kind: "NodeShape", datatype: "xsd:integer" });
			expect(term.kind).toBe("base");
		});

		it("parses sh:in as a union of literals", () => {
			const term = adapter.parse({
				kind: "NodeShape",
				in: ["red", "green", "blue"],
			});
			expect(term.kind).toBe("apply");
		});

		it("parses a NodeShape with sh:closed=true to a closed product", () => {
			const desc: ShaclDescriptor = {
				kind: "NodeShape",
				closed: true,
				properties: [
					{ kind: "PropertyShape", path: "name", datatype: "xsd:string", minCount: 1, maxCount: 1 },
				],
			};
			const term = adapter.parse(desc);
			expect(term.kind).toBe("apply");
		});

		it("parses sh:class into a nominal node", () => {
			const term = adapter.parse({
				kind: "NodeShape",
				class: ["Person"],
				properties: [],
			});
			expect(term.kind).toBe("nominal");
		});

		it("records pathLoss when path is non-trivial", () => {
			const term = adapter.parse({
				kind: "NodeShape",
				properties: [
					{
						kind: "PropertyShape",
						path: { inverse: "knows" },
						datatype: "xsd:string",
						minCount: 1,
					},
				],
			});
			expect(term.kind).toBe("apply");
			if (term.kind === "apply") {
				const fld = term.fields?.[0];
				expect(fld?.annotations?.pathLoss).toBe(true);
			}
		});
	});

	describe("round-trip parse(encode(t)) preserves shape", () => {
		it("round-trips a primitive descriptor", () => {
			const desc: ShaclDescriptor = { kind: "NodeShape", datatype: "xsd:string" };
			const term = adapter.parse(desc);
			const reencoded = adapter.encode(term);
			expect(reencoded.kind).toBe("NodeShape");
		});

		it("round-trips a product with required + optional fields", () => {
			const term = product([
				field("name", base("string")),
				field("nickname", base("string"), { optional: true }),
			]);
			const encoded = adapter.encode(term);
			const parsed = adapter.parse(encoded);
			expect(parsed.kind).toBe("apply");
			if (parsed.kind === "apply") {
				expect(parsed.fields).toHaveLength(2);
				expect(parsed.fields?.[1]?.optional).toBe(true);
			}
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

		it("rejects values outside a range refinement", () => {
			const term = refinement(base("integer"), rangeConstraint(0, 10));
			expect(adapter.inhabits(5, term)).toBe(true);
			expect(adapter.inhabits(11, term)).toBe(false);
		});

		it("rejects complement matches", () => {
			expect(adapter.inhabits("x", complement(base("string")))).toBe(false);
			expect(adapter.inhabits(42, complement(base("string")))).toBe(true);
		});
	});

	describe("isEncodable / supportsKind", () => {
		it("encodable for the SHACL surface", () => {
			expect(adapter.isEncodable(base("string"))).toBe(true);
			expect(adapter.isEncodable(product([field("x", base("integer"))]))).toBe(true);
			expect(adapter.isEncodable(refinement(base("integer"), rangeConstraint(1, 9)))).toBe(true);
			expect(adapter.isEncodable(nominal("Person", base("string")))).toBe(true);
		});

		it("declares the SHACL-supported IR kinds via supportsKind", () => {
			for (const kind of [
				"bottom",
				"top",
				"literal",
				"base",
				"apply",
				"refinement",
				"nominal",
				"complement",
				"mu",
				"let",
				"extension",
			] as const) {
				expect(adapter.supportsKind(kind)).toBe(true);
			}
			expect(adapter.supportsKind("forall")).toBe(false);
			expect(adapter.supportsKind("keyof")).toBe(false);
		});

		it("returns false for unsupported higher-rank terms", () => {
			expect(adapter.isEncodable(forall("T", base("string")))).toBe(false);
		});
	});
});
