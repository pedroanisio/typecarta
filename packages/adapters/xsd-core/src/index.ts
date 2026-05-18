// @typecarta/adapter-xsd-core
//
// Shared engine for the XSD 1.0 and 1.1 adapters. Exposes:
//   - the descriptor types (1.1-only fields included as optionals so both
//     adapters share the same type)
//   - factory functions for parse / encode / inhabits / supportsKind that
//     accept a config describing version-specific behavior
//
// Each sibling adapter assembles a config and constructs an IRAdapter from it.

export * from "./types.js";
export {
	createEngine,
	type XsdEngineConfig,
	type XsdEngine,
	type XsdEncodeHook,
	type XsdParseHook,
} from "./engine.js";
export {
	XSD_PRIMITIVE_NAMES_10,
	XSD_BUILTIN_DERIVED_NAMES_10,
	XSD_PRIMITIVE_NAMES_11,
	XSD_BUILTIN_DERIVED_NAMES_11,
	XSD_FACET_KEYS_10,
	XSD_FACET_KEYS_11,
	BASE_SUPPORTED_KINDS,
} from "./catalog.js";
