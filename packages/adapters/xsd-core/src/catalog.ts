// Canonical name and kind lists per XSD version.
//
// Keep these in sync with vendor/specs/xsd/ (1.0) and vendor/specs/xsd-1-1/ (1.1).

import type { TypeTerm } from "@typecarta/core";

/** XSD 1.0 Part 2 §3.2 — 19 built-in primitive datatypes. */
export const XSD_PRIMITIVE_NAMES_10: readonly string[] = [
	"string",
	"boolean",
	"decimal",
	"float",
	"double",
	"duration",
	"dateTime",
	"time",
	"date",
	"gYearMonth",
	"gYear",
	"gMonthDay",
	"gDay",
	"gMonth",
	"hexBinary",
	"base64Binary",
	"anyURI",
	"QName",
	"NOTATION",
];

/** XSD 1.0 Part 2 §3.3 — commonly used built-in derived datatypes. */
export const XSD_BUILTIN_DERIVED_NAMES_10: readonly string[] = [
	"normalizedString",
	"token",
	"language",
	"Name",
	"NCName",
	"NMTOKEN",
	"NMTOKENS",
	"ID",
	"IDREF",
	"IDREFS",
	"ENTITY",
	"ENTITIES",
	"integer",
	"nonPositiveInteger",
	"negativeInteger",
	"long",
	"int",
	"short",
	"byte",
	"nonNegativeInteger",
	"unsignedLong",
	"unsignedInt",
	"unsignedShort",
	"unsignedByte",
	"positiveInteger",
];

/**
 * XSD 1.1 Part 2 — adds dateTimeStamp (§3.4.28), dayTimeDuration (§3.4.27),
 * yearMonthDuration (§3.4.26), and anyAtomicType (§4.1.6) on top of 1.0.
 */
export const XSD_PRIMITIVE_NAMES_11: readonly string[] = [
	...XSD_PRIMITIVE_NAMES_10,
	"dateTimeStamp",
	"dayTimeDuration",
	"yearMonthDuration",
	"anyAtomicType",
];

/** XSD 1.1's built-in derived set is the same as 1.0's. */
export const XSD_BUILTIN_DERIVED_NAMES_11: readonly string[] = XSD_BUILTIN_DERIVED_NAMES_10;

/**
 * 12 constraining facets defined in XSD 1.0 Part 2 §4.3. Does NOT include
 * `multipleOf` (JSON Schema invention, not an XSD facet).
 */
export const XSD_FACET_KEYS_10: readonly string[] = [
	"enumeration",
	"pattern",
	"length",
	"minLength",
	"maxLength",
	"minInclusive",
	"maxInclusive",
	"minExclusive",
	"maxExclusive",
	"whiteSpace",
	"totalDigits",
	"fractionDigits",
];

/** XSD 1.1 Part 2 §4.3 — adds assertions (§4.3.13) and explicitTimezone (§4.3.14). */
export const XSD_FACET_KEYS_11: readonly string[] = [
	...XSD_FACET_KEYS_10,
	"assertions",
	"explicitTimezone",
];

/**
 * IR `TypeTerm["kind"]` values both 1.0 and 1.1 support. 1.1 adds
 * "conditional" via `xs:alternative`.
 */
export const BASE_SUPPORTED_KINDS: ReadonlySet<TypeTerm["kind"]> = new Set([
	"bottom",
	"top",
	"literal",
	"base",
	"apply",
	"refinement",
	"nominal",
	"let",
	"extension",
] satisfies readonly TypeTerm["kind"][]);
