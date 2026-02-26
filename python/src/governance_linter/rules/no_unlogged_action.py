# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
Rule: no-unlogged-action

Detects governance checks (engine.check(), governance.check(), etc.) that
are made but whose outcome is never passed to an audit logger
(audit.log(), logger.log(), auditLog(), etc.) anywhere in the same
function scope.

Rationale: Governance decisions must be auditable. If a check is performed
but the outcome is never recorded, the system cannot be retrospectively
audited, which breaks compliance requirements.
"""

import ast

from .base import BaseRule

# Object names that perform a governance / trust check
GOVERNANCE_OBJECTS: set[str] = {"engine", "governance", "trust", "policy", "aumos"}

# Method names that constitute a governance check
GOVERNANCE_METHODS: set[str] = {
    "check",
    "verify",
    "validate",
    "authorize",
    "permit",
}

# Object names associated with audit / structured logging
AUDIT_OBJECTS: set[str] = {"audit", "logger", "log", "auditLog"}

# Method names for audit / structured logging
AUDIT_METHODS: set[str] = {
    "log",
    "write",
    "record",
    "emit",
    "info",
    "debug",
    "warn",
    "error",
}

# Standalone function names treated as audit log calls
AUDIT_FUNCTIONS: set[str] = {"auditLog", "auditAction", "logAction", "recordAction"}


class NoUnloggedAction(BaseRule):
    """Flag governance checks that have no corresponding audit log call in the same scope."""

    rule_id = "no-unlogged-action"
    description = (
        "Require that every governance check is followed by an audit log call in "
        "the same function scope. Un-logged governance decisions break audit trails."
    )

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._check_function_body(node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._check_function_body(node)
        self.generic_visit(node)

    def _check_function_body(
        self, func_node: ast.FunctionDef | ast.AsyncFunctionDef
    ) -> None:
        all_calls = self.collect_calls(func_node)

        for call in all_calls:
            if not self.is_method_call(
                call, objects=GOVERNANCE_OBJECTS, methods=GOVERNANCE_METHODS
            ):
                continue

            # Check whether any audit log call exists anywhere in the function
            # (it need not precede the check — the log may be in a then-branch or finally)
            has_audit_log = self.calls_exist(
                all_calls, objects=AUDIT_OBJECTS, methods=AUDIT_METHODS
            ) or self._has_audit_function_call(all_calls)

            if not has_audit_log:
                callee_text = self._format_callee(call)
                self.report(
                    call,
                    f"'{callee_text}' is a governance check but no audit log call "
                    "(e.g. audit.log() or logger.log()) was found in the enclosing "
                    "function. Log the outcome so it can be audited.",
                )

    @staticmethod
    def _has_audit_function_call(calls: list[ast.Call]) -> bool:
        """Return True if any standalone audit function is called."""
        for call in calls:
            if isinstance(call.func, ast.Name) and call.func.id in AUDIT_FUNCTIONS:
                return True
        return False

    @staticmethod
    def _format_callee(call: ast.Call) -> str:
        if isinstance(call.func, ast.Attribute) and isinstance(call.func.value, ast.Name):
            return f"{call.func.value.id}.{call.func.attr}"
        return "<unknown>"
