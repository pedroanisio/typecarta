import { array, base, bottom, field, forall, map, product, union } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { ProtobufAdapter } from "../src/adapter.js";
import type { ProtobufDescriptor } from "../src/adapter.js";

const adapter = new ProtobufAdapter();

describe("ProtobufAdapter", () => {
	describe("parse → encode roundtrip", () => {
		it("roundtrips scalar string", () => {
			const desc: ProtobufDescriptor = { type: "scalar", scalar: "string" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips scalar int32", () => {
			const desc: ProtobufDescriptor = { type: "scalar", scalar: "int32" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips scalar bool", () => {
			const desc: ProtobufDescriptor = { type: "scalar", scalar: "bool" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips scalar double", () => {
			const desc: ProtobufDescriptor = { type: "scalar", scalar: "double" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips repeated field", () => {
			const desc: ProtobufDescriptor = {
				type: "repeated",
				element: { type: "scalar", scalar: "string" },
			};
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips map field", () => {
			const desc: ProtobufDescriptor = {
				type: "map",
				key: { type: "scalar", scalar: "string" },
				value: { type: "scalar", scalar: "int32" },
			};
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});
	});

	describe("parse complex types", () => {
		it("parses a message descriptor", () => {
			const desc: ProtobufDescriptor = {
				type: "message",
				name: "Person",
				fields: [
					{ name: "name", type: { type: "scalar", scalar: "string" }, number: 1 },
					{ name: "age", type: { type: "scalar", scalar: "int32" }, number: 2 },
				],
			};
			const term = adapter.parse(desc);
			expect(term.kind).toBe("apply");
		});

		it("parses an enum descriptor", () => {
			const desc: ProtobufDescriptor = {
				type: "enum",
				name: "Status",
				values: { UNKNOWN: 0, ACTIVE: 1, INACTIVE: 2 },
			};
			const term = adapter.parse(desc);
			expect(term.kind).toBe("apply");
		});

		it("parses a oneof descriptor", () => {
			const desc: ProtobufDescriptor = {
				type: "oneof",
				name: "id_type",
				options: [
					{ name: "user_id", type: { type: "scalar", scalar: "string" }, number: 1 },
					{ name: "org_id", type: { type: "scalar", scalar: "int32" }, number: 2 },
				],
			};
			const term = adapter.parse(desc);
			expect(term.kind).toBe("apply");
		});
	});

	describe("inhabits: true for matching values", () => {
		it("string value inhabits string scalar", () => {
			const term = adapter.parse({ type: "scalar", scalar: "string" });
			expect(adapter.inhabits("hello", term)).toBe(true);
		});

		it("integer value inhabits int32 scalar", () => {
			const term = adapter.parse({ type: "scalar", scalar: "int32" });
			expect(adapter.inhabits(42, term)).toBe(true);
		});

		it("boolean value inhabits bool scalar", () => {
			const term = adapter.parse({ type: "scalar", scalar: "bool" });
			expect(adapter.inhabits(true, term)).toBe(true);
		});

		it("float value inhabits double scalar", () => {
			const term = adapter.parse({ type: "scalar", scalar: "double" });
			expect(adapter.inhabits(3.14, term)).toBe(true);
		});

		it("object value inhabits message", () => {
			const term = adapter.parse({
				type: "message",
				name: "Person",
				fields: [{ name: "name", type: { type: "scalar", scalar: "string" }, number: 1 }],
			});
			expect(adapter.inhabits({ name: "Alice" }, term)).toBe(true);
		});

		it("array value inhabits repeated", () => {
			const term = adapter.parse({
				type: "repeated",
				element: { type: "scalar", scalar: "string" },
			});
			expect(adapter.inhabits(["a", "b"], term)).toBe(true);
		});
	});

	describe("inhabits: false for non-matching values", () => {
		it("number does not inhabit string scalar", () => {
			const term = adapter.parse({ type: "scalar", scalar: "string" });
			expect(adapter.inhabits(42, term)).toBe(false);
		});

		it("float does not inhabit int32 scalar", () => {
			const term = adapter.parse({ type: "scalar", scalar: "int32" });
			expect(adapter.inhabits(3.14, term)).toBe(false);
		});

		it("string does not inhabit bool scalar", () => {
			const term = adapter.parse({ type: "scalar", scalar: "bool" });
			expect(adapter.inhabits("true", term)).toBe(false);
		});

		it("wrong fields do not inhabit message", () => {
			const term = adapter.parse({
				type: "message",
				name: "Person",
				fields: [{ name: "name", type: { type: "scalar", scalar: "string" }, number: 1 }],
			});
			expect(adapter.inhabits({ name: 42 }, term)).toBe(false);
		});
	});

	describe("isEncodable", () => {
		it("returns true for supported terms", () => {
			expect(adapter.isEncodable(base("string"))).toBe(true);
			expect(adapter.isEncodable(base("int32"))).toBe(true);
			expect(adapter.isEncodable(base("bool"))).toBe(true);
			expect(adapter.isEncodable(base("double"))).toBe(true);
			expect(adapter.isEncodable(array(base("string")))).toBe(true);
			expect(adapter.isEncodable(map(base("string"), base("int32")))).toBe(true);
			expect(adapter.isEncodable(product([field("x", base("string"))]))).toBe(true);
		});

		it("returns false for unsupported terms", () => {
			expect(adapter.isEncodable(forall("T", base("string")))).toBe(false);
			expect(adapter.isEncodable(bottom())).toBe(false);
		});
	});
});
