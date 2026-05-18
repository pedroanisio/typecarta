// @typecarta/adapter-linkml
//
// LinkML adapter for typecarta. Models the Python-first LinkML modeling
// language: classes, slots, types, enums, subsets, inheritance (is_a +
// mixins), constraints, rules, URIs, and imports. Vendored canonical
// spec at vendor/specs/linkml/.

export { LinkmlAdapter } from "./adapter.js";
export type {
	LinkmlBuiltinName,
	LinkmlClass,
	LinkmlDescriptor,
	LinkmlEnum,
	LinkmlMetadata,
	LinkmlPermissibleValue,
	LinkmlRule,
	LinkmlSchema,
	LinkmlSlot,
	LinkmlType,
} from "./adapter.js";
export { LINKML_BUILTIN_NAMES } from "./adapter.js";
