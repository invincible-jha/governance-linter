# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
Rule: no-hardcoded-trust-level

Detects numeric literals in the range 0–5 that appear as the right-hand
operand of a comparison expression where the left side contains a
trust-related name (e.g. "level", "trust", "trust_level", "tier").

Patterns flagged:
    if level >= 3:           # 3 is a magic number
    if trust_level == 2:     # 2 is a magic number
    if user.trust > 1:       # 1 is a magic number

Correct form:
    if level >= TrustLevel.OPERATOR:
    if trust_level == TRUST_ELEVATED:

Rationale: Hard-coded numeric trust levels are brittle and unclear.
Named constants document intent and allow the trust model to be refactored
without hunt-and-replace across the codebase.
"""

import ast
import re

from .base import BaseRule

# Regex matching identifier fragments that suggest a trust-level variable
TRUST_PATTERN: re.Pattern[str] = re.compile(r"trust|level|tier|clearance", re.IGNORECASE)

# Numeric comparison operators in the AST
COMPARISON_OPS: set[type[ast.cmpop]] = {
    ast.Eq,
    ast.NotEq,
    ast.Lt,
    ast.LtE,
    ast.Gt,
    ast.GtE,
}

# Upper bound (inclusive) for "magic number" detection
MAX_MAGIC_VALUE = 5


def _contains_trust_name(node: ast.expr) -> bool:
    """Return True when *node* contains a name fragment matching TRUST_PATTERN."""
    if isinstance(node, ast.Name):
        return bool(TRUST_PATTERN.search(node.id))
    if isinstance(node, ast.Attribute):
        return _contains_trust_name(node.value) or bool(TRUST_PATTERN.search(node.attr))
    return False


def _is_small_int_literal(node: ast.expr) -> bool:
    """Return True when *node* is an integer literal in [0, MAX_MAGIC_VALUE]."""
    return (
        isinstance(node, ast.Constant)
        and isinstance(node.value, int)
        and 0 <= node.value <= MAX_MAGIC_VALUE
    )


class NoHardcodedTrustLevel(BaseRule):
    """Flag magic numeric literals used in trust-level comparisons."""

    rule_id = "no-hardcoded-trust-level"
    description = (
        "Disallow numeric literals (0–5) in trust-level comparisons. Use named "
        "constants instead of magic numbers so the trust model is explicit and "
        "easy to refactor."
    )

    def visit_Compare(self, node: ast.Compare) -> None:
        """
        Visit a comparison expression.

        Python represents ``a < b < c`` as a single Compare node with multiple
        comparators. We check each (left op comparator) pair individually.
        """
        left = node.left
        for op, comparator in zip(node.ops, node.comparators):
            if type(op) not in COMPARISON_OPS:
                continue
            self._check_pair(left, comparator)
            left = comparator  # slide the window for chained comparisons

        self.generic_visit(node)

    def _check_pair(self, left: ast.expr, right: ast.expr) -> None:
        # Pattern A: trust_identifier OP numeric_literal
        if _contains_trust_name(left) and _is_small_int_literal(right):
            value = right.value  # type: ignore[union-attr]
            self.report(
                right,
                f"Magic number {value} used in a trust comparison. Replace with a "
                "named constant (e.g. TrustLevel.OPERATOR or TRUST_ELEVATED) so the "
                "intent is explicit.",
            )
            return

        # Pattern B: numeric_literal OP trust_identifier (reversed)
        if _is_small_int_literal(left) and _contains_trust_name(right):
            value = left.value  # type: ignore[union-attr]
            self.report(
                left,
                f"Magic number {value} used in a trust comparison. Replace with a "
                "named constant (e.g. TrustLevel.OPERATOR or TRUST_ELEVATED) so the "
                "intent is explicit.",
            )
