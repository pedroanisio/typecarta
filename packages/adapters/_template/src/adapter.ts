/**
 * TODO: Your adapter name here.
 *
 * Implements IRAdapter<Signature, YourNativeFormat>.
 *
 * Replace all TODO markers with your adapter's implementation.
 */

import type { IRAdapter, Signature, TypeTerm } from "@typecarta/core";
import {
	array,
	base,
	bottom,
	createSignature,
	field,
	intersection,
	literal,
	product,
	top,
	union,
} from "@typecarta/core";

// ─── Descriptor types ──────────────────────────────────────────────

/**
 * TODO: Define your native format type here.
 *
 * This should be a descriptor object that represents schemas in your
 * target format. The adapter should NOT depend on the actual library
 * at runtime -- only on these descriptor objects.
 */
export type NativeDescriptor = Record<string, unknown>;

// ─── Signature ─────────────────────────────────────────────────────

/**
 * TODO: Define the base types and constructors that your schema
 * language supports.
 */
const ADAPTER_SIGNATURE: Signature = createSignature(
	[
		/* TODO: "string", "number", "boolean", ... */
	],
	[
		/* TODO: { name: "product", arity: 1 }, { name: "array", arity: 1 }, ... */
	],
);

// ─── Adapter class ─────────────────────────────────────────────────

/**
 * TODO: Rename this class and implement all methods.
 *
 * Implements IRAdapter for your native format descriptors.
 */
export class TemplateAdapter implements IRAdapter<Signature, NativeDescriptor> {
	/** TODO: Set a human-readable name for your adapter. */
	readonly name = "TODO: Adapter Name";
	readonly signature = ADAPTER_SIGNATURE;

	/**
	 * Parse a native-format descriptor into the typecarta AST.
	 *
	 * TODO: Implement mapping from your native format to TypeTerm nodes.
	 */
	parse(source: NativeDescriptor): TypeTerm {
		// TODO: Implement parsing logic
		throw new Error("Not implemented: parse");
	}

	/**
	 * Encode a typecarta AST node into your native format.
	 *
	 * TODO: Implement mapping from TypeTerm nodes to your native format.
	 */
	encode(term: TypeTerm): NativeDescriptor {
		// TODO: Implement encoding logic
		throw new Error("Not implemented: encode");
	}

	/**
	 * Check if a TypeTerm can be encoded in this adapter's native format.
	 *
	 * The default implementation tries to encode and catches errors.
	 * Override if you need more efficient checking.
	 */
	isEncodable(term: TypeTerm): boolean {
		try {
			this.encode(term);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Check whether a runtime value inhabits the given type term.
	 *
	 * TODO: Implement runtime type checking for your native types.
	 */
	inhabits(value: unknown, term: TypeTerm): boolean {
		// TODO: Implement inhabitation checking
		throw new Error("Not implemented: inhabits");
	}

	/**
	 * Optional: Operational subtype check.
	 *
	 * Implement this if your schema language has a notion of subtyping
	 * beyond semantic subtyping. Return undefined to use semantic subtyping only.
	 *
	 * TODO: Uncomment and implement if needed.
	 */
	// operationalSubtype(a: TypeTerm, b: TypeTerm): boolean {
	//   throw new Error("Not implemented: operationalSubtype");
	// }
}
