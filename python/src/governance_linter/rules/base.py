# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
Base class and shared data types for governance lint rules.
"""

import ast
from dataclasses import dataclass


@dataclass(frozen=True)
class LintViolation:
    """An individual governance violation detected in a source file."""

    rule: str
    """The rule identifier that produced this violation, e.g. ``no-ungoverned-tool-call``."""

    message: str
    """A human-readable description of the violation and how to fix it."""

    file: str
    """Absolute or relative path to the file where the violation was found."""

    line: int
    """1-based line number of the violating statement."""

    col: int
    """0-based column offset of the violating statement."""

    def __str__(self) -> str:
        return f"{self.file}:{self.line}:{self.col}: [{self.rule}] {self.message}"


class BaseRule(ast.NodeVisitor):
    """
    Base class for all governance lint rules.

    Subclasses must set :attr:`rule_id` and :attr:`description`, then
    override ``visit_*`` methods to detect violations and call
    :meth:`report`.

    The linter instantiates each rule with the filename being scanned, then
    calls :meth:`visit` on the module-level AST node.
    """

    rule_id: str = ""
    description: str = ""

    def __init__(self, filename: str) -> None:
        self.filename = filename
        self.violations: list[LintViolation] = []

    def report(self, node: ast.AST, message: str) -> None:
        """Record a violation at the location of *node*."""
        line = getattr(node, "lineno", 0)
        col = getattr(node, "col_offset", 0)
        self.violations.append(
            LintViolation(
                rule=self.rule_id,
                message=message,
                file=self.filename,
                line=line,
                col=col,
            )
        )

    # ── Helpers available to all rule subclasses ──────────────────────────────

    @staticmethod
    def is_method_call(node: ast.Call, *, objects: set[str], methods: set[str]) -> bool:
        """
        Return True when *node* is a call of the form ``obj.method(...)``
        where ``obj`` is in *objects* and ``method`` is in *methods*.
        """
        if not isinstance(node.func, ast.Attribute):
            return False
        attribute = node.func
        if not isinstance(attribute.value, ast.Name):
            return False
        return attribute.value.id in objects and attribute.attr in methods

    @staticmethod
    def collect_calls(tree: ast.AST) -> list[ast.Call]:
        """Return all :class:`ast.Call` nodes in *tree* (pre-order)."""
        return [node for node in ast.walk(tree) if isinstance(node, ast.Call)]

    @staticmethod
    def calls_before(
        calls: list[ast.Call],
        target_line: int,
        *,
        objects: set[str],
        methods: set[str],
    ) -> bool:
        """
        Return True when at least one call matching *objects* / *methods*
        appears before *target_line* in the given call list.
        """
        for call in calls:
            call_line = getattr(call, "lineno", float("inf"))
            if call_line >= target_line:
                continue
            if BaseRule.is_method_call(call, objects=objects, methods=methods):
                return True
        return False

    @staticmethod
    def calls_exist(
        calls: list[ast.Call],
        *,
        objects: set[str],
        methods: set[str],
    ) -> bool:
        """
        Return True when at least one call matching *objects* / *methods*
        exists anywhere in the given call list.
        """
        return any(
            BaseRule.is_method_call(call, objects=objects, methods=methods)
            for call in calls
        )
