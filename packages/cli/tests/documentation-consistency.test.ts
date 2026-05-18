import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

function readRepoFile(path: string): string {
	return readFileSync(`${repoRoot}/${path}`, "utf8");
}

describe("documentation consistency", () => {
	it("keeps README CLI examples aligned with current scorecard and witness flags", () => {
		const readme = readRepoFile("README.md");

		expect(readme).toContain("typecarta scorecard --adapter json-schema --filter all");
		expect(readme).toContain("typecarta witness --criterion pi-prime-25");
		expect(readme).not.toContain("typecarta witness --criterion pi-07");
	});

	it("does not point active docs at removed criterion and witness paths", () => {
		const activeDocs = [
			"README.md",
			"docs/architecture.md",
			"docs/CONTRIBUTING.md",
			"docs/conceptual-analysis.md",
			"docs/guides/reading-the-scorecard.md",
		];

		for (const path of activeDocs) {
			const text = readRepoFile(path);
			expect(text, path).not.toContain("packages/witnesses/src/pi/");
			expect(text, path).not.toContain("witnesses/src/pi/");
			expect(text, path).not.toContain("packages/core/src/criteria/pi/");
			expect(text, path).not.toContain("core/src/criteria/types.ts");
		}
	});

	it("records the full witness set as implemented rather than future work", () => {
		const spec = readRepoFile("spec/schema-ir-expressiveness-map.md");
		const readme = readRepoFile("README.md");

		expect(spec).toContain("ships a machine-applicable full witness set");
		expect(spec).toContain("packages/witnesses/src/pi-prime/");
		expect(readme).toContain("Scorecard Spec Assessment");

		expect(spec).not.toContain("full diverse schema set covering all 70 criteria has not");
		expect(spec).not.toContain("Missing full scorecard");
		expect(readme).not.toContain("55 criteria outside the core lack witness schemas");
	});

	it("documents TypeCarta self-comparison rules and the capability export", () => {
		const guide = readRepoFile("docs/guides/comparing-typecarta.md");
		const scorecardGuide = readRepoFile("docs/guides/reading-the-scorecard.md");

		expect(scorecardGuide).toContain("./comparing-typecarta.md");
		expect(guide).toContain("typecarta capabilities --format json");
		expect(guide).toContain("native-node");
		expect(guide).toContain("apply-constructor");
		expect(guide).toContain("annotation");
		expect(guide).toContain("extension");
		expect(guide).toContain("out-of-scope");
		expect(guide).toContain("packages/core/src/criteria/pi-prime/self-capabilities.ts");
		expect(guide).toContain("packages/core/src/criteria/pi-prime/self-witnesses.ts");
		expect(guide).not.toContain("TypeCarta is universal by construction");
	});

	it("keeps generated external comparison HTML out of the repository", () => {
		const gitignore = readRepoFile(".gitignore");

		expect(gitignore).toContain("global-ast-space-*.html");
	});
});
