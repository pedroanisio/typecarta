/**
 * Π' criterion registry — mutable builder + frozen accessor (§12.2).
 */

import {
	CRITERION_IDS,
	type Criterion,
	type CriterionId,
	type CriterionRegistry,
} from "./types.js";

/** Internal mutable store. */
const _store = new Map<CriterionId, Criterion>();

/**
 * Register a Π' criterion predicate.
 * Throws if the ID is already registered or is not a valid Π' ID.
 */
export function registerCriterion(criterion: Criterion): void {
	if (!(CRITERION_IDS as readonly string[]).includes(criterion.id)) {
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
export function getCriterionRegistry(): CriterionRegistry {
	return new Map(_store) as CriterionRegistry;
}

/**
 * Look up a single Π' criterion by ID.
 * Returns `undefined` when the ID has not been registered.
 */
export function getCriterion(id: CriterionId): Criterion | undefined {
	return _store.get(id);
}

/**
 * Return the number of currently registered Π' criteria.
 */
export function criterionRegistrySize(): number {
	return _store.size;
}
