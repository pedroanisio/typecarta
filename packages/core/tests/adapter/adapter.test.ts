import {
	assessWeakUniversality,
	base,
	bottom,
	checkDecidabilityHazard,
	clearAdapters,
	complement,
	createSchemaClass,
	createSignature,
	field,
	forall,
	getAdapter,
	getAdapterNames,
	getAllAdapters,
	literal,
	mu,
	product,
	registerAdapter,
	top,
	union,
	unregisterAdapter,
	validateAdapter,
} from "@typecarta/core";
import type { IRAdapter, Signature, TypeTerm } from "@typecarta/core";
import { beforeEach, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal well-behaved mock adapter. */
function makeMockAdapter(name = "mock-adapter"): IRAdapter {
	const sig: Signature = createSignature(
		["string", "number", "boolean", "null"],
		[
			{ name: "product", arity: 1 },
			{ name: "union", arity: 2 },
		],
	);

	return {
		name,
		signature: sig,
		parse(_source: unknown): TypeTerm {
			return base("string");
		},
		encode(term: TypeTerm): unknown {
			return { type: term.kind };
		},
		isEncodable(_term: TypeTerm): boolean {
			return true;
		},
		inhabits(value: unknown, term: TypeTerm): boolean {
			if (term.kind === "literal") return value === term.value;
			if (term.kind === "base" && term.name === "number") return typeof value === "number";
			if (term.kind === "base" && term.name === "string") return typeof value === "string";
			if (term.kind === "top") return true;
			if (term.kind === "bottom") return false;
			return false;
		},
	};
}

/** Adapter where parse returns something invalid (not a TypeTerm). */
function makeBrokenParseAdapter(name = "broken-parse"): IRAdapter {
	const sig: Signature = createSignature(["string"], [{ name: "product", arity: 1 }]);
	return {
		name,
		signature: sig,
		parse(_source: unknown): TypeTerm {
			// Returns something that isn't really a TypeTerm with a "kind" property
			return 42 as unknown as TypeTerm;
		},
		encode(term: TypeTerm): unknown {
			return { type: term.kind };
		},
		isEncodable(_term: TypeTerm): boolean {
			return true;
		},
		inhabits(_value: unknown, _term: TypeTerm): boolean {
			return false;
		},
	};
}

/** Adapter where inhabits throws. */
function makeThrowingInhabitsAdapter(name = "throwing-inhabits"): IRAdapter {
	const sig: Signature = createSignature(["string"], [{ name: "product", arity: 1 }]);
	return {
		name,
		signature: sig,
		parse(_source: unknown): TypeTerm {
			return base("string");
		},
		encode(term: TypeTerm): unknown {
			return { type: term.kind };
		},
		isEncodable(_term: TypeTerm): boolean {
			return true;
		},
		inhabits(_value: unknown, _term: TypeTerm): boolean {
			throw new Error("inhabits not implemented");
		},
	};
}

// ===========================================================================
//  Adapter Registry
// ===========================================================================

describe("Adapter Registry", () => {
	beforeEach(() => {
		clearAdapters();
	});

	describe("registerAdapter", () => {
		it("registers an adapter successfully", () => {
			const adapter = makeMockAdapter();
			registerAdapter(adapter);

			expect(getAdapter("mock-adapter")).toBe(adapter);
		});

		it("throws when registering a duplicate adapter name", () => {
			const adapter1 = makeMockAdapter("dup");
			const adapter2 = makeMockAdapter("dup");

			registerAdapter(adapter1);
			expect(() => registerAdapter(adapter2)).toThrow('Adapter "dup" is already registered');
		});

		it("registers multiple adapters with different names", () => {
			registerAdapter(makeMockAdapter("a"));
			registerAdapter(makeMockAdapter("b"));
			registerAdapter(makeMockAdapter("c"));

			expect(getAdapterNames()).toHaveLength(3);
		});
	});

	describe("getAdapter", () => {
		it("returns the adapter when it exists", () => {
			const adapter = makeMockAdapter("test");
			registerAdapter(adapter);

			expect(getAdapter("test")).toBe(adapter);
		});

		it("returns undefined for an unknown adapter", () => {
			expect(getAdapter("nonexistent")).toBeUndefined();
		});
	});

	describe("getAllAdapters", () => {
		it("returns an empty array when no adapters are registered", () => {
			expect(getAllAdapters()).toEqual([]);
		});

		it("returns all registered adapters", () => {
			registerAdapter(makeMockAdapter("x"));
			registerAdapter(makeMockAdapter("y"));

			const all = getAllAdapters();
			expect(all).toHaveLength(2);
			expect(all.map((a) => a.name).sort()).toEqual(["x", "y"]);
		});
	});

	describe("getAdapterNames", () => {
		it("returns empty array when no adapters registered", () => {
			expect(getAdapterNames()).toEqual([]);
		});

		it("returns all registered adapter names", () => {
			registerAdapter(makeMockAdapter("alpha"));
			registerAdapter(makeMockAdapter("beta"));

			const names = getAdapterNames();
			expect(names).toContain("alpha");
			expect(names).toContain("beta");
			expect(names).toHaveLength(2);
		});
	});

	describe("unregisterAdapter", () => {
		it("returns true when adapter is removed", () => {
			registerAdapter(makeMockAdapter("removable"));

			expect(unregisterAdapter("removable")).toBe(true);
			expect(getAdapter("removable")).toBeUndefined();
		});

		it("returns false when adapter does not exist", () => {
			expect(unregisterAdapter("ghost")).toBe(false);
		});

		it("allows re-registration after unregister", () => {
			const a = makeMockAdapter("reuse");
			registerAdapter(a);
			unregisterAdapter("reuse");

			const b = makeMockAdapter("reuse");
			registerAdapter(b);
			expect(getAdapter("reuse")).toBe(b);
		});
	});

	describe("clearAdapters", () => {
		it("removes all adapters", () => {
			registerAdapter(makeMockAdapter("one"));
			registerAdapter(makeMockAdapter("two"));
			registerAdapter(makeMockAdapter("three"));

			clearAdapters();

			expect(getAllAdapters()).toEqual([]);
			expect(getAdapterNames()).toEqual([]);
		});

		it("is safe to call when already empty", () => {
			clearAdapters();
			expect(getAllAdapters()).toEqual([]);
		});
	});
});

// ===========================================================================
//  validateAdapter
// ===========================================================================

describe("validateAdapter", () => {
	it("returns valid=true for a well-behaved adapter", () => {
		const adapter = makeMockAdapter();
		const result = validateAdapter(adapter);

		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("returns errors when adapter.name is empty", () => {
		const adapter = makeMockAdapter("");
		const result = validateAdapter(adapter);

		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("non-empty string name"))).toBe(true);
	});

	it("returns errors when adapter.signature is missing", () => {
		const adapter = {
			...makeMockAdapter(),
			signature: undefined as unknown as Signature,
		};

		const result = validateAdapter(adapter);

		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("signature"))).toBe(true);
	});

	it("reports round-trip failure when parse returns invalid TypeTerm", () => {
		const adapter = makeBrokenParseAdapter();
		const result = validateAdapter(adapter);

		// The parse returns 42, which doesn't have a "kind" property
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("Round-trip failed"))).toBe(true);
	});

	it("records warnings when inhabits throws", () => {
		const adapter = makeThrowingInhabitsAdapter();
		const result = validateAdapter(adapter);

		expect(result.warnings.some((w) => w.includes("inhabits() threw"))).toBe(true);
	});

	it("captures warnings when encode/parse throws for a test term", () => {
		const adapter: IRAdapter = {
			...makeMockAdapter("throw-encode"),
			isEncodable(_term: TypeTerm) {
				return true;
			},
			encode(_term: TypeTerm): unknown {
				throw new Error("encode failed");
			},
		};

		const result = validateAdapter(adapter);

		// The try/catch around the test terms should capture this as a warning
		expect(result.warnings.some((w) => w.includes("encode failed"))).toBe(true);
	});

	it("skips round-trip for non-encodable terms", () => {
		const adapter: IRAdapter = {
			...makeMockAdapter("selective"),
			isEncodable(_term: TypeTerm) {
				return false;
			},
		};

		const result = validateAdapter(adapter);

		// Should not produce errors for non-encodable terms (they're just skipped)
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ===========================================================================
//  checkDecidabilityHazard
// ===========================================================================

describe("checkDecidabilityHazard", () => {
	it("returns isHazardous=false for a simple base type", () => {
		const result = checkDecidabilityHazard(base("number"));

		expect(result.isHazardous).toBe(false);
		expect(result.hasMu).toBe(false);
		expect(result.hasComplement).toBe(false);
		expect(result.hasForall).toBe(false);
		expect(result.warning).toBeUndefined();
	});

	it("returns hasMu=true for a mu node", () => {
		const term = mu("x", base("number"));
		const result = checkDecidabilityHazard(term);

		expect(result.hasMu).toBe(true);
		expect(result.isHazardous).toBe(false);
	});

	it("returns hasComplement=true for a complement node", () => {
		const term = complement(base("string"));
		const result = checkDecidabilityHazard(term);

		expect(result.hasComplement).toBe(true);
		expect(result.isHazardous).toBe(false);
	});

	it("returns hasForall=true for a forall node", () => {
		const term = forall("T", base("number"));
		const result = checkDecidabilityHazard(term);

		expect(result.hasForall).toBe(true);
		expect(result.isHazardous).toBe(false);
	});

	it("returns isHazardous=true when mu, complement, and forall are all present", () => {
		// Build a term that contains all three: mu, complement, forall
		const term = mu("x", complement(forall("T", base("number"))));

		const result = checkDecidabilityHazard(term);

		expect(result.hasMu).toBe(true);
		expect(result.hasComplement).toBe(true);
		expect(result.hasForall).toBe(true);
		expect(result.isHazardous).toBe(true);
		expect(result.warning).toContain("undecidable");
		expect(result.warning).toContain("μ");
	});

	it("returns isHazardous=false with only two of three hazard features", () => {
		// mu + complement but no forall
		const term = mu("x", complement(base("string")));
		const result = checkDecidabilityHazard(term);

		expect(result.hasMu).toBe(true);
		expect(result.hasComplement).toBe(true);
		expect(result.hasForall).toBe(false);
		expect(result.isHazardous).toBe(false);
		expect(result.warning).toBeUndefined();
	});

	it("detects hazard features in deeply nested terms", () => {
		// forall + complement without mu
		const term = forall("T", union([complement(base("string")), base("number")]));
		const result = checkDecidabilityHazard(term);

		expect(result.hasForall).toBe(true);
		expect(result.hasComplement).toBe(true);
		expect(result.hasMu).toBe(false);
		expect(result.isHazardous).toBe(false);
	});
});

// ===========================================================================
//  createSchemaClass
// ===========================================================================

describe("createSchemaClass", () => {
	it("creates a schema class with the given properties", () => {
		const sig1 = createSignature(["string", "number"], [{ name: "product", arity: 1 }]);
		const sig2 = createSignature(["boolean"], [{ name: "union", arity: 2 }]);

		const sc = createSchemaClass("TestClass", "A test schema class", [sig1, sig2]);

		expect(sc.name).toBe("TestClass");
		expect(sc.description).toBe("A test schema class");
		expect(sc.signatures).toHaveLength(2);
		expect(sc.signatures[0]).toBe(sig1);
		expect(sc.signatures[1]).toBe(sig2);
	});

	it("creates a schema class with empty signatures", () => {
		const sc = createSchemaClass("Empty", "No signatures", []);

		expect(sc.name).toBe("Empty");
		expect(sc.signatures).toHaveLength(0);
	});

	it("creates a schema class with a single signature", () => {
		const sig = createSignature(["string"], [{ name: "array", arity: 1 }]);
		const sc = createSchemaClass("Single", "One sig", [sig]);

		expect(sc.signatures).toHaveLength(1);
		expect(sc.signatures[0]!.baseTypes).toContain("string");
	});
});

// ===========================================================================
//  assessWeakUniversality
// ===========================================================================

describe("assessWeakUniversality", () => {
	it("returns holds=false with an explanatory reason", () => {
		const result = assessWeakUniversality();

		expect(result.holds).toBe(false);
		expect(result.reason).toContain("Weak universality");
		expect(result.reason).toContain("per-class basis");
	});

	it("returns a consistent result on repeated calls", () => {
		const r1 = assessWeakUniversality();
		const r2 = assessWeakUniversality();

		expect(r1.holds).toBe(r2.holds);
		expect(r1.reason).toBe(r2.reason);
	});
});
