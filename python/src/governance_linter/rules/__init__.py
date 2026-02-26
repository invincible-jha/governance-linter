# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
Governance lint rules for Python source code.

Each rule is a subclass of :class:`BaseRule` and implements one or more
``visit_*`` methods from :class:`ast.NodeVisitor`.

All five rules are exported from this package and collected in
``ALL_RULES`` for convenience.
"""

from .base import BaseRule, LintViolation
from .no_ungoverned_tool_call import NoUngovernedToolCall
from .no_unlogged_action import NoUnloggedAction
from .no_hardcoded_trust_level import NoHardcodedTrustLevel
from .require_consent_check import RequireConsentCheck
from .require_budget_check import RequireBudgetCheck

ALL_RULES: list[type[BaseRule]] = [
    NoUngovernedToolCall,
    NoUnloggedAction,
    NoHardcodedTrustLevel,
    RequireConsentCheck,
    RequireBudgetCheck,
]

__all__ = [
    "BaseRule",
    "LintViolation",
    "NoUngovernedToolCall",
    "NoUnloggedAction",
    "NoHardcodedTrustLevel",
    "RequireConsentCheck",
    "RequireBudgetCheck",
    "ALL_RULES",
]
