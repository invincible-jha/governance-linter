# Contributing to governance-linter

Thank you for your interest in contributing. This document explains the process for proposing changes, writing rules, and getting your work merged.

## Prerequisites

- Node.js >= 20 and pnpm (or npm) for the TypeScript plugin
- Python >= 3.10 and pip for the Python linter
- Familiarity with ESLint rule authoring and Python `ast` module

## Setting Up

### TypeScript

```bash
cd typescript
npm install
npm run build
```

### Python

```bash
cd python
pip install -e ".[dev]"
```

## Adding a New Rule

### TypeScript

1. Create `typescript/src/rules/your-rule-name.ts`.
2. Export a `Rule.RuleModule` with `meta` and `create` properties.
3. Register the rule in `typescript/src/index.ts` under both `rules` and the `recommended` config.
4. Document the rule in `docs/rules.md`.

### Python

1. Create `python/src/governance_linter/rules/your_rule_name.py`.
2. Subclass `BaseRule` and implement the relevant `visit_*` methods.
3. Register the rule in `python/src/governance_linter/rules/__init__.py` and in `DEFAULT_RULES` inside `linter.py`.
4. Document the rule in `docs/rules.md`.

## Commit Style

Follow conventional commits:

```
feat: add require-rate-limit-check rule
fix: handle async arrow functions in no-ungoverned-tool-call
docs: clarify budget-check examples
```

## Pull Requests

- Branch from `main` using the prefix `feature/`, `fix/`, or `docs/`.
- Keep each PR focused on a single concern.
- Ensure `npm run build` and `governance-lint` both succeed before opening a PR.
- Squash-merge only — do not rebase shared branches.

## Code Style

- TypeScript: strict mode, no `any`, named exports.
- Python: type hints on all signatures, Pydantic/dataclasses for data structures.
- Both: descriptive names, no abbreviations.

## License

By contributing you agree that your contributions will be licensed under Apache 2.0.
