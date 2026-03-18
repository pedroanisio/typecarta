# Criterion Independence

## The Independence Property

The 15 base criteria Π = {π₁, ..., π₁₅} are designed to be logically independent: satisfying one criterion neither implies nor precludes satisfying another.

This is verified by the **diverse witness set** ℂ = {S₁, ..., S₁₅}, where each Sᵢ is designed to primarily exercise πᵢ. The diversity check (`diversity-check.test.ts`) confirms that the witness set is Π-diverse (Def. 8.4).

## Why Independence Matters

Without independence, the scorecard would contain redundant information. If π₅ (sum types) implied π₆ (intersection), scoring both would inflate results for languages that support sums.

Independence ensures each row in the scorecard carries unique information about a distinct capability axis.

## Expanded Criteria Π'

The 70 expanded criteria Π' refine the base set into finer-grained sub-capabilities. Within Π', criteria in the same family may have hierarchical relationships (e.g., π'₁ Syntactic Bottom refines π₁ Bottom), but criteria across families remain independent.

## Verifying Independence

Independence is established constructively via witnesses:

1. For each πᵢ, there exists a schema Sᵢ that satisfies πᵢ
2. Each Sᵢ is minimal — it exercises πᵢ without unnecessarily satisfying other criteria
3. The `diversity-check.test.ts` verifies this property holds

If you add a new criterion, you must also provide a witness schema and verify it doesn't collapse an existing independence axis.
