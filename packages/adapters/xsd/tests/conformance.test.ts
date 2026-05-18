import {
	array,
	base,
	bottom,
	extension,
	field,
	forall,
	letBinding,
	literal,
	multipleOfConstraint,
	nominal,
	product,
	rangeConstraint,
	refinement,
	set,
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

	// ─── Audit-driven fixes (defects §4–§7 + new gap features) ──────────
	describe("audit fixes", () => {
		// §5: multipleOf is a JSON Schema invention, not an XSD facet.
		it("refuses to encode multipleOfConstraint", () => {
			expect(adapter.isEncodable(refinement(base("integer"), multipleOfConstraint(3)))).toBe(false);
			expect(() => adapter.encode(refinement(base("integer"), multipleOfConstraint(3)))).toThrow(
				/multipleOf/,
			);
		});

		// §6: xs:list requires an atomic itemType (Part 2 §4.2.1.1). Arrays of
		// records must encode as a complexType with a repeating element.
		it("encodes array-of-record as complexType, not xs:list", () => {
			const term = array(product([field("id", base("string"))]));
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("complexType");
			if (encoded.kind === "complexType") {
				expect(encoded.elements[0]?.maxOccurs).toBe("unbounded");
			}
		});

		// §7: bare base("null") has no XSD representation; should reject.
		it("refuses to encode bare base(null)", () => {
			expect(adapter.isEncodable(base("null"))).toBe(false);
			expect(() => adapter.encode(base("null"))).toThrow(/null/);
		});

		// §4: intersection of two products merges via xs:complexType extension.
		it("encodes product ∩ product by merging fields", () => {
			const a = product([field("id", base("string"))]);
			const b = product([field("name", base("string"))]);
			const intersected = {
				kind: "apply" as const,
				constructor: "intersection" as const,
				args: [a, b] as const,
			};
			const encoded = adapter.encode(intersected);
			expect(encoded.kind).toBe("complexType");
			if (encoded.kind === "complexType") {
				expect(encoded.elements.map((e) => e.name)).toEqual(["id", "name"]);
			}
		});
	});

	// ─── New gap features (§1, §2, §9–§13) ──────────────────────────────
	describe("XSD 1.0 features added in the audit", () => {
		// §1: previously unmodeled primitives.
		it("encodes all 19 primitive datatypes including duration/gYear/QName", () => {
			for (const name of ["duration", "gYear", "gMonth", "QName", "hexBinary", "base64Binary"]) {
				expect(adapter.isEncodable(base(name))).toBe(true);
				expect(adapter.encode(base(name))).toEqual({ kind: "primitive", name });
			}
		});

		// §1: previously unmodeled derived datatypes.
		it("encodes the common derived datatypes as primitive names", () => {
			for (const name of ["long", "int", "positiveInteger", "token", "ID", "NMTOKEN"]) {
				expect(adapter.isEncodable(base(name))).toBe(true);
				expect(adapter.encode(base(name))).toEqual({ kind: "primitive", name });
			}
		});

		// §2: all 12 facets via the round-trip path.
		it("roundtrips length / minLength / maxLength facets via custom predicates", () => {
			const desc: XsdDescriptor = {
				kind: "simpleType",
				base: { kind: "primitive", name: "string" },
				facets: { minLength: 1, maxLength: 64 },
			};
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("simpleType");
			if (encoded.kind === "simpleType") {
				expect(encoded.facets).toMatchObject({ minLength: 1, maxLength: 64 });
			}
		});

		// §2: exclusive range maps to minExclusive/maxExclusive, not min/maxInclusive.
		it("emits minExclusive/maxExclusive for exclusive range predicates", () => {
			const encoded = adapter.encode(
				refinement(base("integer"), {
					kind: "range",
					min: 0,
					max: 100,
					exclusive: true,
				}),
			);
			expect(encoded.kind).toBe("simpleType");
			if (encoded.kind === "simpleType") {
				expect(encoded.facets).toEqual({ minExclusive: 0, maxExclusive: 100 });
			}
		});

		// §10: xs:keyref via the foreign-key extension witness shape.
		it("encodes foreign-key extension as xs:keyref on a complexType", () => {
			const term = extension(
				"foreign-key",
				{
					sourceField: "authorId",
					targetCollection: "users",
					targetField: "id",
				},
				[product([field("authorId", base("string")), field("title", base("string"))])],
			);
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("complexType");
			if (encoded.kind === "complexType") {
				expect(encoded.identityConstraints?.[0]?.kind).toBe("keyref");
				expect(encoded.identityConstraints?.[0]?.refer).toBe("users_key");
			}
		});

		// §10: xs:unique via path-constraint extension.
		it("encodes path-constraint extension as xs:unique on a complexType", () => {
			const term = extension(
				"path-constraint",
				{ path: "$.zipCode", constraint: "unique" },
				[product([field("zipCode", base("string"))])],
			);
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("complexType");
			if (encoded.kind === "complexType") {
				expect(encoded.identityConstraints?.[0]?.kind).toBe("unique");
			}
		});

		// §11: xs:schema with targetNamespace via module extension.
		it("encodes module extension as xs:schema with targetNamespace", () => {
			const term = extension("module", { name: "UserModule" }, [
				product([field("id", base("string"))]),
			]);
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("schema");
			if (encoded.kind === "schema") {
				expect(encoded.targetNamespace).toBe("urn:typecarta:UserModule");
				expect(encoded.types).toHaveLength(1);
			}
		});

		// §12: final/block via visibility extension level.
		it("encodes visibility=sealed as final=#all on the underlying complexType", () => {
			const term = extension("visibility", { level: "sealed" }, [
				product([field("id", base("string"))]),
			]);
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("complexType");
			if (encoded.kind === "complexType") {
				expect(encoded.final).toBe("#all");
			}
		});

		// §9: xs:annotation round-trips through IR Annotations.
		it("roundtrips xs:annotation documentation through complexType", () => {
			const desc: XsdDescriptor = {
				kind: "complexType",
				name: "Person",
				elements: [{ name: "id", type: { kind: "primitive", name: "string" } }],
				annotation: { documentation: "A natural person." },
			};
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("complexType");
			if (encoded.kind === "complexType") {
				expect(encoded.annotation?.documentation).toBe("A natural person.");
			}
		});

		// nominal → named simpleType wrapper, supportsKind('nominal') = true.
		it("encodes nominal wrappers as named simple/complex types", () => {
			const term = nominal("UserId", base("string"));
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("simpleType");
			if (encoded.kind === "simpleType") {
				expect(encoded.name).toBe("UserId");
			}
		});

		// let → named type alias, supportsKind('let') = true.
		it("encodes let-binding as a named simple/complex type", () => {
			const term = letBinding("Age", refinement(base("integer"), rangeConstraint(0, 150)), base("Age"));
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("simpleType");
			if (encoded.kind === "simpleType") {
				expect(encoded.name).toBe("Age");
				expect(encoded.facets).toEqual({ minInclusive: 0, maxInclusive: 150 });
			}
		});

		// set → xs:list-style descriptor over atomic items; inhabitation enforces uniqueness.
		it("encodes set of atomic items as kind=set; rejects duplicates on inhabits", () => {
			const term = set(base("integer"));
			expect(adapter.encode(term).kind).toBe("set");
			expect(adapter.inhabits([1, 2, 3], term)).toBe(true);
			expect(adapter.inhabits([1, 1], term)).toBe(false);
		});
	});
});
