# CI Integration

This guide shows how to integrate governance-linter into your CI pipeline and local development workflow.

---

## TypeScript / ESLint Plugin

### Installation

```bash
npm install --save-dev eslint-plugin-aumos-governance eslint
```

### ESLint Flat Config (eslint.config.js)

The simplest setup uses the bundled `recommended` config:

```javascript
import aumos from 'eslint-plugin-aumos-governance';

export default [
  aumos.configs.recommended,
  // ...your other config objects
];
```

To configure rules individually:

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

### Running in CI

Add a lint step to your CI workflow:

```yaml
# .github/workflows/lint.yml
- name: Run ESLint
  run: npx eslint "src/**/*.ts"
```

---

## Python Linter

### Installation

```bash
pip install aumos-governance-linter
```

Or as a development dependency:

```bash
pip install -e ".[dev]"
```

### CLI Usage

```bash
# Lint a directory
governance-lint src/

# Lint specific files
governance-lint src/agent.py src/tools.py

# Enable only specific rules
governance-lint src/ --rules no-ungoverned-tool-call require-budget-check

# Output as JSON (useful for tooling integration)
governance-lint src/ --format json
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No violations found |
| `1` | One or more violations found |
| `2` | Argument / usage error |

---

## GitHub Actions

### Complete workflow

```yaml
# .github/workflows/governance-lint.yml
name: Governance Lint

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typescript:
    name: ESLint (TypeScript)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx eslint "src/**/*.ts" --max-warnings 0

  python:
    name: governance-lint (Python)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'
      - run: pip install aumos-governance-linter
      - run: governance-lint src/
```

### Annotating Pull Requests with JSON output

If you want GitHub to surface violations as PR annotations, you can use the JSON output with a custom annotation step:

```yaml
- name: Run governance-lint (JSON)
  run: governance-lint src/ --format json > governance-violations.json || true

- name: Annotate PR with violations
  uses: yuzutech/annotations-action@v0.4.0
  with:
    repo-token: ${{ secrets.GITHUB_TOKEN }}
    input: governance-violations.json
```

---

## Pre-commit Hooks

### Python linter

Add to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: governance-lint
        name: Governance Lint (Python)
        entry: governance-lint
        language: python
        types: [python]
        pass_filenames: true
        additional_dependencies: [aumos-governance-linter]
```

### TypeScript ESLint

```yaml
repos:
  - repo: local
    hooks:
      - id: eslint-governance
        name: ESLint Governance Rules
        entry: npx eslint --max-warnings 0
        language: node
        files: \.(ts|tsx)$
        additional_dependencies:
          - eslint
          - eslint-plugin-aumos-governance
```

---

## Programmatic API (Python)

```python
from governance_linter import GovernanceLinter
from governance_linter.rules import NoUngovernedToolCall, RequireBudgetCheck

# Use all rules
linter = GovernanceLinter()
violations = linter.lint_file("src/agent.py")

# Use a subset of rules
linter = GovernanceLinter(rules=[NoUngovernedToolCall, RequireBudgetCheck])
violations = linter.lint_directory("src/")

# Format as text
print(linter.format_violations(violations, output_format="text"))

# Format as JSON
import json
output = linter.format_violations(violations, output_format="json")
records = json.loads(output)
```

---

## Suppressing False Positives

Sometimes a tool call is governed through a mechanism the linter cannot detect statically (e.g. a decorator-based check, middleware, or wrapper function). In such cases you can suppress the warning inline.

### TypeScript

```typescript
// eslint-disable-next-line aumos-governance/no-ungoverned-tool-call
const result = await tool.run(taskId);  // governed by @requiresGovernance decorator
```

### Python

```python
# governance-lint: disable=no-ungoverned-tool-call
result = await tool.run(task_id)  # governed by @requires_governance decorator
```

Note: Python suppression comments are recognised by the linter if they appear on the same line as the violation or on the line immediately preceding it.

---

## Configuring Rule Options (TypeScript)

The `no-hardcoded-trust-level` rule accepts an option to change the upper bound of the magic-number range:

```javascript
// Flag numbers up to 10 instead of the default 5
'aumos-governance/no-hardcoded-trust-level': ['warn', { maxMagicValue: 10 }]
```

The `no-ungoverned-tool-call` rule accepts extra object/method name lists:

```javascript
'aumos-governance/no-ungoverned-tool-call': [
  'error',
  {
    additionalToolPatterns: ['myCustomTool'],
    additionalCheckPatterns: ['myGovernanceCheck'],
  },
]
```
