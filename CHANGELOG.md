# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-26

### Added
- TypeScript ESLint plugin (`eslint-plugin-aumos-governance`) with five rules:
  - `no-ungoverned-tool-call` — flags tool invocations lacking a prior governance check
  - `no-unlogged-action` — flags governance decisions not passed to an audit logger
  - `no-hardcoded-trust-level` — flags magic number trust levels in comparisons
  - `require-consent-check` — flags data-access patterns without a consent check
  - `require-budget-check` — flags spending patterns without a budget check
- Python AST-based linter (`aumos-governance-linter`) mirroring all five rules
- CLI entry point `governance-lint` for scanning Python source trees
- `recommended` ESLint config preset
- Documentation: `docs/rules.md` and `docs/ci-integration.md`
