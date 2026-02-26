# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
Rule: require-budget-check

Detects spending / cost patterns (openai.chat(), llm.complete(),
tokens.use(), api.call(), etc.) that are not preceded by a budget check
(budget.check(), cost.verify(), quota.can_spend(), etc.) in the same
function scope.

Rationale: Agent systems can consume significant resources through LLM API
calls and external API usage. Without a prior budget check, an agent may
exceed configured cost limits, causing unexpected charges or resource
exhaustion. The budget check must precede the spend so the call is
blocked if the budget is insufficient.
"""

import ast

from .base import BaseRule

# Object names that incur a spend / resource cost
SPEND_OBJECTS: set[str] = {
    "api",
    "openai",
    "anthropic",
    "llm",
    "model",
    "tokens",
    "completion",
    "embedding",
}

# Method names that constitute a spending operation
SPEND_METHODS: set[str] = {
    "call",
    "chat",
    "complete",
    "generate",
    "embed",
    "use",
    "consume",
    "request",
    "create_completion",
    "create_chat_completion",
    "create",
}

# Object names that perform budget / quota checks
BUDGET_OBJECTS: set[str] = {"budget", "cost", "quota", "spend", "billing", "tokens"}

# Method names that constitute a budget check
BUDGET_METHODS: set[str] = {
    "check",
    "verify",
    "can_spend",
    "has_quota",
    "authorize",
    "reserve",
}


class RequireBudgetCheck(BaseRule):
    """Flag spending / LLM calls that lack a prior budget check in the same scope."""

    rule_id = "require-budget-check"
    description = (
        "Require a budget check before spending operations (LLM calls, external API "
        "calls, token usage). Calls to openai.chat(), llm.complete(), tokens.use(), "
        "etc. must be preceded by budget.check() or an equivalent."
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
                call, objects=SPEND_OBJECTS, methods=SPEND_METHODS
            ):
                continue

            target_line: int = getattr(call, "lineno", 0)

            has_prior_budget_check = self.calls_before(
                all_calls,
                target_line,
                objects=BUDGET_OBJECTS,
                methods=BUDGET_METHODS,
            )

            if not has_prior_budget_check:
                callee_text = self._format_callee(call)
                self.report(
                    call,
                    f"'{callee_text}' is a spending operation but no budget check "
                    "(e.g. budget.check() or quota.can_spend()) was found before it "
                    "in the enclosing function. Check available budget before "
                    "incurring cost.",
                )

    @staticmethod
    def _format_callee(call: ast.Call) -> str:
        if isinstance(call.func, ast.Attribute) and isinstance(call.func.value, ast.Name):
            return f"{call.func.value.id}.{call.func.attr}"
        return "<unknown>"
