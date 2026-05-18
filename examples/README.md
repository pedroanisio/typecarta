# Examples

The `examples` directory contains runnable workspace packages. Each package demonstrates one TypeCarta workflow and can be run directly or through the root smoke script.

Run every example from the repository root:

```bash
pnpm run examples:smoke
```

Run one example:

```bash
pnpm --filter @typecarta/example-basic-scorecard run start
```

## Example Packages

| Package | Purpose | Notes |
|---|---|---|
| `@typecarta/example-basic-scorecard` | Scores JSON Schema draft-07 against the 15 base criteria. | Demonstrates `evaluateScorecard`, Markdown output, and JSON output. |
| `@typecarta/example-ci-compatibility-gate` | Shows a scorecard comparison as a merge gate. | Passes by default. Run `pnpm --filter @typecarta/example-ci-compatibility-gate run start:regression` to demonstrate a failing gate. |
| `@typecarta/example-custom-ir` | Defines a small CSV-like adapter inline. | This is a toy adapter for adapter-authoring education, not a production package. |
| `@typecarta/example-llm-integration` | Formats scorecard data for tool payloads and prompts. | Does not call an LLM API. It only prepares payload shapes. |
| `@typecarta/example-schema-migration` | Compares JSON Schema with a smaller flat schema subset. | Uses an inline toy adapter to demonstrate loss reporting. |

## Expectations

Examples are documentation-backed demos. They should run cleanly, but they are not the main regression suite. Package tests remain the source for behavioral regressions.
