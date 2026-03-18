---
title: "Extension: Gradual Typing"
status: draft
date: 2026-03-18
---

# Gradual Typing Extension

## Summary

Extends the criterion set with predicates for gradual type systems where static and dynamic typing coexist.

## Planned Criteria

- **π'_G1**: Unknown type — an explicit "I don't know" type distinct from ⊤
- **π'_G2**: Consistent subtyping — ≤~ relation where unknown is consistent with any type
- **π'_G3**: Blame tracking — runtime error attribution to type boundary crossings
- **π'_G4**: Gradual guarantee — adding type annotations never changes runtime behavior
- **π'_G5**: Migration path — incremental annotation from fully dynamic to fully static

## Open Questions

- How does the unknown type interact with complement (π'₅₉)?
- Should consistent subtyping be modeled as a separate relation or as a meta-tag on ≤?
- Integration with the encoding framework: is a gradual encoding faithful if it preserves the gradual guarantee?

## References

- Siek, Taha. "Gradual Typing for Functional Languages." *Scheme Workshop*, 2006.
- Garcia, Clark, Tanter. "Abstracting Gradual Typing." *POPL*, 2016.
