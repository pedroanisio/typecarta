# Writing an Adapter

This guide walks through implementing an `IRAdapter` for a new schema language.

## 1. Scaffold

Copy the template:

```bash
cp -r packages/adapters/_template packages/adapters/my-lang
```

Update `package.json` with the correct name (`@typecarta/adapter-my-lang`).

## 2. Define the Signature

A `Signature` declares the base types and constructors your language supports:

```ts
import { createSignature } from "@typecarta/core";

const MY_SIGNATURE = createSignature(
  ["string", "number", "boolean"],           // base types
  [
    { name: "product", arity: 1 },           // constructors
    { name: "array", arity: 1 },
    { name: "union", arity: 2 },
  ],
);
```

## 3. Implement IRAdapter

```ts
import type { IRAdapter, Signature, TypeTerm } from "@typecarta/core";

type MyNativeFormat = Record<string, unknown>; // your schema's native format

class MyAdapter implements IRAdapter<Signature, MyNativeFormat> {
  readonly name = "My Language";
  readonly signature = MY_SIGNATURE;

  parse(source: MyNativeFormat): TypeTerm { /* native → AST */ }
  encode(term: TypeTerm): MyNativeFormat { /* AST → native */ }
  isEncodable(term: TypeTerm): boolean { /* can this be represented? */ }
  inhabits(value: unknown, term: TypeTerm): boolean { /* value ∈ ⟦τ⟧? */ }
}
```

### parse(source)

Convert a native schema document into the typecarta AST. Map each native construct to the corresponding AST node:

- Primitive types → `base("string")`, `base("number")`, etc.
- Object/struct → `product([field("name", type), ...])`
- Array/list → `array(elementType)`
- Union/oneOf → `union([branch1, branch2, ...])`
- Intersection/allOf → `intersection([...types])`
- Enum → `union([literal("a"), literal("b"), ...])`

### encode(term)

Reverse of parse — convert an AST node back to native format. Throw for unsupported constructs.

### isEncodable(term)

Return `true` if `encode` would succeed. Used for scorecard generation.

### inhabits(value, term)

Runtime membership check: does `value` belong to the extension of `term`? This powers encoding soundness/completeness checks.

## 4. Write Conformance Tests

```ts
import { describe, it, expect } from "vitest";
import { MyAdapter } from "../src/index.js";
import { base, product, field, array } from "@typecarta/core";

describe("MyAdapter conformance", () => {
  const adapter = new MyAdapter();

  it("roundtrips base types", () => {
    const term = base("string");
    const encoded = adapter.encode(term);
    const parsed = adapter.parse(encoded);
    expect(parsed).toEqual(term);
  });

  it("inhabits matching values", () => {
    expect(adapter.inhabits("hello", base("string"))).toBe(true);
    expect(adapter.inhabits(42, base("number"))).toBe(true);
  });

  it("rejects non-matching values", () => {
    expect(adapter.inhabits(42, base("string"))).toBe(false);
  });
});
```

## 5. Register

```ts
import { registerAdapter } from "@typecarta/core";
import { MyAdapter } from "@typecarta/adapter-my-lang";

registerAdapter(new MyAdapter());
```
