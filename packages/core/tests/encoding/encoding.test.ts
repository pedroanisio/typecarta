import {
	base,
	checkCompleteness,
	checkFaithfulness,
	checkSoundness,
	createEncoding,
	createEvaluator,
	createExtension,
	literal,
} from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";
import { describe, expect, it } from "vitest";

describe("Encoding framework", () => {
	const identityEncoding = createEncoding("source", "target", (t) => t);

	const evaluator = createEvaluator((term: TypeTerm) => {
		if (term.kind === "base" && term.name === "number") {
			return createExtension((v) => typeof v === "number");
		}
		if (term.kind === "literal") {
			return createExtension((v) => v === term.value);
		}
		return createExtension(() => false);
	});

	const testTerms = [base("number"), literal(42)];
	const testValues = [42, "hello", true, null, 0, -1, 3.14];

	it("identity encoding is sound", () => {
		const result = checkSoundness(identityEncoding, evaluator, evaluator, testTerms, testValues);
		expect(result.isSound).toBe(true);
	});

	it("identity encoding is complete", () => {
		const result = checkCompleteness(identityEncoding, evaluator, evaluator, testTerms, testValues);
		expect(result.isComplete).toBe(true);
	});

	it("identity encoding is faithful", () => {
		const result = checkFaithfulness(identityEncoding, evaluator, evaluator, testTerms, testValues);
		expect(result.isFaithful).toBe(true);
	});

	it("detects unsound encoding", () => {
		// An encoding that maps everything to top (accepts all values)
		const broadEncoding = createEncoding("source", "target", () => base("number"));
		const narrowEvaluator = createEvaluator((term: TypeTerm) => {
			if (term.kind === "literal") {
				return createExtension((v) => v === term.value);
			}
			return createExtension((v) => typeof v === "number");
		});

		const result = checkSoundness(
			broadEncoding,
			createEvaluator((term: TypeTerm) => {
				if (term.kind === "literal") return createExtension((v) => v === (term as any).value);
				return createExtension(() => false);
			}),
			narrowEvaluator,
			[literal(42)],
			[42, 99, 0],
		);
		// 99 and 0 are accepted by number but not by literal(42) — unsound
		expect(result.isSound).toBe(false);
	});
});
