// sampling
// Approximate extension comparison via random test-value sampling.
// Trade completeness for scalability on large or infinite domains.

import type { Extension, Value } from "@typecarta/core";

/** Configure sample count and optional RNG seed for sampling comparison. */
export interface SamplingConfig {
	readonly samplesPerType: number;
	readonly seed?: number;
}

/** Hold approximate subset, superset, and equality flags with a confidence score. */
export interface SamplingResult {
	readonly approximateSubset: boolean;
	readonly approximateSuperset: boolean;
	readonly approximateEqual: boolean;
	readonly sampleCount: number;
	readonly violationCount: number;
	readonly confidence: number;
	readonly violations: readonly SamplingViolation[];
}

/** Represent a sampled value where two extensions disagree on membership. */
export interface SamplingViolation {
	readonly value: Value;
	readonly inLeft: boolean;
	readonly inRight: boolean;
}

const DEFAULT_CONFIG: SamplingConfig = { samplesPerType: 50 };

/**
 * Compare two extensions via random sampling.
 *
 * @param left - First extension to compare.
 * @param right - Second extension to compare.
 * @param config - Sample count and optional seed. Defaults to 50 samples per type.
 * @returns Approximate subset/superset/equality flags with confidence score.
 *
 * @remarks
 * Confidence is computed as `1 - violationCount / sampleCount`. A zero-sample
 * run yields confidence 0.
 */
export function compareSampled(
	left: Extension,
	right: Extension,
	config: SamplingConfig = DEFAULT_CONFIG,
): SamplingResult {
	const values = generateSamples(config);
	const violations: SamplingViolation[] = [];
	let leftSubsetViolations = 0;
	let rightSubsetViolations = 0;

	for (const v of values) {
		const inLeft = left.contains(v);
		const inRight = right.contains(v);

		if (inLeft && !inRight) {
			leftSubsetViolations++;
			violations.push({ value: v, inLeft: true, inRight: false });
		}
		if (inRight && !inLeft) {
			rightSubsetViolations++;
			violations.push({ value: v, inLeft: false, inRight: true });
		}
	}

	const sampleCount = values.length;
	const violationCount = violations.length;
	const confidence = sampleCount > 0 ? 1 - violationCount / sampleCount : 0;

	return {
		approximateSubset: leftSubsetViolations === 0,
		approximateSuperset: rightSubsetViolations === 0,
		approximateEqual: leftSubsetViolations === 0 && rightSubsetViolations === 0,
		sampleCount,
		violationCount,
		confidence,
		violations,
	};
}

/** Generate sample values spanning null, boolean, number, string, array, and object types. */
function generateSamples(config: SamplingConfig): Value[] {
	const n = config.samplesPerType;
	const rng = createRng(config.seed ?? 42);
	const values: Value[] = [];

	// null
	values.push(null);

	// booleans
	values.push(true, false);

	// integers
	for (let i = 0; i < n; i++) {
		values.push(Math.floor(rng() * 200) - 100);
	}

	// floats
	for (let i = 0; i < n; i++) {
		values.push(rng() * 200 - 100);
	}

	// strings
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < n; i++) {
		const len = Math.floor(rng() * 10);
		let s = "";
		for (let j = 0; j < len; j++) {
			s += chars[Math.floor(rng() * chars.length)];
		}
		values.push(s);
	}

	// arrays
	for (let i = 0; i < Math.min(n, 10); i++) {
		const len = Math.floor(rng() * 5);
		const arr: unknown[] = [];
		for (let j = 0; j < len; j++) {
			arr.push(Math.floor(rng() * 100));
		}
		values.push(arr);
	}

	// objects
	for (let i = 0; i < Math.min(n, 10); i++) {
		const obj: Record<string, unknown> = {};
		const keys = Math.floor(rng() * 4);
		for (let j = 0; j < keys; j++) {
			obj[`k${j}`] = Math.floor(rng() * 100);
		}
		values.push(obj);
	}

	return values;
}

/** Create a seeded xorshift32 pseudo-random number generator. */
function createRng(seed: number): () => number {
	let state = seed | 0 || 1;
	return () => {
		state ^= state << 13;
		state ^= state >> 17;
		state ^= state << 5;
		return (state >>> 0) / 4294967296;
	};
}
