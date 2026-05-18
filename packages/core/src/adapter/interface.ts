// adapter/interface
// Define the contract every IR adapter must implement to connect a
// schema language to the typecarta framework.

import type { Signature } from "../ast/signature.js";
import type { TypeTerm } from "../ast/type-term.js";

/** Connect a real-world schema language to typecarta; generic over Sig and Native. */
export interface IRAdapter<Sig extends Signature = Signature, Native = unknown> {
	/** Human-readable name (e.g. "JSON Schema draft-07"). */
	readonly name: string;

	/**
	 * The specific target-language version this adapter encodes against
	 * (e.g. "1.0" for XSD 1.0, "draft-07" for JSON Schema draft-07,
	 * "1.11" for Avro, "proto3" for Protobuf 3, "16.0" for TypeScript).
	 *
	 * Required so a scorecard verdict can be traced to a concrete spec.
	 * Use the canonical version string the target language itself uses.
	 */
	readonly specVersion: string;

	/** The IR's signature. */
	readonly signature: Sig;

	/** Parse a source-format document into the typecarta AST. */
	parse(source: Native): TypeTerm;

	/** Encode a typecarta AST node into the IR's native format. */
	encode(term: TypeTerm): Native;

	/** Check if a TypeTerm is encodable in this IR. */
	isEncodable(term: TypeTerm): boolean;

	/**
	 * Declare which IR `TypeTerm` kinds this adapter's encoder models at all.
	 *
	 * Returning `false` means "the adapter has no path to encode this kind" —
	 * distinct from "encoded but the target language can't preserve it." The
	 * scorecard uses this to separate adapter holes from genuine language
	 * gaps. When omitted, every kind is assumed supported.
	 */
	supportsKind?(kind: TypeTerm["kind"]): boolean;

	/**
	 * Semantic evaluator: does value v inhabit type term τ?
	 * Used for extension-equality checking.
	 */
	inhabits(value: unknown, term: TypeTerm): boolean;

	/**
	 * Operational subtyping judgment (≤_op), if the IR has one.
	 * Returns undefined if the IR uses only semantic subtyping.
	 */
	operationalSubtype?(a: TypeTerm, b: TypeTerm): boolean;
}
