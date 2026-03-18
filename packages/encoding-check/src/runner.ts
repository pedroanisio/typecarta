// runner
// Execute width, depth, and generic preservation checks against an
// encoding using caller-supplied type pairs and test values.

import type { Encoding, ExtensionEvaluator, TypeTerm, Value } from "@typecarta/core";
import {
	type EncodingCheckResult,
	checkDepthPreservation,
	checkGenericPreservation,
	checkWidthPreservation,
} from "@typecarta/core";

/** Describe the encoding, evaluator, test values, and type pairs to check. */
export interface EncodingCheckConfig {
	readonly encoding: Encoding;
	readonly evaluator: ExtensionEvaluator;
	readonly testValues: readonly Value[];
	readonly widthPairs?: readonly [TypeTerm, TypeTerm][];
	readonly depthPairs?: readonly [TypeTerm, TypeTerm][];
	readonly genericPairs?: readonly [TypeTerm, TypeTerm][];
}

/**
 * Run all configured encoding preservation checks.
 *
 * @param config - Encoding, evaluator, test values, and type pairs to check.
 * @returns Array of check results, one per type pair.
 */
export function runEncodingChecks(config: EncodingCheckConfig): readonly EncodingCheckResult[] {
	const results: EncodingCheckResult[] = [];

	for (const [wide, narrow] of config.widthPairs ?? []) {
		results.push(
			checkWidthPreservation(wide, narrow, config.encoding, config.evaluator, config.testValues),
		);
	}
	for (const [deep, shallow] of config.depthPairs ?? []) {
		results.push(
			checkDepthPreservation(deep, shallow, config.encoding, config.evaluator, config.testValues),
		);
	}
	for (const [inst1, inst2] of config.genericPairs ?? []) {
		results.push(
			checkGenericPreservation(inst1, inst2, config.encoding, config.evaluator, config.testValues),
		);
	}

	return results;
}
