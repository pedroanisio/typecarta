// Traversal
// Provide fold, map, and visitor-based traversal over TypeTerm trees.

import type { PartialVisitor, TypeTerm, TypeTermVisitor } from "./type-term.js";

/**
 * Apply an exhaustive visitor to a TypeTerm node.
 * @param term - The node to visit.
 * @param visitor - A visitor handling every node kind (enforced at compile time).
 * @returns The result produced by the matching visitor handler.
 */
export function visit<R>(term: TypeTerm, visitor: TypeTermVisitor<R>): R {
	const handler = visitor[term.kind] as (node: TypeTerm) => R;
	return handler(term);
}

/**
 * Apply a partial visitor with a default fallback for unhandled kinds.
 * @param term - The node to visit.
 * @param visitor - A partial visitor handling a subset of node kinds.
 * @param fallback - Handler invoked for node kinds not covered by `visitor`.
 * @returns The result from the matching handler or the fallback.
 */
export function visitPartial<R>(
	term: TypeTerm,
	visitor: PartialVisitor<R>,
	fallback: (node: TypeTerm) => R,
): R {
	const handler = visitor[term.kind] as ((node: TypeTerm) => R) | undefined;
	return handler ? handler(term) : fallback(term);
}

/**
 * Return all direct child type terms of a node.
 * @param term - The node whose children to extract.
 * @returns An array of immediate child {@link TypeTerm} nodes.
 */
export function children(term: TypeTerm): readonly TypeTerm[] {
	switch (term.kind) {
		case "bottom":
		case "top":
		case "literal":
		case "base":
		case "var":
			return [];
		case "apply": {
			const fieldTypes = term.fields?.map((f) => f.type) ?? [];
			return [...term.args, ...fieldTypes];
		}
		case "forall": {
			const result: TypeTerm[] = [term.body];
			if (term.bound) result.push(term.bound);
			if (term.default) result.push(term.default);
			return result;
		}
		case "mu":
			return [term.body];
		case "refinement":
			return [term.base];
		case "complement":
			return [term.inner];
		case "keyof":
			return [term.inner];
		case "conditional":
			return [term.check, term.extends, term.then, term.else];
		case "mapped":
			return [term.keySource, term.valueTransform];
		case "rowpoly":
			return term.fields.map((f) => f.type);
		case "nominal":
			return [term.inner];
		case "let":
			return [term.binding, term.body];
		case "extension":
			return term.children ?? [];
	}
}

/**
 * Map a function over all direct children, producing a new node with transformed children.
 * @param term - The node whose children to transform.
 * @param f - The transformation applied to each child.
 * @returns A shallow copy of `term` with each child replaced by `f(child)`.
 */
export function mapChildren(term: TypeTerm, f: (child: TypeTerm) => TypeTerm): TypeTerm {
	switch (term.kind) {
		case "bottom":
		case "top":
		case "literal":
		case "base":
		case "var":
			return term;
		case "apply": {
			const newArgs = term.args.map(f);
			const newFields = term.fields?.map((fd) => ({ ...fd, type: f(fd.type) }));
			return { ...term, args: newArgs, ...(newFields ? { fields: newFields } : {}) };
		}
		case "forall":
			return {
				...term,
				body: f(term.body),
				...(term.bound ? { bound: f(term.bound) } : {}),
				...(term.default ? { default: f(term.default) } : {}),
			};
		case "mu":
			return { ...term, body: f(term.body) };
		case "refinement":
			return { ...term, base: f(term.base) };
		case "complement":
			return { ...term, inner: f(term.inner) };
		case "keyof":
			return { ...term, inner: f(term.inner) };
		case "conditional":
			return {
				...term,
				check: f(term.check),
				extends: f(term.extends),
				then: f(term.then),
				else: f(term.else),
			};
		case "mapped":
			return { ...term, keySource: f(term.keySource), valueTransform: f(term.valueTransform) };
		case "rowpoly":
			return { ...term, fields: term.fields.map((fd) => ({ ...fd, type: f(fd.type) })) };
		case "nominal":
			return { ...term, inner: f(term.inner) };
		case "let":
			return { ...term, binding: f(term.binding), body: f(term.body) };
		case "extension":
			return term.children ? { ...term, children: term.children.map(f) } : term;
	}
}

/**
 * Fold a TypeTerm tree bottom-up (catamorphism).
 * @param term - The root of the tree to fold.
 * @param algebra - An exhaustive visitor producing `R` from each node kind.
 * @param childFolder - Optional override for recursive folding of children.
 * @returns The result of applying `algebra` to the root after folding all children.
 */
export function fold<R>(
	term: TypeTerm,
	algebra: TypeTermVisitor<R>,
	childFolder?: (term: TypeTerm) => R,
): R {
	const recurse = childFolder ?? ((t: TypeTerm) => fold(t, algebra));
	const mapped = mapChildren(term, (child) => {
		recurse(child);
		return child;
	});
	return visit(mapped, algebra);
}

/**
 * Recursively transform a TypeTerm tree bottom-up.
 * @param term - The root of the tree to transform.
 * @param f - The transformation applied to each node after its children are transformed.
 * @returns The transformed tree.
 */
export function transform(term: TypeTerm, f: (node: TypeTerm) => TypeTerm): TypeTerm {
	const mapped = mapChildren(term, (child) => transform(child, f));
	return f(mapped);
}

/**
 * Collect all nodes in a TypeTerm tree that satisfy a predicate.
 * @param term - The root of the tree to search.
 * @param predicate - A function returning `true` for nodes to collect.
 * @returns An array of matching {@link TypeTerm} nodes in pre-order.
 */
export function collect(term: TypeTerm, predicate: (node: TypeTerm) => boolean): TypeTerm[] {
	const result: TypeTerm[] = [];
	function walk(node: TypeTerm): void {
		if (predicate(node)) result.push(node);
		for (const child of children(node)) {
			walk(child);
		}
	}
	walk(term);
	return result;
}
