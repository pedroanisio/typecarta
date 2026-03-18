# ADR 005: Adapter Contract Design

## Status

Accepted

## Context

typecarta needs to interface with many schema languages (JSON Schema, Zod, TypeScript, Protobuf, etc.) through a uniform contract.

## Decision

The `IRAdapter<Sig, Native>` interface requires four mandatory methods and one optional:

```ts
interface IRAdapter<Sig extends Signature, Native = unknown> {
  readonly name: string;
  readonly signature: Sig;
  parse(source: Native): TypeTerm;
  encode(term: TypeTerm): Native;
  isEncodable(term: TypeTerm): boolean;
  inhabits(value: unknown, term: TypeTerm): boolean;
  operationalSubtype?(a: TypeTerm, b: TypeTerm): boolean;
}
```

## Rationale

- **parse + encode** form a partial isomorphism between native and AST, enabling roundtrip testing
- **isEncodable** lets the scorecard engine determine coverage without catching exceptions
- **inhabits** provides the extension oracle needed for semantic subtyping checks
- **operationalSubtype** is optional because not all IRs have a built-in assignability judgment
- Generic over `Sig` and `Native` allows adapters to carry their own type-level context

## Alternatives Considered

- **Separate Parser/Encoder/Evaluator classes** — More flexible but more boilerplate; a single interface keeps adapters cohesive.
- **Plugin-based with dynamic dispatch** — Harder to type-check; the generic interface catches mismatches at compile time.

## Consequences

- Every adapter is a single class implementing five methods
- Conformance tests can be written generically against the interface
- The adapter registry indexes by `name` for CLI lookup
