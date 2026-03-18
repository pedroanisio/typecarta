// schema-class
// Define and construct schema classes as collections of schema languages (Def. 6.1).

import type { Signature } from "../ast/signature.js";

/** Represent a named schema class as a collection of schema languages (Def. 6.1). */
export interface SchemaClass {
	readonly name: string;
	readonly description: string;
	readonly signatures: readonly Signature[];
}

/**
 * Create a named schema class.
 *
 * @param name - The schema class identifier.
 * @param description - A human-readable description of the class.
 * @param signatures - The schema language signatures belonging to this class.
 * @returns A new {@link SchemaClass} instance.
 */
export function createSchemaClass(
	name: string,
	description: string,
	signatures: readonly Signature[],
): SchemaClass {
	return { name, description, signatures };
}
