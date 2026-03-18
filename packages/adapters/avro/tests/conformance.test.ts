import { array, base, bottom, field, forall, literal, map, product, union } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { AvroAdapter } from "../src/adapter.js";
import type { AvroSchema } from "../src/adapter.js";

const adapter = new AvroAdapter();

describe("AvroAdapter", () => {
	describe("parse → encode roundtrip", () => {
		it("roundtrips null primitive", () => {
			const schema: AvroSchema = "null";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips boolean primitive", () => {
			const schema: AvroSchema = "boolean";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips int primitive", () => {
			const schema: AvroSchema = "int";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips long primitive", () => {
			const schema: AvroSchema = "long";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips float primitive", () => {
			const schema: AvroSchema = "float";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips double primitive", () => {
			const schema: AvroSchema = "double";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips string primitive", () => {
			const schema: AvroSchema = "string";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips bytes primitive", () => {
			const schema: AvroSchema = "bytes";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips array schema", () => {
			const schema: AvroSchema = { type: "array", items: "string" };
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips map schema", () => {
			const schema: AvroSchema = { type: "map", values: "int" };
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});
	});

	describe("parse complex types", () => {
		it("parses a record schema", () => {
			const schema: AvroSchema = {
				type: "record",
				name: "Person",
				fields: [
					{ name: "name", type: "string" },
					{ name: "age", type: "int" },
				],
			};
			const term = adapter.parse(schema);
			expect(term.kind).toBe("apply");
		});

		it("parses an enum schema", () => {
			const schema: AvroSchema = {
				type: "enum",
				name: "Status",
				symbols: ["ACTIVE", "INACTIVE"],
			};
			const term = adapter.parse(schema);
			expect(term.kind).toBe("apply");
		});

		it("parses a union schema (array)", () => {
			const schema: AvroSchema = ["null", "string"];
			const term = adapter.parse(schema);
			expect(term.kind).toBe("apply");
		});

		it("parses an empty union as bottom", () => {
			const schema: AvroSchema = [];
			const term = adapter.parse(schema);
			expect(term.kind).toBe("bottom");
		});

		it("parses a fixed schema as bytes", () => {
			const schema: AvroSchema = { type: "fixed", name: "MD5", size: 16 };
			const term = adapter.parse(schema);
			expect(term.kind).toBe("base");
		});
	});

	describe("inhabits: true for matching values", () => {
		it("null value inhabits null primitive", () => {
			const term = adapter.parse("null");
			expect(adapter.inhabits(null, term)).toBe(true);
		});

		it("boolean value inhabits boolean primitive", () => {
			const term = adapter.parse("boolean");
			expect(adapter.inhabits(true, term)).toBe(true);
		});

		it("integer value inhabits int primitive", () => {
			const term = adapter.parse("int");
			expect(adapter.inhabits(42, term)).toBe(true);
		});

		it("float value inhabits double primitive", () => {
			const term = adapter.parse("double");
			expect(adapter.inhabits(3.14, term)).toBe(true);
		});

		it("string value inhabits string primitive", () => {
			const term = adapter.parse("string");
			expect(adapter.inhabits("hello", term)).toBe(true);
		});

		it("object value inhabits record schema", () => {
			const term = adapter.parse({
				type: "record",
				name: "Person",
				fields: [{ name: "name", type: "string" }],
			});
			expect(adapter.inhabits({ name: "Alice" }, term)).toBe(true);
		});

		it("array value inhabits array schema", () => {
			const term = adapter.parse({ type: "array", items: "string" });
			expect(adapter.inhabits(["a", "b"], term)).toBe(true);
		});

		it("string value inhabits nullable string union", () => {
			const term = adapter.parse(["null", "string"]);
			expect(adapter.inhabits("hello", term)).toBe(true);
			expect(adapter.inhabits(null, term)).toBe(true);
		});
	});

	describe("inhabits: false for non-matching values", () => {
		it("number does not inhabit string primitive", () => {
			const term = adapter.parse("string");
			expect(adapter.inhabits(42, term)).toBe(false);
		});

		it("string does not inhabit boolean primitive", () => {
			const term = adapter.parse("boolean");
			expect(adapter.inhabits("true", term)).toBe(false);
		});

		it("float does not inhabit int primitive", () => {
			const term = adapter.parse("int");
			expect(adapter.inhabits(3.14, term)).toBe(false);
		});

		it("wrong fields do not inhabit record schema", () => {
			const term = adapter.parse({
				type: "record",
				name: "Person",
				fields: [{ name: "name", type: "string" }],
			});
			expect(adapter.inhabits({ name: 42 }, term)).toBe(false);
		});

		it("wrong element type does not inhabit array schema", () => {
			const term = adapter.parse({ type: "array", items: "int" });
			expect(adapter.inhabits(["not", "numbers"], term)).toBe(false);
		});
	});

	describe("isEncodable", () => {
		it("returns true for supported terms", () => {
			expect(adapter.isEncodable(base("string"))).toBe(true);
			expect(adapter.isEncodable(base("int"))).toBe(true);
			expect(adapter.isEncodable(base("boolean"))).toBe(true);
			expect(adapter.isEncodable(base("double"))).toBe(true);
			expect(adapter.isEncodable(base("null"))).toBe(true);
			expect(adapter.isEncodable(array(base("string")))).toBe(true);
			expect(adapter.isEncodable(map(base("string"), base("int")))).toBe(true);
			expect(adapter.isEncodable(product([field("x", base("string"))]))).toBe(true);
		});

		it("returns false for unsupported terms", () => {
			expect(adapter.isEncodable(forall("T", base("string")))).toBe(false);
			// Avro has no top type
			expect(adapter.isEncodable(base("date"))).toBe(false);
		});
	});
});
