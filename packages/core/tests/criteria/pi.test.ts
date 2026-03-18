import {
	PI_CRITERIA,
	PI_REGISTRY,
	array,
	base,
	bottom,
	field,
	forall,
	intersection,
	literal,
	mu,
	nominal,
	product,
	rangeConstraint,
	refinement,
	top,
	typeVar,
	union,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";

describe("Pi criterion predicates", () => {
	it("has 15 criteria", () => {
		expect(PI_CRITERIA).toHaveLength(15);
		expect(PI_REGISTRY.size).toBe(15);
	});

	it("pi-01 detects bottom", () => {
		const result = PI_REGISTRY.get("pi-01")!.evaluate(bottom());
		expect(result.status).toBe("satisfied");
	});

	it("pi-01 rejects non-bottom", () => {
		const result = PI_REGISTRY.get("pi-01")!.evaluate(base("string"));
		expect(result.status).toBe("not-satisfied");
	});

	it("pi-02 detects top", () => {
		expect(PI_REGISTRY.get("pi-02")!.evaluate(top()).status).toBe("satisfied");
	});

	it("pi-03 detects literal", () => {
		expect(PI_REGISTRY.get("pi-03")!.evaluate(literal(42)).status).toBe("satisfied");
	});

	it("pi-04 detects product", () => {
		const t = product([field("x", base("number"))]);
		expect(PI_REGISTRY.get("pi-04")!.evaluate(t).status).toBe("satisfied");
	});

	it("pi-05 detects union", () => {
		const t = union([base("string"), base("number")]);
		expect(PI_REGISTRY.get("pi-05")!.evaluate(t).status).toBe("satisfied");
	});

	it("pi-06 detects intersection", () => {
		const t = intersection([base("string"), base("number")]);
		expect(PI_REGISTRY.get("pi-06")!.evaluate(t).status).toBe("satisfied");
	});

	it("pi-07 detects recursion", () => {
		const t = mu("alpha", array(typeVar("alpha")));
		expect(PI_REGISTRY.get("pi-07")!.evaluate(t).status).toBe("satisfied");
	});

	it("pi-08 detects mutual recursion", () => {
		const t = mu(
			"a",
			product([field("next", mu("b", product([field("items", array(typeVar("a")))])))]),
		);
		expect(PI_REGISTRY.get("pi-08")!.evaluate(t).status).toBe("satisfied");
	});

	it("pi-09 detects parametricity", () => {
		const t = forall("T", product([field("data", typeVar("T"))]));
		expect(PI_REGISTRY.get("pi-09")!.evaluate(t).status).toBe("satisfied");
	});

	it("pi-10 detects refinement", () => {
		const t = refinement(base("number"), rangeConstraint(0, 100));
		expect(PI_REGISTRY.get("pi-10")!.evaluate(t).status).toBe("satisfied");
	});

	it("pi-11 detects optionality", () => {
		const t = product([field("x", base("string"), { optional: true })]);
		expect(PI_REGISTRY.get("pi-11")!.evaluate(t).status).toBe("satisfied");
	});

	it("pi-12 detects nominal", () => {
		const t = nominal("UserId", base("string"));
		expect(PI_REGISTRY.get("pi-12")!.evaluate(t).status).toBe("satisfied");
	});

	it("pi-15 rejects non-HKT", () => {
		expect(PI_REGISTRY.get("pi-15")!.evaluate(base("string")).status).toBe("not-satisfied");
	});
});
