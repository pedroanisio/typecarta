import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@typecarta/core": path.resolve(__dirname, "src/index.ts"),
			"@typecarta/witnesses": path.resolve(__dirname, "../witnesses/src/index.ts"),
		},
	},
	test: {
		include: ["tests/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/index.ts"],
			thresholds: {
				statements: 90,
				branches: 80,
				functions: 90,
				lines: 90,
			},
		},
	},
});
