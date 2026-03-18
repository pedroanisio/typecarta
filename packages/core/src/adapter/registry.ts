// adapter/registry
// Store and retrieve IR adapter instances by name.

import type { IRAdapter } from "./interface.js";

/** Map adapter names to instances. */
const adapters = new Map<string, IRAdapter>();

/**
 * Register an adapter in the global registry.
 *
 * @param adapter - the adapter to register
 * @throws Error if an adapter with the same name is already registered
 */
export function registerAdapter(adapter: IRAdapter): void {
	if (adapters.has(adapter.name)) {
		throw new Error(`Adapter "${adapter.name}" is already registered`);
	}
	adapters.set(adapter.name, adapter);
}

/**
 * Look up a registered adapter by name.
 *
 * @param name - the adapter name to look up
 * @returns the adapter instance, or undefined if not found
 */
export function getAdapter(name: string): IRAdapter | undefined {
	return adapters.get(name);
}

/**
 * Return all registered adapters.
 *
 * @returns a readonly array of adapter instances
 */
export function getAllAdapters(): readonly IRAdapter[] {
	return [...adapters.values()];
}

/**
 * List all registered adapter names.
 *
 * @returns a readonly array of adapter name strings
 */
export function getAdapterNames(): readonly string[] {
	return [...adapters.keys()];
}

/**
 * Remove an adapter from the registry.
 *
 * @param name - the adapter name to remove
 * @returns true if the adapter was found and removed
 */
export function unregisterAdapter(name: string): boolean {
	return adapters.delete(name);
}

/** Remove all adapters from the registry. */
export function clearAdapters(): void {
	adapters.clear();
}
