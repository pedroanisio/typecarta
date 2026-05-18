import {
	array,
	base,
	bottom,
	extension,
	field,
	forall,
	literal,
	multipleOfConstraint,
	nominal,
	product,
	rangeConstraint,
	refinement,
	top,
	union,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";
import type { LinkmlDescriptor } from "../src/adapter.js";
import { LinkmlAdapter } from "../src/adapter.js";

const adapter = new LinkmlAdapter();

describe("LinkmlAdapter", () => {
	describe("identity", () => {
		it("names itself LinkML and pins specVersion 1.11", () => {
			expect(adapter.name).toBe("LinkML");
			expect(adapter.specVersion).toBe("1.11");
		});
	});

	describe("primitives", () => {
		it("round-trips every LinkML built-in name", () => {
			const names = [
				"string",
				"integer",
				"boolean",
				"float",
				"double",
				"decimal",
				"date",
				"datetime",
				"uri",
				"curie",
				"ncname",
			];
			for (const name of names) {
				expect(adapter.encode(base(name))).toEqual({ kind: "builtin", name });
				expect(adapter.parse({ kind: "builtin", name } as LinkmlDescriptor)).toEqual(
					base(name),
				);
			}
		});

		it("maps the IR `number` alias to LinkML `decimal`", () => {
			expect(adapter.encode(base("number"))).toEqual({ kind: "builtin", name: "decimal" });
		});

		it("refuses to encode bare base(null)", () => {
			expect(adapter.isEncodable(base("null"))).toBe(false);
			expect(() => adapter.encode(base("null"))).toThrow(/null is not a LinkML type/);
		});

		it("refuses to encode unknown base types", () => {
			expect(adapter.isEncodable(base("xyz"))).toBe(false);
		});
	});

	describe("classes (products) with attributes", () => {
		it("encodes a product as a LinkML class with attributes", () => {
			const term = product([
				field("name", base("string")),
				field("age", base("integer"), { optional: true }),
			]);
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("class");
			if (encoded.kind === "class") {
				expect(encoded.attributes?.name).toEqual({
					name: "name",
					range: "string",
					required: true,
				});
				// optional → no required key
				expect(encoded.attributes?.age?.required).toBeUndefined();
				expect(encoded.attributes?.age?.range).toBe("integer");
			}
		});

		it("preserves the class name through letBinding", () => {
			const classDesc: LinkmlDescriptor = {
				kind: "class",
				name: "Person",
				attributes: {
					name: { name: "name", range: "string", required: true },
				},
			};
			const term = adapter.parse(classDesc);
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("class");
			if (encoded.kind === "class") expect(encoded.name).toBe("Person");
		});

		it("multivalued slot → array(T) in IR", () => {
			const classDesc: LinkmlDescriptor = {
				kind: "class",
				name: "Tagged",
				attributes: {
					tags: { name: "tags", range: "string", multivalued: true },
				},
			};
			const term = adapter.parse(classDesc);
			// drill into the letBinding's body
			expect(term.kind).toBe("let");
			if (term.kind === "let") {
				expect(term.binding.kind).toBe("apply");
				if (term.binding.kind === "apply" && term.binding.constructor === "product") {
					const tagsField = term.binding.fields?.find((f) => f.name === "tags");
					expect(tagsField?.type.kind).toBe("apply");
					if (tagsField?.type.kind === "apply") {
						expect(tagsField.type.constructor).toBe("array");
					}
				}
			}
		});
	});

	describe("inheritance and mixins", () => {
		it("is_a → intersection with nominal parent", () => {
			const classDesc: LinkmlDescriptor = {
				kind: "class",
				name: "Employee",
				is_a: "Person",
				attributes: {
					department: { name: "department", range: "string", required: true },
				},
			};
			const term = adapter.parse(classDesc);
			expect(term.kind).toBe("let");
			if (term.kind === "let") {
				// body should be an intersection of (product, nominal("Person"))
				expect(term.binding.kind).toBe("apply");
				if (term.binding.kind === "apply") {
					expect(term.binding.constructor).toBe("intersection");
				}
			}
		});

		it("mixins → multiple intersection arms", () => {
			const classDesc: LinkmlDescriptor = {
				kind: "class",
				name: "C",
				mixins: ["MixinA", "MixinB"],
				attributes: {},
			};
			const term = adapter.parse(classDesc);
			expect(term.kind).toBe("let");
		});
	});

	describe("enums", () => {
		it("permissible_values → union of literals", () => {
			const enumDesc: LinkmlDescriptor = {
				kind: "enum",
				name: "Color",
				permissible_values: {
					red: { text: "red" },
					green: { text: "green" },
					blue: { text: "blue" },
				},
			};
			const term = adapter.parse(enumDesc);
			expect(term.kind).toBe("let");
			if (term.kind === "let") {
				expect(term.binding.kind).toBe("apply");
				if (term.binding.kind === "apply") expect(term.binding.constructor).toBe("union");
			}
		});

		it("permissible_value.meaning (URI) → nominal wrapper around the literal", () => {
			const enumDesc: LinkmlDescriptor = {
				kind: "enum",
				name: "Country",
				permissible_values: {
					BR: { text: "BR", meaning: "https://www.geonames.org/3469034/" },
				},
			};
			const term = adapter.parse(enumDesc);
			expect(term.kind).toBe("let");
			if (term.kind === "let") {
				expect(term.binding.kind).toBe("nominal");
			}
		});

		it("empty enum → bottom binding", () => {
			const enumDesc: LinkmlDescriptor = {
				kind: "enum",
				name: "Nothing",
				permissible_values: {},
			};
			const term = adapter.parse(enumDesc);
			expect(term.kind).toBe("let");
			if (term.kind === "let") expect(term.binding.kind).toBe("bottom");
		});
	});

	describe("constraints", () => {
		it("range constraint on a slot → refinement(base, range)", () => {
			const cls: LinkmlDescriptor = {
				kind: "class",
				name: "Range",
				attributes: {
					n: { name: "n", range: "integer", minimum_value: 0, maximum_value: 100, required: true },
				},
			};
			const term = adapter.parse(cls);
			expect(term.kind).toBe("let");
		});

		it("pattern constraint on a slot → refinement(string, pattern)", () => {
			const cls: LinkmlDescriptor = {
				kind: "class",
				name: "P",
				attributes: {
					code: { name: "code", range: "string", pattern: "^[A-Z]{3}$", required: true },
				},
			};
			const term = adapter.parse(cls);
			expect(term.kind).toBe("let");
		});

		it("refuses to encode multipleOf (LinkML has no equivalent)", () => {
			const term = refinement(base("integer"), multipleOfConstraint(3));
			expect(adapter.isEncodable(term)).toBe(false);
		});
	});

	describe("rules", () => {
		it("class.rules with expression → xsd-assert extension wrapping the class", () => {
			const cls: LinkmlDescriptor = {
				kind: "class",
				name: "MinMax",
				attributes: {
					min: { name: "min", range: "integer", required: true },
					max: { name: "max", range: "integer", required: true },
				},
				rules: [{ expression: "@max gt @min" }],
			};
			const term = adapter.parse(cls);
			expect(term.kind).toBe("let");
			if (term.kind === "let") {
				expect(term.binding.kind).toBe("extension");
				if (term.binding.kind === "extension") {
					expect(term.binding.extensionKind).toBe("xsd-assert");
				}
			}
		});

		it("encodes an xsd-assert extension wrapping a class as LinkML rules", () => {
			const term = extension(
				"xsd-assert",
				{ test: "@a gt @b" },
				[product([field("a", base("integer")), field("b", base("integer"))])],
			);
			const encoded = adapter.encode(term);
			expect(encoded.kind).toBe("class");
			if (encoded.kind === "class") {
				expect(encoded.rules).toEqual([{ expression: "@a gt @b" }]);
			}
		});
	});

	describe("URIs and mappings", () => {
		it("class_uri → nominal wrapper around the class body", () => {
			const cls: LinkmlDescriptor = {
				kind: "class",
				name: "Person",
				class_uri: "https://schema.org/Person",
				attributes: { name: { name: "name", range: "string", required: true } },
			};
			const term = adapter.parse(cls);
			expect(term.kind).toBe("let");
			if (term.kind === "let") expect(term.binding.kind).toBe("nominal");
		});

		it("slot_uri stored in the field's annotations", () => {
			const cls: LinkmlDescriptor = {
				kind: "class",
				name: "Person",
				attributes: {
					name: {
						name: "name",
						range: "string",
						required: true,
						slot_uri: "https://schema.org/name",
					},
				},
			};
			const term = adapter.parse(cls);
			expect(term.kind).toBe("let");
			if (term.kind === "let" && term.binding.kind === "apply") {
				const f = term.binding.fields?.find((x) => x.name === "name");
				expect((f?.annotations as { slot_uri?: string } | undefined)?.slot_uri).toBe(
					"https://schema.org/name",
				);
			}
		});
	});

	describe("schema and imports", () => {
		it("schema with tree_root class → extension(module) wrapping that class", () => {
			const schema: LinkmlDescriptor = {
				kind: "schema",
				id: "https://example.org/my-schema",
				name: "my_schema",
				imports: ["linkml:types"],
				classes: {
					Root: {
						name: "Root",
						tree_root: true,
						attributes: { id: { name: "id", range: "string", required: true } },
					},
				},
			};
			const term = adapter.parse(schema);
			expect(term.kind).toBe("extension");
			if (term.kind === "extension") {
				expect(term.extensionKind).toBe("module");
				expect(term.payload).toMatchObject({
					name: "my_schema",
					targetNamespace: "https://example.org/my-schema",
					imports: ["linkml:types"],
				});
			}
		});
	});

	describe("inhabits", () => {
		it("accepts a value matching a LinkML class structurally", () => {
			const cls: LinkmlDescriptor = {
				kind: "class",
				name: "Person",
				attributes: {
					name: { name: "name", range: "string", required: true },
					age: { name: "age", range: "integer", required: false },
				},
			};
			const term = adapter.parse(cls);
			expect(adapter.inhabits({ name: "Alice", age: 30 }, term)).toBe(true);
			expect(adapter.inhabits({ name: "Bob" }, term)).toBe(true);
			expect(adapter.inhabits({ age: 30 }, term)).toBe(false);
			expect(adapter.inhabits({ name: 42 }, term)).toBe(false);
		});

		it("rejects values for bottom and accepts anything for top", () => {
			expect(adapter.inhabits("anything", bottom())).toBe(false);
			expect(adapter.inhabits("anything", top())).toBe(true);
		});

		it("checks enum membership", () => {
			const term = union([literal("a"), literal("b"), literal("c")]);
			expect(adapter.inhabits("a", term)).toBe(true);
			expect(adapter.inhabits("z", term)).toBe(false);
		});
	});

	describe("isEncodable", () => {
		it("returns true for LinkML-representable terms", () => {
			expect(adapter.isEncodable(base("string"))).toBe(true);
			expect(adapter.isEncodable(literal("ready"))).toBe(true);
			expect(adapter.isEncodable(product([field("n", base("integer"))]))).toBe(true);
		});

		it("returns false for unsupported higher-order terms", () => {
			expect(adapter.isEncodable(forall("T", base("string")))).toBe(false);
		});

		it("refuses bare union (LinkML has no top-level union type)", () => {
			expect(adapter.isEncodable(union([base("string"), base("integer")]))).toBe(false);
		});

		it("refuses bare array (LinkML expresses multivalued at slot level)", () => {
			expect(adapter.isEncodable(array(base("string")))).toBe(false);
		});
	});

	describe("intersection encoding", () => {
		it("merges two products into a single class", () => {
			const a = product([field("id", base("string"))]);
			const b = product([field("name", base("string"))]);
			const intersected = {
				kind: "apply" as const,
				constructor: "intersection" as const,
				args: [a, b] as const,
			};
			const encoded = adapter.encode(intersected);
			expect(encoded.kind).toBe("class");
			if (encoded.kind === "class") {
				expect(Object.keys(encoded.attributes ?? {}).sort()).toEqual(["id", "name"]);
			}
		});

		it("product ∩ nominal → class with is_a", () => {
			const intersected = {
				kind: "apply" as const,
				constructor: "intersection" as const,
				args: [product([field("dept", base("string"))]), nominal("Person", top())] as const,
			};
			const encoded = adapter.encode(intersected);
			expect(encoded.kind).toBe("class");
			if (encoded.kind === "class") expect(encoded.is_a).toBe("Person");
		});

		it("combines refinement facets", () => {
			const intersected = {
				kind: "apply" as const,
				constructor: "intersection" as const,
				args: [
					refinement(base("integer"), rangeConstraint(0)),
					refinement(base("integer"), rangeConstraint(undefined, 100)),
				] as const,
			};
			const encoded = adapter.encode(intersected);
			expect(encoded.kind).toBe("type");
			if (encoded.kind === "type") {
				expect(encoded.minimum_value).toBe(0);
				expect(encoded.maximum_value).toBe(100);
			}
		});
	});
});
