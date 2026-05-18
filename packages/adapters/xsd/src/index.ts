// @typecarta/adapter-xsd
//
// XML Schema Definition 1.0 adapter for typecarta. Thin layer over
// @typecarta/adapter-xsd-core; descriptor types live in xsd-core.

export { XsdAdapter } from "./adapter.js";
export type {
	XsdAnnotation,
	XsdAttributeDescriptor,
	XsdDescriptor,
	XsdElementDescriptor,
	XsdFacets,
} from "./adapter.js";
// Re-export the primitive name list for callers that want to introspect it.
export {
	XSD_PRIMITIVE_NAMES_10 as XSD_PRIMITIVE_NAMES,
	XSD_BUILTIN_DERIVED_NAMES_10 as XSD_BUILTIN_DERIVED_NAMES,
	XSD_FACET_KEYS_10 as XSD_FACET_KEYS,
} from "@typecarta/adapter-xsd-core";
