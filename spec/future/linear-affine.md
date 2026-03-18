---
title: "Extension: Linear and Affine Types"
status: draft
date: 2026-03-18
---

# Linear and Affine Types Extension

## Summary

Extends the criterion set with predicates for substructural type systems that track resource usage.

## Planned Criteria

- **π'_L1**: Linear type — values used exactly once
- **π'_L2**: Affine type — values used at most once
- **π'_L3**: Relevant type — values used at least once
- **π'_L4**: Ownership transfer — move semantics
- **π'_L5**: Borrowing — temporary access without ownership transfer
- **π'_L6**: Lifetime annotation — scoped validity of references

## Open Questions

- How do linear types interact with recursion (π₇)? μ-bound variables may require use-counting.
- Should ownership be modeled in the value universe 𝒱 or as an operational property (meta-op)?
- Encoding faithfulness: can a linear type be faithfully encoded in a non-linear IR?

## References

- Wadler. "Linear Types Can Change the World!" *IFIP*, 1990.
- Walker. "Substructural Type Systems." *Advanced Topics in Types and Programming Languages*, 2005.
