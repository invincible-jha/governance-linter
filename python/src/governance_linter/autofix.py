# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
Auto-fix suggestions for governance lint violations.

For each supported rule, ``AutoFixer`` generates a ``CodeFix`` — a structured
suggestion that describes what the code should look like after the fix.
Suggestions are advisory only; they are never applied automatically.

Callers render the fix using ``CodeFix.description`` or apply the patch using
``old_code``/``new_code`` on the original source.

Example
-------
>>> fixer = AutoFixer()
>>> fix = fixer.suggest_fix(violation)
>>> if fix:
...     print(fix.description)
...     print(f"Replace: {fix.old_code!r}")
...     print(f"With:    {fix.new_code!r}")
"""

from __future__ import annotations

from dataclasses import dataclass

from governance_linter.rules.base import LintViolation

__all__ = ["AutoFixer", "CodeFix"]


@dataclass(frozen=True)
class CodeFix:
    """A suggested code fix for a governance lint violation.

    Fixes are advisory — they describe what the code should look like, but
    the linter never modifies source files without explicit caller action.

    Attributes:
        file_path:    Path to the file containing the violation.
        old_code:     The problematic code fragment (as a string).
        new_code:     The suggested replacement code.
        description:  Human-readable explanation of the fix.
        line:         The line number where the fix should be applied.
        rule:         The rule ID that triggered this fix suggestion.
    """

    file_path: str
    old_code: str
    new_code: str
    description: str
    line: int
    rule: str

    def __str__(self) -> str:
        return (
            f"[{self.rule}] {self.file_path}:{self.line}\n"
            f"  Fix: {self.description}\n"
            f"  Replace: {self.old_code!r}\n"
            f"  With:    {self.new_code!r}"
        )


# ---------------------------------------------------------------------------
# Rule-specific fix templates
# ---------------------------------------------------------------------------

# Maps rule_id -> (description_template, fix_generator_fn)
# Fix generators take the violation and return (old_code, new_code, description).

def _fix_no_ungoverned_tool_call(violation: LintViolation) -> tuple[str, str, str]:
    return (
        "tool.call(",
        "governance.check(action, context)\ntool.call(",
        "Add a governance.check() call before invoking the tool.",
    )


def _fix_no_unlogged_action(violation: LintViolation) -> tuple[str, str, str]:
    return (
        "# ungoverned action",
        "audit.log(decision)\n# action now logged",
        "Pass the governance decision to audit.log() to satisfy logging requirement.",
    )


def _fix_no_hardcoded_trust_level(violation: LintViolation) -> tuple[str, str, str]:
    return (
        "trust_level == 3",
        "trust_level == TrustLevel.L3",
        "Replace the numeric literal with a named constant from TrustLevel.",
    )


def _fix_require_consent_check(violation: LintViolation) -> tuple[str, str, str]:
    return (
        "data_store.read(",
        "consent.check(resource, agent_id)\ndata_store.read(",
        "Add a consent.check() call before accessing the data resource.",
    )


def _fix_require_budget_check(violation: LintViolation) -> tuple[str, str, str]:
    return (
        "spend(",
        "budget.check(category, amount)\nspend(",
        "Add a budget.check() call before the spending operation.",
    )


_RULE_FIX_MAP: dict[
    str,
    "function" # type: ignore[type-arg]
] = {  # type: ignore[assignment]
    "no-ungoverned-tool-call": _fix_no_ungoverned_tool_call,
    "no-unlogged-action": _fix_no_unlogged_action,
    "no-hardcoded-trust-level": _fix_no_hardcoded_trust_level,
    "require-consent-check": _fix_require_consent_check,
    "require-budget-check": _fix_require_budget_check,
}


# ---------------------------------------------------------------------------
# AutoFixer
# ---------------------------------------------------------------------------


class AutoFixer:
    """Suggests code fixes for governance lint violations.

    For each rule with a known fix template, ``suggest_fix`` returns a
    ``CodeFix`` with old/new code and a human-readable description.

    Rules without a fix template return ``None`` — not every violation
    can be auto-fixed (e.g., architectural violations requiring design changes).

    Example
    -------
    >>> fixer = AutoFixer()
    >>> violations = linter.lint_file("src/agent.py")
    >>> for v in violations:
    ...     fix = fixer.suggest_fix(v)
    ...     if fix:
    ...         print(fix)
    """

    def suggest_fix(self, violation: LintViolation) -> CodeFix | None:
        """Return a fix suggestion for *violation*, or ``None`` if unsupported.

        Parameters
        ----------
        violation:
            A ``LintViolation`` produced by ``GovernanceLinter``.

        Returns
        -------
        CodeFix | None:
            A suggested fix, or ``None`` when no template exists for the rule.
        """
        fix_generator = _RULE_FIX_MAP.get(violation.rule)
        if fix_generator is None:
            return None

        old_code, new_code, description = fix_generator(violation)
        return CodeFix(
            file_path=violation.file,
            old_code=old_code,
            new_code=new_code,
            description=description,
            line=violation.line,
            rule=violation.rule,
        )

    def suggest_all(self, violations: list[LintViolation]) -> list[CodeFix]:
        """Return fix suggestions for all violations that have a template.

        Violations without a fix template are silently skipped.

        Parameters
        ----------
        violations:
            List of ``LintViolation`` instances.

        Returns
        -------
        list[CodeFix]:
            One ``CodeFix`` per violation that has a template. May be shorter
            than the input list.
        """
        fixes: list[CodeFix] = []
        for violation in violations:
            fix = self.suggest_fix(violation)
            if fix is not None:
                fixes.append(fix)
        return fixes

    @property
    def supported_rules(self) -> list[str]:
        """List of rule IDs that have auto-fix templates."""
        return sorted(_RULE_FIX_MAP.keys())
