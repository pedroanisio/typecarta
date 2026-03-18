// typecarta/core — public API barrel
// Re-export every public type, schema, and function from the core package.
// Organize exports by domain subsystem; source modules own the TSDoc.

// -- § 1  AST -- type term nodes, constructors, and traversal utilities --
export type {
	TypeTerm,
	TypeTermKind,
	KindOf,
	TypeTermVisitor,
	PartialVisitor,
	Annotations,
	Variance,
	FieldDescriptor,
	RefinementPredicate,
	ConstructorName,
	BottomNode,
	TopNode,
	LiteralNode,
	BaseNode,
	VarNode,
	ApplyNode,
	ForallNode,
	MuNode,
	RefinementNode,
	ComplementNode,
	KeyOfNode,
	ConditionalNode,
	MappedNode,
	RowPolyNode,
	NominalNode,
	LetNode,
	ExtensionNode,
} from "./ast/type-term.js";

export { isTypeTerm, isKind } from "./ast/type-term.js";

export type { Signature, ConstructorSpec } from "./ast/signature.js";
export {
	createSignature,
	getArity,
	hasBaseType,
	hasConstructor,
	JSON_SIGNATURE,
} from "./ast/signature.js";

export {
	bottom,
	top,
	literal,
	base,
	typeVar,
	apply,
	forall,
	mu,
	refinement,
	complement,
	keyOf,
	conditional,
	mapped,
	rowPoly,
	nominal,
	letBinding,
	extension,
	product,
	union,
	intersection,
	array,
	set,
	map,
	arrow,
	tuple,
	templateLiteral,
	field,
	rangeConstraint,
	patternConstraint,
	multipleOfConstraint,
	andPredicate,
	orPredicate,
	notPredicate,
} from "./ast/constructors.js";

export {
	visit,
	visitPartial,
	children,
	mapChildren,
	fold,
	transform,
	collect,
} from "./ast/traversal.js";

export { freeVars, occursFree } from "./ast/free-vars.js";
export { substitute, resetFreshCounter } from "./ast/substitution.js";
export { printTerm } from "./ast/print.js";

// -- § 2  Semantics -- value universe, extension evaluation, and subtyping --
export type { Value, TypePredicate, Extension } from "./semantics/value-universe.js";
export {
	createExtension,
	EMPTY_EXTENSION,
	UNIVERSAL_EXTENSION,
	singletonExtension,
	extensionsEqualBySampling,
} from "./semantics/value-universe.js";

export type { ExtensionEvaluator } from "./semantics/extension.js";
export { createEvaluator } from "./semantics/extension.js";

export type { SubtypeResult } from "./semantics/subtyping.js";
export { isSubtype, isTypeEqual, checkSubtype, checkTypeEqual } from "./semantics/subtyping.js";

export type { OperationalSubtyping, SubtypingDivergence } from "./semantics/operational.js";
export { findDivergences } from "./semantics/operational.js";

export type {
	DenotationConfig,
	ConstructorInterpretation,
	Environment,
} from "./semantics/denotation.js";
export { denote } from "./semantics/denotation.js";

// -- § 3  Criteria -- criterion predicates and the Pi registry --
export type {
	PiId,
	CriterionId,
	MetaTag,
	CriterionResult,
	CriterionPredicate,
	CriterionRegistry,
} from "./criteria/types.js";
export { PI_IDS } from "./criteria/types.js";
export { PI_CRITERIA, PI_REGISTRY } from "./criteria/pi/index.js";

// -- § 4  Criteria Pi-Prime -- expanded criterion families and registry --
export type {
	PiPrimeId,
	CriterionFamily,
	PiPrimeCriterionResult,
	PiPrimeCriterion,
	PiPrimeRegistry,
} from "./criteria/pi-prime/index.js";
export {
	PI_PRIME_IDS,
	PI_PRIME_CRITERIA,
	registerPiPrimeCriterion,
	getPiPrimeRegistry,
	getPiPrimeCriterion,
	piPrimeRegistrySize,
	FAMILY_A,
	FAMILY_B,
	FAMILY_C,
	FAMILY_D,
	FAMILY_E,
	FAMILY_F,
	FAMILY_G,
	FAMILY_H,
	FAMILY_I,
	FAMILY_J,
	FAMILY_K,
	FAMILY_L,
	FAMILY_M,
	FAMILY_N,
	FAMILY_O,
	FAMILY_P,
	FAMILY_Q,
	FAMILY_R,
	FAMILY_S,
	FAMILY_T,
	FAMILY_U,
	FAMILY_V,
} from "./criteria/pi-prime/index.js";

// -- § 5  Encoding -- encoding creation and property checks --
export type { Encoding } from "./encoding/encoding.js";
export { createEncoding } from "./encoding/encoding.js";
export type { SoundnessResult } from "./encoding/soundness.js";
export { checkSoundness } from "./encoding/soundness.js";
export type { CompletenessResult } from "./encoding/completeness.js";
export { checkCompleteness } from "./encoding/completeness.js";
export type { FaithfulnessResult } from "./encoding/faithfulness.js";
export { checkFaithfulness } from "./encoding/faithfulness.js";
export type {
	StructurePreservationResult,
	StructureViolation,
} from "./encoding/structure-preservation.js";
export { checkStructurePreservation } from "./encoding/structure-preservation.js";
export type { ModelsResult } from "./encoding/models.js";
export { checkModels } from "./encoding/models.js";

// -- § 6  Scorecard -- evaluate, compare, and render scorecards --
export type {
	CellValue,
	ScorecardCell,
	ScorecardResult,
	ScorecardTotals,
	ScorecardComparison,
	ScorecardDiff,
} from "./scorecard/types.js";
export { evaluateScorecard, evaluatePrimeScorecard } from "./scorecard/evaluate.js";
export type { WitnessEntry } from "./scorecard/evaluate.js";
export { compareScorecards } from "./scorecard/compare.js";
export { renderMarkdown, renderJSON, renderComparisonMarkdown } from "./scorecard/render.js";

// -- § 7  Encoding-Check -- width, depth, and generic preservation checks --
export type { EncodingCheckPropertyId, EncodingCheckResult } from "./encoding-check/types.js";
export { checkWidthPreservation } from "./encoding-check/rho-width.js";
export { checkDepthPreservation } from "./encoding-check/rho-depth.js";
export { checkGenericPreservation } from "./encoding-check/rho-generic.js";
export type {
	EncodingCheckSuiteResult,
	EncodingCheckWitnessPair,
} from "./encoding-check/evaluate.js";
export { runEncodingChecks } from "./encoding-check/evaluate.js";

// -- § 8  Universality -- schema classes, decidability, and weak universality --
export type { SchemaClass } from "./universality/schema-class.js";
export { createSchemaClass } from "./universality/schema-class.js";
export { checkDecidabilityHazard } from "./universality/impossibility.js";
export type { WeakUniversalityResult } from "./universality/weak.js";
export { assessWeakUniversality } from "./universality/weak.js";

// -- § 9  Adapter -- IR adapter interface, registry, and validation --
export type { IRAdapter } from "./adapter/interface.js";
export {
	registerAdapter,
	getAdapter,
	getAllAdapters,
	getAdapterNames,
	unregisterAdapter,
	clearAdapters,
} from "./adapter/registry.js";
export type { ValidationResult } from "./adapter/validation.js";
export { validateAdapter } from "./adapter/validation.js";
