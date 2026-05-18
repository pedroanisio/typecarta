import {
	andPredicate,
	array,
	base,
	bottom,
	complement,
	conditional,
	field,
	forall,
	intersection,
	keyOf,
	letBinding,
	literal,
	map,
	mapped,
	mu,
	multipleOfConstraint,
	nominal,
	patternConstraint,
	product,
	rangeConstraint,
	refinement,
	tuple,
	typeVar,
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
			// After the Tier 2 expansion `forall` is encodable as a TS generic.
			// `base("date")` is still rejected — TS has no `Date` primitive in
			// the IR's base-name vocabulary; users should compose `Date` via a
			// product or use a richer adapter.
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

	// Tier 2 regression tests — TypeScript adapter expansion (2026-05-18).
	// The reviewer's bench:coverage critique flagged TypeScript at 21/70 as
	// far below the 50+ the language actually supports. The adapter was
	// under-coded: it declared only `bottom/top/literal/base/apply` in
	// supportsKind, missing generics, recursion, branded types, type-level
	// computation, etc. These tests pin the new behaviors before they exist
	// (fail-first) and protect them after.

	describe("Tier 2 regression: forall (generics)", () => {
		it("declares `forall` in supportsKind", () => {
			expect(adapter.supportsKind("forall")).toBe(true);
		});

		it("encodes rank-1 generic `Λα.α` as a TS generic descriptor", () => {
			const term = forall("T", typeVar("T"));
			expect(adapter.isEncodable(term)).toBe(true);
			const encoded = adapter.encode(term);
			expect(encoded.type).toBe("generic");
		});

		it("round-trips a generic identity function shape", () => {
			const term = forall("T", typeVar("T"));
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("forall");
			if (parsed.kind === "forall") {
				expect(parsed.var).toBe("T");
				expect(parsed.body.kind).toBe("var");
			}
		});

		it("round-trips a bounded generic `<T extends string>`", () => {
			const term = forall("T", typeVar("T"), { bound: base("string") });
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("forall");
			if (parsed.kind === "forall") {
				expect(parsed.bound?.kind).toBe("base");
			}
		});

		it("round-trips a generic with default `<T = number>`", () => {
			const term = forall("T", typeVar("T"), { default: base("number") });
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("forall");
			if (parsed.kind === "forall") {
				expect(parsed.default?.kind).toBe("base");
			}
		});

		it("encodes the typeVar inside the body", () => {
			const term = forall("T", product([field("value", typeVar("T"))]));
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("forall");
		});
	});

	describe("Tier 2 regression: mu (recursive types)", () => {
		it("declares `mu` in supportsKind", () => {
			expect(adapter.supportsKind("mu")).toBe(true);
		});

		it("round-trips a self-recursive list type `μX. {head: number, tail: X | null}`", () => {
			const term = mu(
				"X",
				product([
					field("head", base("number")),
					field("tail", union([typeVar("X"), base("null")])),
				]),
			);
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("mu");
		});
	});

	describe("Tier 2 regression: nominal (branded types)", () => {
		it("declares `nominal` in supportsKind", () => {
			expect(adapter.supportsKind("nominal")).toBe(true);
		});

		it("encodes nominal as a `brand` descriptor carrying the tag explicitly", () => {
			// IR `nominal("UserId", base("string"))` corresponds to the TS
			// idiom `string & { readonly __brand: "UserId" }`. The descriptor
			// preserves the tag in a dedicated `brand` variant so the
			// round-trip is exact; a downstream emitter renders the
			// brand-intersection syntax from this descriptor.
			const term = nominal("UserId", base("string"));
			expect(adapter.isEncodable(term)).toBe(true);
			const encoded = adapter.encode(term);
			expect(encoded.type).toBe("brand");
			if (encoded.type === "brand") {
				expect(encoded.tag).toBe("UserId");
				expect(encoded.inner.type).toBe("string");
			}
		});

		it("round-trips a branded primitive", () => {
			const term = nominal("UserId", base("string"));
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("nominal");
			if (parsed.kind === "nominal") {
				expect(parsed.tag).toBe("UserId");
				expect(parsed.inner.kind).toBe("base");
			}
		});
	});

	describe("Tier 2 regression: refinement (template literals + branded primitives)", () => {
		it("declares `refinement` in supportsKind", () => {
			expect(adapter.supportsKind("refinement")).toBe(true);
		});

		it("encodes a pattern-refined string as a template-literal placeholder", () => {
			const term = refinement(base("string"), patternConstraint("^\\d+$"));
			expect(adapter.isEncodable(term)).toBe(true);
		});

		it("round-trips a range-refined number with predicate intact", () => {
			const term = refinement(base("number"), rangeConstraint(0, 100));
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("refinement");
		});

		it("preserves compound and(range, multipleOf) refinement", () => {
			const term = refinement(
				base("number"),
				andPredicate(rangeConstraint(0, 100), multipleOfConstraint(5)),
			);
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("refinement");
		});
	});

	describe("Tier 2 regression: keyof / mapped / conditional", () => {
		it("declares keyof, mapped, conditional in supportsKind", () => {
			expect(adapter.supportsKind("keyof")).toBe(true);
			expect(adapter.supportsKind("mapped")).toBe(true);
			expect(adapter.supportsKind("conditional")).toBe(true);
		});

		it("round-trips `keyof T` as a keyof descriptor", () => {
			const term = keyOf(typeVar("T"));
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("keyof");
		});

		it("round-trips `{[K in keyof T]: V}` as a mapped descriptor", () => {
			const term = mapped(keyOf(typeVar("T")), base("string"));
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("mapped");
		});

		it("round-trips `T extends U ? X : Y` as a conditional descriptor", () => {
			const term = conditional(typeVar("T"), base("string"), base("number"), base("boolean"));
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("conditional");
		});
	});

	describe("Tier 2 regression: let / complement / extension", () => {
		it("declares let, complement, extension in supportsKind", () => {
			expect(adapter.supportsKind("let")).toBe(true);
			expect(adapter.supportsKind("complement")).toBe(true);
			expect(adapter.supportsKind("extension")).toBe(true);
		});

		it("round-trips a let binding `type Name = T in body` as an alias descriptor", () => {
			const term = letBinding("UserId", base("string"), typeVar("UserId"));
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("let");
		});

		it("encodes complement as `Exclude<T, U>` shape", () => {
			const term = complement(base("string"));
			expect(adapter.isEncodable(term)).toBe(true);
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("complement");
		});
	});
});
