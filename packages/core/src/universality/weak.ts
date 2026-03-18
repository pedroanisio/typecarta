// weak
// Assess weak universality of an IR over a schema class (Def. 6.2).

/** Represent the result of a weak universality assessment (Def. 6.2). */
export interface WeakUniversalityResult {
	readonly holds: boolean;
	readonly reason: string;
}

/**
 * Assess weak universality for the current IR.
 *
 * @returns A {@link WeakUniversalityResult} with `holds` set to `false` and an explanatory reason.
 */
export function assessWeakUniversality(): WeakUniversalityResult {
	return {
		holds: false,
		reason:
			"Weak universality asserts existence without a computable procedure. " +
			"It must be argued on a per-class basis.",
	};
}
