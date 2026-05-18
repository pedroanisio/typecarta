// Shared XSD descriptor types.
//
// The descriptor type union is identical for XSD 1.0 and 1.1; fields that
// only make sense in 1.1 (`assertions`, `openContent`, `alternatives`, etc.)
// are present as optional members. A 1.0 adapter ignores them; a 1.1
// adapter honors them. This lets parse/encode/inhabits be shared verbatim
// between the two siblings.

import type { TypeTerm } from "@typecarta/core";

/** Built-in primitive name (any version). */
export type XsdPrimitiveName = string;

/** Built-in derived name (any version). */
export type XsdBuiltinDerivedName = string;

/** Either a primitive or a known built-in derived type name. */
export type XsdBuiltinName = XsdPrimitiveName | XsdBuiltinDerivedName;

/**
 * Constraining facets across XSD 1.0 (12 facets) and 1.1 (+ assertions,
 * + explicitTimezone). A consumer's engine config decides which subset is
 * legal to emit; the type carries both.
 */
export interface XsdFacets {
	readonly enumeration?: readonly (string | number | boolean)[];
	readonly pattern?: string;
	readonly length?: number;
	readonly minLength?: number;
	readonly maxLength?: number;
	readonly minInclusive?: number;
	readonly maxInclusive?: number;
	readonly minExclusive?: number;
	readonly maxExclusive?: number;
	readonly whiteSpace?: "preserve" | "replace" | "collapse";
	readonly totalDigits?: number;
	readonly fractionDigits?: number;
	/** 1.1: XPath 2.0 boolean tests at simple-type level. */
	readonly assertions?: readonly { readonly test: string }[];
	/** 1.1: "required" | "prohibited" | "optional" timezone presence. */
	readonly explicitTimezone?: "required" | "prohibited" | "optional";
}

/** xs:annotation contents: xs:documentation + xs:appinfo. */
export interface XsdAnnotation {
	readonly documentation?: string;
	readonly appinfo?: unknown;
}

/** xs:key / xs:keyref / xs:unique definition. */
export interface XsdIdentityConstraint {
	readonly kind: "key" | "keyref" | "unique";
	readonly name: string;
	readonly selector: string;
	readonly fields: readonly string[];
	readonly refer?: string;
}

/** xs:any wildcard (1.1 adds notNamespace / notQName). */
export interface XsdWildcard {
	readonly namespace?: string;
	readonly notNamespace?: string;
	readonly notQName?: string;
	readonly processContents?: "lax" | "strict" | "skip";
}

/** Derivation control token used on `final`/`block` attributes. */
export type XsdDerivationToken = "restriction" | "extension" | "#all";

/** xs:assert (1.1): XPath 2.0 boolean test attached to a complex type. */
export interface XsdAssert {
	readonly test: string;
}

/** xs:alternative (1.1): conditional type assignment. */
export interface XsdAlternative {
	readonly test?: string;
	readonly type: XsdDescriptor;
}

/** xs:openContent (1.1): open content on a complexType (interleave/suffix). */
export interface XsdOpenContent {
	readonly mode: "interleave" | "suffix";
	readonly wildcard?: XsdWildcard;
}

/** xs:element. 1.1 adds `alternatives`. */
export interface XsdElementDescriptor {
	readonly name: string;
	readonly type: XsdDescriptor;
	readonly minOccurs?: number;
	readonly maxOccurs?: number | "unbounded";
	/** xs:nillable. */
	readonly nillable?: boolean;
	readonly annotation?: XsdAnnotation;
	/** 1.1: xs:alternative children — conditional type assignment. */
	readonly alternatives?: readonly XsdAlternative[];
}

/** xs:attribute. */
export interface XsdAttributeDescriptor {
	readonly name: string;
	readonly type: XsdDescriptor;
	readonly use?: "optional" | "required";
	readonly default?: string;
	readonly fixed?: string;
	readonly annotation?: XsdAnnotation;
}

/** Reference to a named simple/complex type. */
export interface XsdTypeRef {
	readonly kind: "ref";
	readonly name: string;
}

/** The descriptor union — same shape for 1.0 and 1.1. */
export type XsdDescriptor =
	| { readonly kind: "primitive"; readonly name: XsdBuiltinName }
	| { readonly kind: "anyType" }
	| { readonly kind: "empty" }
	| XsdTypeRef
	| {
			readonly kind: "simpleType";
			readonly name?: string;
			readonly base: XsdDescriptor;
			readonly facets?: XsdFacets;
			readonly annotation?: XsdAnnotation;
			readonly final?: XsdDerivationToken;
	  }
	| {
			readonly kind: "complexType";
			readonly name?: string;
			readonly elements: readonly XsdElementDescriptor[];
			readonly attributes?: readonly XsdAttributeDescriptor[];
			readonly wildcard?: XsdWildcard;
			readonly identityConstraints?: readonly XsdIdentityConstraint[];
			readonly annotation?: XsdAnnotation;
			readonly final?: XsdDerivationToken;
			readonly block?: XsdDerivationToken;
			readonly extends?: string;
			/** 1.1: xs:assert children. */
			readonly assertions?: readonly XsdAssert[];
			/** 1.1: xs:openContent. */
			readonly openContent?: XsdOpenContent;
			/** 1.1: defaultAttributesApply toggle. */
			readonly defaultAttributesApply?: boolean;
	  }
	| { readonly kind: "sequence"; readonly elements: readonly XsdElementDescriptor[] }
	| { readonly kind: "all"; readonly elements: readonly XsdElementDescriptor[] }
	| { readonly kind: "choice"; readonly options: readonly XsdElementDescriptor[] }
	| { readonly kind: "list"; readonly itemType: XsdDescriptor }
	| { readonly kind: "set"; readonly itemType: XsdDescriptor }
	| { readonly kind: "union"; readonly members: readonly XsdDescriptor[] }
	| {
			readonly kind: "group";
			readonly name: string;
			readonly body: XsdDescriptor;
	  }
	| {
			readonly kind: "attributeGroup";
			readonly name: string;
			readonly attributes: readonly XsdAttributeDescriptor[];
	  }
	| {
			readonly kind: "schema";
			readonly targetNamespace?: string;
			readonly includes?: readonly string[];
			readonly imports?: readonly {
				readonly namespace: string;
				readonly schemaLocation?: string;
			}[];
			readonly redefines?: readonly string[];
			/** 1.1: xs:override children (replacement-style modifications). */
			readonly overrides?: readonly {
				readonly schemaLocation: string;
				readonly types: readonly XsdDescriptor[];
			}[];
			/** 1.1: schema-level default attribute group name. */
			readonly defaultAttributes?: string;
			readonly types: readonly XsdDescriptor[];
			readonly annotation?: XsdAnnotation;
	  };

/** Re-export TypeTerm for downstream convenience. */
export type { TypeTerm };
