# governance-linter — Claude Context

## Project Summary

Static analysis tool (ESLint plugin + Python AST linter) that catches ungoverned agent actions at development time. Part of the AumOS open-source governance suite.

## Repository Layout

```
typescript/   ESLint plugin (eslint-plugin-aumos-governance)
python/       Python AST linter (aumos-governance-linter) + CLI
docs/         Rule documentation and CI integration guides
```

## Key Files

| File | Purpose |
|------|---------|
| `typescript/src/index.ts` | Plugin registration; exports `rules` and `configs.recommended` |
| `typescript/src/utils.ts` | AST helper functions shared across all TS rules |
| `typescript/src/rules/*.ts` | One file per ESLint rule |
| `python/src/governance_linter/linter.py` | `GovernanceLinter` — orchestrates rules, formats output |
| `python/src/governance_linter/cli.py` | `governance-lint` CLI entry point |
| `python/src/governance_linter/rules/base.py` | `BaseRule` and `LintViolation` dataclass |
| `python/src/governance_linter/rules/*.py` | One file per Python rule |
| `docs/rules.md` | Full rule reference |
| `docs/ci-integration.md` | GitHub Actions / pre-commit setup |

## Rules (both languages)

1. `no-ungoverned-tool-call` — tool invocations require a prior `engine.check()` / `governance.check()`
2. `no-unlogged-action` — governance decisions must be passed to `audit.log()` / `logger.log()`
3. `no-hardcoded-trust-level` — numeric literals in trust comparisons must be replaced with constants
4. `require-consent-check` — data-access calls require a prior `consent.check()`
5. `require-budget-check` — cost/spend calls require a prior `budget.check()`

## Development Workflow

```bash
# TypeScript
cd typescript && npm install && npm run build

# Python
cd python && pip install -e ".[dev]"
governance-lint src/
```

## Constraints

See FIRE_LINE.md — specifically: no production-specific rules, no forbidden identifiers, no runtime enforcement.

## Conventions

- TypeScript: strict mode, no `any`, named exports, Apache-2.0 header on every file
- Python: type hints on all signatures, `# SPDX-License-Identifier: Apache-2.0` header
- Commits: conventional commits explaining WHY
