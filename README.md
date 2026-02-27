# governance-linter

[![Governance Score](https://img.shields.io/badge/governance-self--assessed-blue)](https://github.com/aumos-ai/governance-linter)

Static analysis catching ungoverned agent actions. Part of the [AumOS](https://github.com/muveraai/aumos-oss) open-source governance suite.

Ships as two complementary tools:

| Tool | Language | Package |
|------|----------|---------|
| ESLint plugin | TypeScript / JavaScript | `eslint-plugin-aumos-governance` |
| AST-based linter + CLI | Python | `aumos-governance-linter` |

Both tools enforce the same five governance rules at development time so that policy gaps are caught in code review and CI — long before they reach a production agent runtime.

---

## Rules

| Rule | Default | Description |
|------|---------|-------------|
| `no-ungoverned-tool-call` | `error` | Tool invocations require a prior governance check |
| `no-unlogged-action` | `warn` | Governance decisions must be passed to an audit logger |
| `no-hardcoded-trust-level` | `warn` | Trust-level comparisons must use named constants, not magic numbers |
| `require-consent-check` | `warn` | Data-access calls require a prior consent check |
| `require-budget-check` | `warn` | LLM / API spend calls require a prior budget check |

Full rule documentation: [docs/rules.md](docs/rules.md)

---

## Quick Start

### TypeScript (ESLint)

```bash
npm install --save-dev eslint-plugin-aumos-governance eslint
```

```javascript
// eslint.config.js
import aumos from 'eslint-plugin-aumos-governance';

export default [
  aumos.configs.recommended,
];
```

```bash
npx eslint "src/**/*.ts"
```

### Python

```bash
pip install aumos-governance-linter
governance-lint src/
```

---

## Installation

### TypeScript

Requires Node.js >= 20 and ESLint >= 9.

```bash
npm install --save-dev eslint-plugin-aumos-governance
# or
pnpm add -D eslint-plugin-aumos-governance
```

### Python

Requires Python >= 3.10.

```bash
pip install aumos-governance-linter
```

---

## Usage

### TypeScript — Recommended Config

```javascript
// eslint.config.js
import aumos from 'eslint-plugin-aumos-governance';

export default [
  aumos.configs.recommended,
];
```

### TypeScript — Per-Rule Config

```javascript
import aumos from 'eslint-plugin-aumos-governance';

export default [
  {
    plugins: { 'aumos-governance': aumos },
    rules: {
      'aumos-governance/no-ungoverned-tool-call': 'error',
      'aumos-governance/no-unlogged-action': 'warn',
      'aumos-governance/no-hardcoded-trust-level': 'warn',
      'aumos-governance/require-consent-check': 'warn',
      'aumos-governance/require-budget-check': 'warn',
    },
  },
];
```

### Python CLI

```bash
# Lint a directory tree
governance-lint src/

# Lint individual files
governance-lint src/agent.py src/tools.py

# Enable only specific rules
governance-lint src/ --rules no-ungoverned-tool-call require-budget-check

# Output JSON for tooling integration
governance-lint src/ --format json
```

### Python — Programmatic API

```python
from governance_linter import GovernanceLinter

linter = GovernanceLinter()
violations = linter.lint_file("src/agent.py")
print(linter.format_violations(violations))
```

---

## Example Violations

### no-ungoverned-tool-call

```python
# Violation — no governance check before tool.run()
async def handle_request(request: AgentRequest) -> AgentResponse:
    result = await tool.run(request.action)   # [no-ungoverned-tool-call]
    return AgentResponse(result=result)

# Fixed
async def handle_request(request: AgentRequest) -> AgentResponse:
    await engine.check("run-action", {"action": request.action})
    result = await tool.run(request.action)   # OK
    return AgentResponse(result=result)
```

### no-hardcoded-trust-level

```typescript
// Violation — magic number 3
if (agent.trustLevel >= 3) { ... }  // [no-hardcoded-trust-level]

// Fixed
import { TrustLevel } from '@aumos/core';
if (agent.trustLevel >= TrustLevel.OPERATOR) { ... }  // OK
```

### require-budget-check

```typescript
// Violation — LLM call without budget check
async function summarise(text: string) {
  return await openai.chat({ ... });  // [require-budget-check]
}

// Fixed
async function summarise(text: string) {
  await budget.check({ operation: "summarise", estimatedTokens: 300 });
  return await openai.chat({ ... });  // OK
}
```

---

## CI Integration

See [docs/ci-integration.md](docs/ci-integration.md) for:

- GitHub Actions workflows
- Pre-commit hook configuration
- PR annotation with JSON output
- Suppression comments for false positives

---

## Development

### TypeScript

```bash
cd typescript
npm install
npm run build      # compile with tsup
npm run typecheck  # tsc --noEmit
```

### Python

```bash
cd python
pip install -e ".[dev]"
governance-lint src/           # self-lint
ruff check src/                # style lint
mypy src/                      # type check
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidance on adding new rules, commit style, and the PR process.

## Fire Line

See [FIRE_LINE.md](FIRE_LINE.md) for hard boundaries on what this tool does and does not do.

## License

Apache 2.0 — see [LICENSE](LICENSE).

Copyright (c) 2026 MuVeraAI Corporation
