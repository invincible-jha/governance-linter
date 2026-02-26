# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
CLI interface: governance-lint src/

Entry point registered as ``governance-lint`` in pyproject.toml.

Usage
-----
.. code-block:: text

    governance-lint [OPTIONS] PATH [PATH ...]

    Positional arguments:
      PATH              One or more files or directories to lint.

    Options:
      --rules RULE ...  Restrict linting to specific rule IDs.
      --format {text,json}
                        Output format (default: text).
      -h, --help        Show this help message and exit.

Exit codes
----------
  0 — no violations found
  1 — one or more violations found
  2 — usage / argument error
"""

import argparse
import os
import sys

from .linter import DEFAULT_RULES, GovernanceLinter
from .rules.base import LintViolation


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="governance-lint",
        description=(
            "AumOS Governance Linter — static analysis that catches ungoverned "
            "agent actions in Python source code."
        ),
    )
    parser.add_argument(
        "paths",
        nargs="+",
        metavar="PATH",
        help="Files or directories to lint.",
    )
    parser.add_argument(
        "--rules",
        nargs="*",
        metavar="RULE",
        help=(
            "Restrict linting to specific rule IDs, e.g. "
            "--rules no-ungoverned-tool-call require-budget-check"
        ),
    )
    parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Output format (default: text).",
    )
    return parser


def _resolve_rule_classes(
    rule_ids: list[str] | None,
) -> list[type]:
    """
    Return the subset of DEFAULT_RULES whose rule_id is in *rule_ids*.
    If *rule_ids* is None or empty, return all DEFAULT_RULES.
    """
    if not rule_ids:
        return list(DEFAULT_RULES)

    id_set = set(rule_ids)
    selected = [cls for cls in DEFAULT_RULES if cls.rule_id in id_set]

    unknown = id_set - {cls.rule_id for cls in selected}
    if unknown:
        known_ids = ", ".join(cls.rule_id for cls in DEFAULT_RULES)
        print(
            f"governance-lint: unknown rule ID(s): {', '.join(sorted(unknown))}. "
            f"Available rules: {known_ids}",
            file=sys.stderr,
        )
        sys.exit(2)

    return selected


def _collect_violations(
    linter: GovernanceLinter, paths: list[str]
) -> list[LintViolation]:
    violations: list[LintViolation] = []
    for path in paths:
        if os.path.isdir(path):
            violations.extend(linter.lint_directory(path))
        elif os.path.isfile(path):
            violations.extend(linter.lint_file(path))
        else:
            print(
                f"governance-lint: path not found: {path}",
                file=sys.stderr,
            )
            sys.exit(2)
    return violations


def main() -> None:
    """CLI entry point."""
    parser = _build_parser()
    args = parser.parse_args()

    rule_classes = _resolve_rule_classes(args.rules)
    linter = GovernanceLinter(rules=rule_classes)  # type: ignore[arg-type]

    violations = _collect_violations(linter, args.paths)

    output = linter.format_violations(violations, output_format=args.format)
    print(output)

    sys.exit(1 if violations else 0)


if __name__ == "__main__":
    main()
