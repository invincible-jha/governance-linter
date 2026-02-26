# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
GovernanceLinter — orchestrates all rules against one file or a directory tree.
"""

import ast
import glob
import json
import os
from typing import Literal

from .rules import ALL_RULES
from .rules.base import BaseRule, LintViolation

# Default rule set — all five governance rules
DEFAULT_RULES: list[type[BaseRule]] = ALL_RULES


class GovernanceLinter:
    """
    AST-based Python linter for governance compliance.

    Instantiate with an optional subset of rule classes. If *rules* is
    omitted all five built-in rules are enabled.

    Example::

        from governance_linter import GovernanceLinter

        linter = GovernanceLinter()
        violations = linter.lint_file("src/agent.py")
        print(linter.format_violations(violations))
    """

    def __init__(self, rules: list[type[BaseRule]] | None = None) -> None:
        self.rule_classes: list[type[BaseRule]] = rules if rules is not None else DEFAULT_RULES

    # ── Public API ─────────────────────────────────────────────────────────────

    def lint_file(self, filepath: str) -> list[LintViolation]:
        """
        Parse *filepath* and run all enabled rules against its AST.

        Returns an empty list if the file cannot be parsed (a parse error is
        reported as a single ``parse-error`` violation).
        """
        try:
            with open(filepath, encoding="utf-8") as file_handle:
                source = file_handle.read()
        except OSError as exc:
            return [
                LintViolation(
                    rule="io-error",
                    message=f"Could not read file: {exc}",
                    file=filepath,
                    line=0,
                    col=0,
                )
            ]

        try:
            tree = ast.parse(source, filename=filepath)
        except SyntaxError as exc:
            return [
                LintViolation(
                    rule="parse-error",
                    message=f"Syntax error: {exc.msg} (line {exc.lineno})",
                    file=filepath,
                    line=exc.lineno or 0,
                    col=exc.offset or 0,
                )
            ]

        violations: list[LintViolation] = []
        for rule_class in self.rule_classes:
            rule_instance = rule_class(filename=filepath)
            rule_instance.visit(tree)
            violations.extend(rule_instance.violations)

        # Sort by line then column for deterministic output
        violations.sort(key=lambda v: (v.line, v.col))
        return violations

    def lint_directory(
        self,
        dirpath: str,
        pattern: str = "**/*.py",
    ) -> list[LintViolation]:
        """
        Recursively scan *dirpath* for Python files matching *pattern* and
        lint each one.

        Returns a flat list of all violations, sorted by file path then line.
        """
        all_violations: list[LintViolation] = []
        glob_pattern = os.path.join(dirpath, pattern)

        matched_files = sorted(glob.glob(glob_pattern, recursive=True))

        for filepath in matched_files:
            if not os.path.isfile(filepath):
                continue
            all_violations.extend(self.lint_file(filepath))

        return all_violations

    def format_violations(
        self,
        violations: list[LintViolation],
        output_format: Literal["text", "json"] = "text",
    ) -> str:
        """
        Format *violations* for display.

        *output_format* can be ``"text"`` (one line per violation, default)
        or ``"json"`` (a JSON array suitable for tooling integration).
        """
        if output_format == "json":
            return self._format_json(violations)
        return self._format_text(violations)

    # ── Formatting helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _format_text(violations: list[LintViolation]) -> str:
        if not violations:
            return "No governance violations found."

        lines: list[str] = []
        current_file: str | None = None

        for violation in sorted(violations, key=lambda v: (v.file, v.line, v.col)):
            if violation.file != current_file:
                if current_file is not None:
                    lines.append("")
                lines.append(f"  {violation.file}")
                current_file = violation.file
            lines.append(
                f"    {violation.line}:{violation.col}  [{violation.rule}]  {violation.message}"
            )

        total = len(violations)
        lines.append("")
        lines.append(
            f"  {total} governance violation{'s' if total != 1 else ''} found."
        )
        return "\n".join(lines)

    @staticmethod
    def _format_json(violations: list[LintViolation]) -> str:
        records = [
            {
                "rule": v.rule,
                "message": v.message,
                "file": v.file,
                "line": v.line,
                "col": v.col,
            }
            for v in violations
        ]
        return json.dumps(records, indent=2)
