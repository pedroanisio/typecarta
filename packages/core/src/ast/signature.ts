// Signature
// Define and validate type signatures per Definition 3.1:
// Σ = (B, F, ar) where B is base type names, F is type constructors,
// and ar: F → N+ assigns each constructor a positive arity.

/** A type constructor with its name and arity. */
export interface ConstructorSpec {
	readonly name: string;
	readonly arity: number;
}

/** A signature Σ = (B, F, ar) — base types, constructors, and arities (Def. 3.1). */
export interface Signature {
	readonly baseTypes: readonly string[];
	readonly constructors: readonly ConstructorSpec[];
}

/**
 * Create a {@link Signature} from base type names and constructor specs.
 * @param baseTypes - The set of base type names (must be unique).
 * @param constructors - The constructor specs (must have unique names and positive arity).
 * @returns A validated {@link Signature}.
 * @throws {Error} If any constructor has non-positive arity, or if names are duplicated.
 */
export function createSignature(
	baseTypes: readonly string[],
	constructors: readonly ConstructorSpec[],
): Signature {
	for (const c of constructors) {
		if (c.arity < 1) {
			throw new Error(`Constructor "${c.name}" must have positive arity, got ${c.arity}`);
		}
	}
	const baseSet = new Set(baseTypes);
	if (baseSet.size !== baseTypes.length) {
		throw new Error("Duplicate base type names in signature");
	}
	const ctorSet = new Set(constructors.map((c) => c.name));
	if (ctorSet.size !== constructors.length) {
		throw new Error("Duplicate constructor names in signature");
	}
	return { baseTypes, constructors };
}

/**
 * Look up a constructor's arity in a signature.
 * @param sig - The signature to search.
 * @param constructorName - The constructor name to look up.
 * @returns The arity, or `undefined` if the constructor is not in the signature.
 */
export function getArity(sig: Signature, constructorName: string): number | undefined {
	return sig.constructors.find((c) => c.name === constructorName)?.arity;
}

/**
 * Check whether a base type name exists in the signature.
 * @param sig - The signature to search.
 * @param name - The base type name to check.
 * @returns `true` if `name` is a member of the signature's base types.
 */
export function hasBaseType(sig: Signature, name: string): boolean {
	return sig.baseTypes.includes(name);
}

/**
 * Check whether a constructor name exists in the signature.
 * @param sig - The signature to search.
 * @param name - The constructor name to check.
 * @returns `true` if `name` is a registered constructor in the signature.
 */
export function hasConstructor(sig: Signature, name: string): boolean {
	return sig.constructors.some((c) => c.name === name);
}

// -- § 1  Well-known Signatures -- predefined signature constants --

/** The JSON-like value universe signature. */
export const JSON_SIGNATURE: Signature = createSignature(
	["string", "number", "boolean", "null"],
	[
		{ name: "product", arity: 1 },
		{ name: "array", arity: 1 },
		{ name: "union", arity: 2 },
		{ name: "intersection", arity: 2 },
		{ name: "tuple", arity: 1 },
		{ name: "map", arity: 2 },
	],
);
