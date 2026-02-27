# AumOS Governance Linter

Real-time governance linting for AI agent code in VS Code. Detects ungoverned
tool calls, missing trust checks, and hardcoded trust levels as you work.

## What it checks

| Rule | ID | Description |
|------|----|-------------|
| Ungoverned OpenAI call | AUMOS-001 | Raw OpenAI API call without a governed wrapper |
| Ungoverned Anthropic call | AUMOS-002 | Raw Anthropic API call without a governed wrapper |
| Ungoverned LangChain tool | AUMOS-003 | LangChain tool/chain without AumOS governance callback |
| Missing trust check | AUMOS-004 | Tool invocation not preceded by engine.check() |
| Hardcoded trust level | AUMOS-005 | Numeric trust level literal above safe threshold |
| Missing audit log | AUMOS-006 | Governance decision not recorded to audit trail |

## Quick start

1. Install from the VS Code Marketplace: search **AumOS Governance Linter**.
2. Open a TypeScript, JavaScript, or Python file that uses AI APIs.
3. Violations appear in the Problems panel and inline as squiggles.
4. Click the lightbulb on a flagged line to apply a quick fix.

## Commands

| Command | Description |
|---------|-------------|
| `AumOS: Run Governance Lint` | Lint the active file immediately |
| `AumOS: Auto-Fix Governance Issues` | Apply all available quick fixes |

## Configuration

```jsonc
{
  // Enable or disable the extension
  "aumos.governance.enabled": true,

  // Severity shown in the Problems panel: "error" | "warning" | "information" | "hint"
  "aumos.governance.severity": "warning",

  // Lint on every save (recommended)
  "aumos.governance.checkOnSave": true,

  // Lint as you type (higher CPU cost)
  "aumos.governance.checkOnType": false
}
```

## Quick fixes

Each rule ships with a one-click quick fix that inserts the minimum governance
boilerplate. The inserted code is marked with a `TODO` comment so you know
exactly what to fill in — the extension never generates silent stubs.

## Related tooling

- [eslint-plugin-aumos-governance](https://www.npmjs.com/package/eslint-plugin-aumos-governance) — ESLint plugin for CI pipelines
- [aumos-governance-linter](https://pypi.org/project/aumos-governance-linter/) — Python CLI and AST linter
- [Semgrep rules](https://github.com/aumos-ai/governance-linter/tree/main/semgrep) — cross-language Semgrep rules
- [Pre-commit hooks](https://github.com/aumos-ai/governance-linter) — `.pre-commit-hooks.yaml`

## License

Apache-2.0. Copyright (c) 2026 MuVeraAI Corporation.
