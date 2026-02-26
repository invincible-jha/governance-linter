# FIRE LINE

This file documents hard boundaries for the governance-linter project.

## What This Tool Is

governance-linter performs **static analysis** on source code to detect patterns that indicate missing governance controls. It reports violations but never takes corrective action on its own.

## Absolute Boundaries

- **NO production-specific rules.** Rules must be general-purpose and applicable to any codebase regardless of deployment environment.
- **NO forbidden identifiers.** Rules must not block or flag specific function names, variable names, or identifiers based on a blocklist. All rules are pattern-based and structural.
- **NO auto-fix mutations** that alter governance logic. The linter may suggest fixes (ESLint `fix` property) only for mechanical transformations such as replacing magic numbers with constant references — never for logic that affects runtime governance behavior.
- **NO runtime enforcement.** This tool is a linter, not a policy engine. It does not intercept, block, or modify agent execution at runtime.
- **NO data collection.** The linter never transmits source code, file paths, violation data, or metrics to any external service.

## Intended Use

governance-linter is a developer-tooling aid for identifying governance gaps during code review and CI. It supplements — and does not replace — runtime governance systems such as `aumos-core` trust gates, consent services, and audit logging infrastructure.

## Scope Freeze

The five rules shipped in v0.1.0 represent the initial scope. New rules require community discussion via GitHub Issues before implementation begins.
