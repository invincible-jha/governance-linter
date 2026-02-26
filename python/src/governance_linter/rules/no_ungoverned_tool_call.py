# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
Rule: no-ungoverned-tool-call

Detects tool invocations (tool.run(), tool.execute(), tool.invoke(), etc.)
that are not preceded by a governance check (engine.check(),
governance.check(), trust.verify(), etc.) within the same function scope.

Rationale: Every action an agent takes through a tool must be authorised by
the governance layer before execution. Skipping the check means the agent can
perform arbitrary actions without policy enforcement.
"""

import ast

from .base import BaseRule

# Object names treated as tool handles
TOOL_OBJECTS: set[str] = {"tool", "tools", "agent", "executor"}

# Method names treated as tool invocation verbs
TOOL_METHODS: set[str] = {"run", "execute", "invoke", "call", "dispatch"}

# Object names that carry a governance / trust check
GOVERNANCE_OBJECTS: set[str] = {"engine", "governance", "trust", "policy", "aumos"}

# Method names that constitute a governance check
GOVERNANCE_METHODS: set[str] = {
    "check",
    "verify",
    "validate",
    "authorize",
    "permit",
}


class NoUngovernedToolCall(BaseRule):
    """Flag tool invocations that lack a prior governance check in the same scope."""

    rule_id = "no-ungoverned-tool-call"
    description = (
        "Require a governance check before every tool invocation. Tool calls "
        "without a prior engine.check() / governance.check() in the same scope "
        "are ungoverned and violate agent policy."
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
        """Walk all calls in this function and flag ungoverned tool calls."""
        all_calls = self.collect_calls(func_node)

        for call in all_calls:
            if not self.is_method_call(call, objects=TOOL_OBJECTS, methods=TOOL_METHODS):
                continue

            target_line: int = getattr(call, "lineno", 0)

            has_prior_check = self.calls_before(
                all_calls,
                target_line,
                objects=GOVERNANCE_OBJECTS,
                methods=GOVERNANCE_METHODS,
            )

            if not has_prior_check:
                callee_text = self._format_callee(call)
                self.report(
                    call,
                    f"'{callee_text}' is a tool invocation but no governance check "
                    "(e.g. engine.check() or governance.check()) was found before it "
                    "in the enclosing function. Add a check to authorise this action.",
                )

    @staticmethod
    def _format_callee(call: ast.Call) -> str:
        if isinstance(call.func, ast.Attribute) and isinstance(call.func.value, ast.Name):
            return f"{call.func.value.id}.{call.func.attr}"
        return "<unknown>"
