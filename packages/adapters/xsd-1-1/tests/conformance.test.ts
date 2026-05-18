import {
	andPredicate,
	array,
	base,
	bottom,
	conditional,
	field,
	forall,
	literal,
	multipleOfConstraint,
	product,
	rangeConstraint,
	refinement,
	typeVar,
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

		it("roundtrips a complex type with required and optional elements (name preserved)", () => {
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
				name: "Person",
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

	describe("XSD 1.1-only features", () => {
		// xs:assert is only emitted when an explicit XPath is supplied via the
		// `xsdAssertions` annotation. A bare `crossField: true` flag is no
		// longer enough — the audit's §4 fix removed the synthetic
		// `test="true()"` placeholder that always passed.
		it("encodes `xs:assert` only when an explicit XPath is supplied", () => {
			const withXpath = product(
				[field("min", base("integer")), field("max", base("integer"))],
				{ xsdAssertions: [{ test: "@min lt @max" }] },
			);
			const encoded = adapter.encode(withXpath);
			expect(encoded.kind).toBe("complexType");
			if (encoded.kind === "complexType") {
				expect(encoded.assertions).toEqual([{ test: "@min lt @max" }]);
			}

			const withoutXpath = product(
				[field("min", base("integer")), field("max", base("integer"))],
				{ crossField: true },
			);
			const encodedBare = adapter.encode(withoutXpath);
			expect(encodedBare.kind).toBe("complexType");
			if (encodedBare.kind === "complexType") {
				expect(encodedBare.assertions).toBeUndefined();
			}
		});

		it("round-trips `xs:assert` through parse → encode", () => {
			const desc: XsdDescriptor = {
				kind: "complexType",
				elements: [
					{ name: "min", type: { kind: "primitive", name: "integer" } },
					{ name: "max", type: { kind: "primitive", name: "integer" } },
				],
				assertions: [{ test: "@min lt @max" }],
			};
			const term = adapter.parse(desc);
			const reencoded = adapter.encode(term);
			expect(reencoded.kind).toBe("complexType");
			if (reencoded.kind === "complexType") {
				expect(reencoded.assertions).toEqual([{ test: "@min lt @max" }]);
			}
		});

		it("encodes a `conditional` field as `xs:alternative` chain", () => {
			const condField = conditional(
				typeVar("ctx"),
				base("string"),
				base("integer"),
				base("string"),
			);
			const encoded = adapter.encode(product([field("value", condField)]));
			expect(encoded.kind).toBe("complexType");
			if (encoded.kind === "complexType") {
				const valueEl = encoded.elements.find((e) => e.name === "value");
				expect(valueEl?.alternatives).toBeDefined();
				expect(valueEl?.alternatives?.length).toBeGreaterThanOrEqual(2);
			}
		});

		it("supports the `conditional` kind (1.1-only)", () => {
			expect(adapter.supportsKind("conditional")).toBe(true);
		});

		it("round-trips a complexType with openContent", () => {
			const desc: XsdDescriptor = {
				kind: "complexType",
				elements: [{ name: "name", type: { kind: "primitive", name: "string" } }],
				openContent: { mode: "interleave" },
			};
			const term = adapter.parse(desc);
			const reencoded = adapter.encode(term);
			expect(reencoded.kind).toBe("complexType");
			if (reencoded.kind === "complexType") {
				expect(reencoded.openContent).toEqual({ mode: "interleave" });
			}
		});

		// ─── xs:assert shim for divisibility (lifts pi-prime-40 / -41 on 1.1) ──
		//
		// XSD has no `multipleOf` facet in 1.0 OR 1.1. But 1.1's `xs:assert`
		// can express `$value mod N = 0` as an XPath 2.0 boolean test. The
		// 1.1 adapter splits a predicate tree on encounter of multipleOf,
		// emitting facets for the rest and assertions for the divisibility
		// piece. These regression tests pin that behavior so a future
		// refactor can't silently lose it.

		it("encodes a bare multipleOf as an xs:assert (not a facet)", () => {
			const term = refinement(base("integer"), multipleOfConstraint(3));
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("simpleType");
			if (encoded.kind === "simpleType") {
				// No multipleOf in the facet record (XSD has no such facet).
				expect((encoded.facets as { multipleOf?: unknown }).multipleOf).toBeUndefined();
				// xs:assert carries the divisibility XPath.
				expect(encoded.facets?.assertions).toEqual([{ test: "$value mod 3 = 0" }]);
			}
		});

		it("encodes range ∧ multipleOf as facets + xs:assert (the SP41 shape)", () => {
			const term = refinement(
				base("number"),
				andPredicate(rangeConstraint(0, 100), multipleOfConstraint(5)),
			);
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("simpleType");
			if (encoded.kind === "simpleType") {
				expect(encoded.facets?.minInclusive).toBe(0);
				expect(encoded.facets?.maxInclusive).toBe(100);
				expect(encoded.facets?.assertions).toEqual([{ test: "$value mod 5 = 0" }]);
			}
		});

		it("round-trips multipleOf via the xs:assert ↔ predicate convention", () => {
			const original = refinement(base("integer"), multipleOfConstraint(7));
			const encoded = adapter.encode(original);
			const parsed = adapter.parse(encoded);
			// The parsed term must carry a `multipleOf` predicate somewhere so
			// pi-prime-40 (and pi-prime-41 by extension) can recognize it.
			expect(parsed.kind).toBe("refinement");
			if (parsed.kind === "refinement") {
				const findMultipleOf = (p: typeof parsed.predicate): boolean => {
					if (p.kind === "multipleOf") return p.divisor === 7;
					if (p.kind === "and") return findMultipleOf(p.left) || findMultipleOf(p.right);
					return false;
				};
				expect(findMultipleOf(parsed.predicate)).toBe(true);
			}
		});

		it("ignores xs:assert tests that don't match the multipleOf shape", () => {
			// Non-divisibility assertions stay on the simpleType as opaque
			// xs:assert children; they don't poison the parse path.
			const desc: XsdDescriptor = {
				kind: "simpleType",
				base: { kind: "primitive", name: "integer" },
				facets: { assertions: [{ test: "$value gt 0" }] },
			};
			const parsed = adapter.parse(desc);
			// No multipleOf was recognized — parse falls through to the core,
			// which emits a refinement with a custom `xsd:assertions` predicate.
			expect(parsed.kind).toBe("refinement");
		});
	});
});
