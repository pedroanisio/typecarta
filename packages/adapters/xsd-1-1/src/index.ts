// @typecarta/adapter-xsd-1-1
//
// XML Schema Definition 1.1 adapter for typecarta. Thin layer over
// @typecarta/adapter-xsd-core; descriptor types live in xsd-core.

export { XsdAdapter } from "./adapter.js";
export type {
	XsdAlternative,
	XsdAnnotation,
	XsdAssert,
	XsdAttributeDescriptor,
	XsdDescriptor,
	XsdElementDescriptor,
	XsdFacets,
	XsdOpenContent,
} from "./adapter.js";
export {
	XSD_PRIMITIVE_NAMES_11 as XSD_PRIMITIVE_NAMES,
	XSD_BUILTIN_DERIVED_NAMES_11 as XSD_BUILTIN_DERIVED_NAMES,
	XSD_FACET_KEYS_11 as XSD_FACET_KEYS,
} from "@typecarta/adapter-xsd-core";
