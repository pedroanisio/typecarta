/**
 * Π' criterion registry — mutable builder + frozen accessor (§12.2).
 */

import {
	PI_PRIME_IDS,
	type PiPrimeCriterion,
	type PiPrimeId,
	type PiPrimeRegistry,
} from "./types.js";

/** Internal mutable store. */
const _store = new Map<PiPrimeId, PiPrimeCriterion>();

/**
 * Register a Π' criterion predicate.
 * Throws if the ID is already registered or is not a valid Π' ID.
 */
export function registerPiPrimeCriterion(criterion: PiPrimeCriterion): void {
	if (!(PI_PRIME_IDS as readonly string[]).includes(criterion.id)) {
		throw new RangeError(`"${criterion.id}" is not a valid Π' criterion identifier.`);
	}
	if (_store.has(criterion.id)) {
		throw new Error(`Π' criterion "${criterion.id}" is already registered.`);
	}
	_store.set(criterion.id, criterion);
}

/**
 * Return a frozen, read-only snapshot of the current Π' registry.
 */
export function getPiPrimeRegistry(): PiPrimeRegistry {
	return new Map(_store) as PiPrimeRegistry;
}

/**
 * Look up a single Π' criterion by ID.
 * Returns `undefined` when the ID has not been registered.
 */
export function getPiPrimeCriterion(id: PiPrimeId): PiPrimeCriterion | undefined {
	return _store.get(id);
}

/**
 * Return the number of currently registered Π' criteria.
 */
export function piPrimeRegistrySize(): number {
	return _store.size;
}
