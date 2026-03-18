# FAQ

## What is typecarta?

A formal framework and toolkit for reasoning about schema language expressiveness. It lets you compare what different schema languages (JSON Schema, Zod, TypeScript, Protobuf, etc.) can and cannot express, backed by a rigorous mathematical specification.

## What's a scorecard?

A scorecard evaluates how well a schema language covers 15 base criteria (Π) and optionally 70 expanded criteria (Π'). Each cell is ✓ (fully supported), partial, or ✗ (not supported).

## Why 15 base criteria?

The criteria are derived from a formal analysis of type-theoretic capabilities common across schema languages. They cover: bottom/top types, products, sums, intersection, recursion, parametricity, refinement, optionality, nominal typing, open shapes, dependent types, and higher-kinded types.

## How do adapters work?

An adapter implements the `IRAdapter` interface, which provides four methods: `parse` (native → AST), `encode` (AST → native), `isEncodable` (can this AST node be represented?), and `inhabits` (does this value belong to this type?).

## Can I add my own schema language?

Yes. Copy the `_template` adapter, implement the `IRAdapter` interface, and add conformance tests. See [guides/writing-an-adapter.md](guides/writing-an-adapter.md).

## What's encoding-check?

Encoding-check evaluates structural properties of translation functions between schema languages. It tests whether subtyping relationships are preserved across encodings (width, depth, and generic preservation).

## Does typecarta validate schemas at runtime?

No. typecarta evaluates expressiveness — what a schema language *can* represent. Runtime validation is the adapter's responsibility via the `inhabits` method.

## What's the difference between Π and Π'?

Π is the base set of 15 high-level criteria. Π' expands these into 70 fine-grained criteria organized into 22 families (A–V), providing more detailed coverage analysis.
