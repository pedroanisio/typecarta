# @typecarta/adapter-TEMPLATE

Scaffold template for creating a new typecarta adapter.

## How to create a new adapter

1. **Copy this directory** to `packages/adapters/your-adapter-name/`.

2. **Update `package.json`:**
   - Set `"name"` to `"@typecarta/adapter-your-name"`
   - Set `"description"` to describe your adapter

3. **Define your native descriptor type** in `src/adapter.ts`:
   - Replace `NativeDescriptor` with a type that represents schemas in your target format
   - The adapter should NOT depend on the actual library at runtime
   - Only work with plain descriptor objects

4. **Define your signature:**
   - List the base types your schema language supports (e.g., `"string"`, `"number"`)
   - List the type constructors (e.g., `product`, `array`, `union`) with their arities

5. **Implement the adapter methods:**
   - `parse(source)` -- Convert a native descriptor into a `TypeTerm` AST node
   - `encode(term)` -- Convert a `TypeTerm` AST node into your native format
   - `isEncodable(term)` -- Check if a term can be represented in your format
   - `inhabits(value, term)` -- Runtime type check: does `value` match `term`?
   - `operationalSubtype(a, b)` -- (Optional) Structural subtyping check

6. **Write conformance tests** in `tests/conformance.test.ts`:
   - parse-then-encode roundtrip for basic types
   - inhabits returns true for matching values
   - inhabits returns false for non-matching values
   - isEncodable returns true for supported terms, false for unsupported

7. **Update the barrel export** in `src/index.ts`.

## IRAdapter interface

```ts
interface IRAdapter<Sig extends Signature, Native> {
  readonly name: string;
  readonly signature: Sig;
  parse(source: Native): TypeTerm;
  encode(term: TypeTerm): Native;
  isEncodable(term: TypeTerm): boolean;
  inhabits(value: unknown, term: TypeTerm): boolean;
  operationalSubtype?(a: TypeTerm, b: TypeTerm): boolean;
}
```

## Available core constructors

`bottom`, `top`, `literal`, `base`, `typeVar`, `apply`, `forall`, `mu`,
`refinement`, `complement`, `keyOf`, `conditional`, `mapped`, `rowPoly`,
`nominal`, `letBinding`, `extension`, `product`, `union`, `intersection`,
`array`, `set`, `map`, `arrow`, `tuple`, `templateLiteral`, `field`,
`rangeConstraint`, `patternConstraint`, `multipleOfConstraint`
