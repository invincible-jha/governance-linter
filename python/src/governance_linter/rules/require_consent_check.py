# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
Rule: require-consent-check

Detects data-access patterns (db.query(), repo.find(), user.fetch(), etc.)
that are not preceded by a consent check (consent.check(),
privacy.verify(), permissions.is_allowed(), etc.) in the same function scope.

Rationale: Accessing personal or sensitive data without first verifying that
the user or subject has consented is a privacy violation. The consent check
must precede the access so that the access is never performed if consent is
absent.
"""

import ast

from .base import BaseRule

# Object names that typically expose data-access operations
DATA_ACCESS_OBJECTS: set[str] = {
    "db",
    "database",
    "repo",
    "repository",
    "store",
    "user",
    "users",
    "profile",
    "customer",
}

# Method names that constitute a data-access operation
DATA_ACCESS_METHODS: set[str] = {
    "query",
    "find",
    "find_one",
    "find_all",
    "find_by_id",
    "fetch",
    "get",
    "read",
    "select",
    "load",
}

# Object names that perform consent / privacy checks
CONSENT_OBJECTS: set[str] = {"consent", "privacy", "gdpr", "permissions"}

# Method names that constitute a consent check
CONSENT_METHODS: set[str] = {
    "check",
    "verify",
    "has_consent",
    "is_allowed",
    "grant",
}


class RequireConsentCheck(BaseRule):
    """Flag data-access calls that lack a prior consent check in the same scope."""

    rule_id = "require-consent-check"
    description = (
        "Require a consent check before data-access operations. Calls to "
        "db.query(), repo.find(), user.fetch(), etc. must be preceded by "
        "consent.check() or an equivalent in the same function scope."
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
                call, objects=DATA_ACCESS_OBJECTS, methods=DATA_ACCESS_METHODS
            ):
                continue

            target_line: int = getattr(call, "lineno", 0)

            has_prior_consent = self.calls_before(
                all_calls,
                target_line,
                objects=CONSENT_OBJECTS,
                methods=CONSENT_METHODS,
            )

            if not has_prior_consent:
                callee_text = self._format_callee(call)
                self.report(
                    call,
                    f"'{callee_text}' accesses data but no consent check "
                    "(e.g. consent.check() or privacy.verify()) was found before it "
                    "in the enclosing function. Verify consent before reading "
                    "personal data.",
                )

    @staticmethod
    def _format_callee(call: ast.Call) -> str:
        if isinstance(call.func, ast.Attribute) and isinstance(call.func.value, ast.Name):
            return f"{call.func.value.id}.{call.func.attr}"
        return "<unknown>"
