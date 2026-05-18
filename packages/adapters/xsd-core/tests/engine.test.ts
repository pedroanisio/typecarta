import {
	array,
	base,
	conditional,
	field,
	literal,
	multipleOfConstraint,
	product,
	refinement,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";
import {
	BASE_SUPPORTED_KINDS,
	XSD_BUILTIN_DERIVED_NAMES_10,
	XSD_FACET_KEYS_10,
	XSD_FACET_KEYS_11,
	XSD_PRIMITIVE_NAMES_10,
	XSD_PRIMITIVE_NAMES_11,
	createEngine,
} from "../src/index.js";

const xsd10 = createEngine({
	builtinNames: new Set([...XSD_PRIMITIVE_NAMES_10, ...XSD_BUILTIN_DERIVED_NAMES_10]),
	allowedFacets: new Set(XSD_FACET_KEYS_10),
	supportedKinds: BASE_SUPPORTED_KINDS,
});

const xsd11 = createEngine({
	builtinNames: new Set([...XSD_PRIMITIVE_NAMES_11, ...XSD_BUILTIN_DERIVED_NAMES_10]),
	allowedFacets: new Set(XSD_FACET_KEYS_11),
	supportedKinds: new Set([...BASE_SUPPORTED_KINDS, "conditional"] as const),
});

describe("xsd-core engine", () => {
	it("encodes XSD 1.0 primitives but rejects 1.1-only datatypes", () => {
		expect(xsd10.encode(base("dateTime")).kind).toBe("primitive");
		expect(() => xsd10.encode(base("dateTimeStamp"))).toThrow(/Cannot encode base/);
	});

	it("encodes XSD 1.1 primitives that 1.0 rejects", () => {
		expect(xsd11.encode(base("dateTimeStamp"))).toEqual({
			kind: "primitive",
			name: "dateTimeStamp",
		});
		expect(xsd11.encode(base("dayTimeDuration")).kind).toBe("primitive");
		expect(xsd11.encode(base("anyAtomicType")).kind).toBe("primitive");
	});

	it("refuses to encode multipleOf in either version (not an XSD facet)", () => {
		const term = refinement(base("integer"), multipleOfConstraint(3));
		expect(() => xsd10.encode(term)).toThrow(/multipleOf/);
		expect(() => xsd11.encode(term)).toThrow(/multipleOf/);
	});

	it("includes 'conditional' in 1.1 supportedKinds but not 1.0", () => {
		expect(xsd10.supportsKind("conditional")).toBe(false);
		expect(xsd11.supportsKind("conditional")).toBe(true);
	});

	it("emits xs:complexType (not illegal xs:list) for array-of-record", () => {
		const term = array(product([field("id", base("string"))]));
		const encoded = xsd10.encode(term);
		expect(encoded.kind).toBe("complexType");
	});

	// §11 from the XSD 1.1 audit: conditional inhabits semantics.
	describe("conditional inhabits", () => {
		// When check.kind === extends.kind (structurally trivial test), the
		// conditional collapses to `then`. A value that matches `then` only
		// is accepted; a value that matches `else` only is rejected.
		it("picks `then` when check and extends share kinds", () => {
			const cond = conditional(literal("foo"), literal("foo"), base("string"), base("number"));
			expect(xsd11.inhabits("hello", cond)).toBe(true); // string ∈ then
			expect(xsd11.inhabits(42, cond)).toBe(false); // number ∈ else only — rejected
		});

		// When the kinds differ, the test is opaque; accept either branch.
		it("falls back to union over branches when check and extends differ", () => {
			const cond = conditional(base("string"), literal("foo"), base("string"), base("number"));
			expect(xsd11.inhabits("hello", cond)).toBe(true);
			expect(xsd11.inhabits(42, cond)).toBe(true);
		});
	});
});
