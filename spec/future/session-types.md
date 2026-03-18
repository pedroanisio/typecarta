---
title: "Extension: Session Types"
status: draft
date: 2026-03-18
---

# Session Types Extension

## Summary

Extends the criterion set with predicates for communication protocol types that describe sequences of message exchanges.

## Planned Criteria

- **π'_S1**: Send action — !T.S (send value of type T, continue as S)
- **π'_S2**: Receive action — ?T.S (receive value of type T, continue as S)
- **π'_S3**: Choice — ⊕{l₁: S₁, ..., lₙ: Sₙ} (internal choice)
- **π'_S4**: Branch — &{l₁: S₁, ..., lₙ: Sₙ} (external choice)
- **π'_S5**: Session end — end (protocol termination)
- **π'_S6**: Duality — S̄ (complement session type)
- **π'_S7**: Recursive session — μX.S (looping protocol)

## Open Questions

- Session types are inherently sequential — how do they interact with the set-based extension model ⟦τ⟧ ⊆ 𝒱?
- Should session types extend the value universe to include traces/channels?
- Relationship to π'₇₀ (temporal/stateful types): session types are a structured form of stateful typing.

## References

- Honda. "Types for Dyadic Interaction." *CONCUR*, 1993.
- Honda, Vasconcelos, Kubo. "Language Primitives and Type Discipline for Structured Communication-Based Programming." *ESOP*, 1998.
- Milner. *Communication and Concurrency.* Prentice Hall, 1989.
