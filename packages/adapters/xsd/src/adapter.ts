// XML Schema Definition 1.0 adapter — thin layer over @typecarta/adapter-xsd-core.
//
// All recursive parse/encode/inhabits logic lives in xsd-core. This file
// pins the 1.0-specific configuration: primitive/derived names, the 12
// constraining facets (no 1.1 `assertions` or `explicitTimezone`), and the
// IR `TypeTerm` kinds the encoder/parser handle.
//
// Vendored canonical spec: vendor/specs/xsd/ (W3C XML Schema Parts 1 & 2,
// 2nd Edition, 2004).

import type { IRAdapter, Signature, TypeTerm } from "@typecarta/core";
import { createSignature } from "@typecarta/core";
import {
	BASE_SUPPORTED_KINDS,
	XSD_BUILTIN_DERIVED_NAMES_10,
	XSD_FACET_KEYS_10,
	XSD_PRIMITIVE_NAMES_10,
	createEngine,
} from "@typecarta/adapter-xsd-core";
import type {
	XsdAnnotation,
	XsdAttributeDescriptor,
	XsdDescriptor,
	XsdElementDescriptor,
	XsdFacets,
} from "@typecarta/adapter-xsd-core";

export type {
	XsdAnnotation,
	XsdAttributeDescriptor,
	XsdDescriptor,
	XsdElementDescriptor,
	XsdFacets,
};

const XSD_10_BUILTIN_NAMES = new Set([
	...XSD_PRIMITIVE_NAMES_10,
	...XSD_BUILTIN_DERIVED_NAMES_10,
]);

const XSD_10_FACETS = new Set(XSD_FACET_KEYS_10);

const XSD_10_SIGNATURE: Signature = createSignature(XSD_PRIMITIVE_NAMES_10, [
	{ name: "product", arity: 1 },
	{ name: "array", arity: 1 },
	{ name: "set", arity: 1 },
	{ name: "union", arity: 2 },
]);

const engine = createEngine({
	builtinNames: XSD_10_BUILTIN_NAMES,
	allowedFacets: XSD_10_FACETS,
	supportedKinds: BASE_SUPPORTED_KINDS,
});

/** Adapt XSD 1.0 schema-component descriptors to and from the typecarta IR. */
export class XsdAdapter implements IRAdapter<Signature, XsdDescriptor> {
	readonly name = "xsd";
	readonly specVersion = "1.0";
	readonly signature = XSD_10_SIGNATURE;

	parse(source: XsdDescriptor): TypeTerm {
		return engine.parse(source);
	}

	encode(term: TypeTerm): XsdDescriptor {
		return engine.encode(term);
	}

	isEncodable(term: TypeTerm): boolean {
		try {
			this.encode(term);
			return true;
		} catch {
			return false;
		}
	}

	supportsKind(kind: TypeTerm["kind"]): boolean {
		return engine.supportsKind(kind);
	}

	inhabits(value: unknown, term: TypeTerm): boolean {
		return engine.inhabits(value, term);
	}
}
