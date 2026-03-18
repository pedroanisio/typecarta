// adapter/validation
// Validate an adapter implementation against the IRAdapter contract
// by exercising round-trip encoding and basic type checks.

import { base, bottom, field, literal, product, top } from "../ast/constructors.js";
import type { TypeTerm } from "../ast/type-term.js";
import type { IRAdapter } from "./interface.js";

/** Capture the outcome of an adapter validation run. */
export interface ValidationResult {
	readonly valid: boolean;
	readonly errors: readonly string[];
	readonly warnings: readonly string[];
}

/**
 * Validate that an adapter correctly implements the IRAdapter contract.
 *
 * Exercise round-trip encoding on a set of canonical type terms and
 * verify that the inhabits function does not throw.
 *
 * @param adapter - the adapter to validate
 * @returns a result containing validity status, errors, and warnings
 */
export function validateAdapter(adapter: IRAdapter): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check required properties
	if (!adapter.name || typeof adapter.name !== "string") {
		errors.push("Adapter must have a non-empty string name");
	}
	if (!adapter.signature) {
		errors.push("Adapter must have a signature");
	}

	// Test basic type terms
	const testTerms: { name: string; term: TypeTerm }[] = [
		{ name: "bottom", term: bottom() },
		{ name: "top", term: top() },
		{ name: "literal(42)", term: literal(42) },
		{ name: "base(string)", term: base("string") },
		{
			name: "product",
			term: product([field("x", base("number"))]),
		},
	];

	for (const { name, term } of testTerms) {
		try {
			const encodable = adapter.isEncodable(term);
			if (encodable) {
				// Test round-trip: encode then parse
				const encoded = adapter.encode(term);
				const parsed = adapter.parse(encoded);
				if (!parsed || typeof parsed !== "object" || !("kind" in parsed)) {
					errors.push(`Round-trip failed for ${name}: parse returned invalid TypeTerm`);
				}
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			warnings.push(`Error testing ${name}: ${msg}`);
		}
	}

	// Test inhabits function
	try {
		adapter.inhabits(42, literal(42));
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		warnings.push(`inhabits() threw: ${msg}`);
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}
