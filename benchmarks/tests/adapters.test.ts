import { describe, expect, it } from "vitest";
import { buildAllAdapters } from "../adapters.js";

describe("benchmark adapter sweep", () => {
	it("includes LinkML in bench:all adapter coverage", () => {
		const adapterNames = buildAllAdapters().map((adapter) => adapter.name);

		expect(adapterNames).toContain("LinkML");
		expect(adapterNames).toEqual([
			"xsd",
			"xsd-1-1",
			"Zod",
			"JSON Schema",
			"TypeScript",
			"Protocol Buffers",
			"GraphQL",
			"LinkML",
			"Effect Schema",
			"Apache Avro",
			"shacl-1-0",
		]);
	});
});
