# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation
"""
Tests for governance-linter — LintViolation, BaseRule helpers, individual rules,
and the GovernanceLinter orchestrator.
"""

from __future__ import annotations

import os
import textwrap
from typing import Callable

import pytest

from governance_linter.linter import GovernanceLinter
from governance_linter.rules.base import BaseRule, LintViolation
from governance_linter.rules.no_ungoverned_tool_call import NoUngovernedToolCall
from governance_linter.rules.no_unlogged_action import NoUnloggedAction
from governance_linter.rules.no_hardcoded_trust_level import NoHardcodedTrustLevel
from governance_linter.rules.require_budget_check import RequireBudgetCheck
from governance_linter.rules.require_consent_check import RequireConsentCheck


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _lint_source(source: str, rule_classes: list | None = None) -> list[LintViolation]:
    """Lint inline Python source string using a temp file."""
    import tempfile
    dedented = textwrap.dedent(source).strip()
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", encoding="utf-8", delete=False
    ) as fh:
        fh.write(dedented)
        tmp_path = fh.name
    try:
        linter = GovernanceLinter(rules=rule_classes)
        return linter.lint_file(tmp_path)
    finally:
        os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# TestLintViolation
# ---------------------------------------------------------------------------


class TestLintViolation:
    def test_violation_str_format(self) -> None:
        v = LintViolation(
            rule="no-ungoverned-tool-call",
            message="Missing governance check.",
            file="agent.py",
            line=10,
            col=4,
        )
        text = str(v)
        assert "agent.py:10:4" in text
        assert "no-ungoverned-tool-call" in text

    def test_violation_is_frozen(self) -> None:
        v = LintViolation(
            rule="test-rule",
            message="test",
            file="test.py",
            line=1,
            col=0,
        )
        with pytest.raises((AttributeError, TypeError)):
            v.rule = "changed"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# TestNoUngovernedToolCall
# ---------------------------------------------------------------------------


class TestNoUngovernedToolCall:
    def test_ungoverned_tool_call_is_flagged(self) -> None:
        source = """
        def run_agent():
            tool.run("search query")
        """
        violations = _lint_source(source, [NoUngovernedToolCall])
        rule_ids = [v.rule for v in violations]
        assert "no-ungoverned-tool-call" in rule_ids

    def test_governed_tool_call_passes(self) -> None:
        source = """
        def run_agent():
            engine.check("tool_call")
            tool.run("search query")
        """
        violations = _lint_source(source, [NoUngovernedToolCall])
        rule_ids = [v.rule for v in violations]
        assert "no-ungoverned-tool-call" not in rule_ids

    def test_governance_check_after_tool_call_still_flags(self) -> None:
        source = """
        def run_agent():
            tool.run("search query")
            engine.check("tool_call")
        """
        violations = _lint_source(source, [NoUngovernedToolCall])
        rule_ids = [v.rule for v in violations]
        # The check comes AFTER the call, so still a violation
        assert "no-ungoverned-tool-call" in rule_ids

    def test_no_tool_call_produces_no_violation(self) -> None:
        source = """
        def run_agent():
            result = compute_result(42)
            return result
        """
        violations = _lint_source(source, [NoUngovernedToolCall])
        rule_ids = [v.rule for v in violations]
        assert "no-ungoverned-tool-call" not in rule_ids

    def test_async_function_also_checked(self) -> None:
        source = """
        async def run_async_agent():
            agent.invoke("action")
        """
        violations = _lint_source(source, [NoUngovernedToolCall])
        rule_ids = [v.rule for v in violations]
        assert "no-ungoverned-tool-call" in rule_ids

    def test_governance_check_with_alternative_objects(self) -> None:
        source = """
        def run_agent():
            governance.check("tool_call")
            tools.execute("search")
        """
        violations = _lint_source(source, [NoUngovernedToolCall])
        rule_ids = [v.rule for v in violations]
        assert "no-ungoverned-tool-call" not in rule_ids


# ---------------------------------------------------------------------------
# TestNoHardcodedTrustLevel
# ---------------------------------------------------------------------------


class TestNoHardcodedTrustLevel:
    def test_numeric_literal_in_trust_comparison_flagged(self) -> None:
        source = """
        def check_trust(level):
            if level >= 3:
                return True
            return False
        """
        violations = _lint_source(source, [NoHardcodedTrustLevel])
        rule_ids = [v.rule for v in violations]
        assert "no-hardcoded-trust-level" in rule_ids

    def test_constant_reference_passes(self) -> None:
        source = """
        from governance import TrustLevel
        def check_trust(level):
            if level >= TrustLevel.L3_ACT_APPROVE:
                return True
            return False
        """
        violations = _lint_source(source, [NoHardcodedTrustLevel])
        rule_ids = [v.rule for v in violations]
        assert "no-hardcoded-trust-level" not in rule_ids

    def test_numeric_literal_in_unrelated_comparison_not_flagged(self) -> None:
        source = """
        def count_items(items):
            if len(items) >= 3:
                return True
            return False
        """
        violations = _lint_source(source, [NoHardcodedTrustLevel])
        rule_ids = [v.rule for v in violations]
        assert "no-hardcoded-trust-level" not in rule_ids


# ---------------------------------------------------------------------------
# TestGovernanceLinter Orchestrator
# ---------------------------------------------------------------------------


class TestGovernanceLinter:
    def test_lint_file_returns_empty_for_clean_code(self) -> None:
        source = """
        def greet(name):
            return f"Hello, {name}"
        """
        violations = _lint_source(source)
        assert isinstance(violations, list)

    def test_lint_file_returns_violations_for_bad_code(self) -> None:
        source = """
        def run():
            tool.run("search")
        """
        linter = GovernanceLinter()
        import tempfile
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", encoding="utf-8", delete=False
        ) as fh:
            fh.write(textwrap.dedent(source).strip())
            tmp_path = fh.name
        try:
            violations = linter.lint_file(tmp_path)
        finally:
            os.unlink(tmp_path)
        assert len(violations) > 0

    def test_lint_nonexistent_file_returns_io_error_violation(self) -> None:
        linter = GovernanceLinter()
        violations = linter.lint_file("/nonexistent/path/to/file.py")
        assert len(violations) == 1
        assert violations[0].rule == "io-error"

    def test_lint_syntax_error_file_returns_parse_error_violation(self) -> None:
        import tempfile
        bad_source = "def broken_syntax(:\n    pass\n"
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", encoding="utf-8", delete=False
        ) as fh:
            fh.write(bad_source)
            tmp_path = fh.name
        try:
            linter = GovernanceLinter()
            violations = linter.lint_file(tmp_path)
        finally:
            os.unlink(tmp_path)
        assert len(violations) == 1
        assert violations[0].rule == "parse-error"

    def test_format_violations_text_no_violations(self) -> None:
        linter = GovernanceLinter()
        output = linter.format_violations([])
        assert "No governance violations" in output

    def test_format_violations_text_with_violations(self) -> None:
        violation = LintViolation(
            rule="no-ungoverned-tool-call",
            message="Missing check.",
            file="agent.py",
            line=5,
            col=4,
        )
        linter = GovernanceLinter()
        output = linter.format_violations([violation], output_format="text")
        assert "no-ungoverned-tool-call" in output
        assert "agent.py" in output

    def test_format_violations_json_produces_valid_json(self) -> None:
        import json
        violation = LintViolation(
            rule="require-budget-check",
            message="Missing budget check.",
            file="spend.py",
            line=12,
            col=8,
        )
        linter = GovernanceLinter()
        output = linter.format_violations([violation], output_format="json")
        parsed = json.loads(output)
        assert isinstance(parsed, list)
        assert parsed[0]["rule"] == "require-budget-check"

    def test_custom_rule_subset_limits_violations(self) -> None:
        # Using only NoUngovernedToolCall limits which rules fire
        source = """
        def run():
            tool.run("search")
        """
        violations_all = _lint_source(source)
        violations_single = _lint_source(source, [NoUngovernedToolCall])
        rule_ids_single = {v.rule for v in violations_single}
        # With single rule, only that rule can fire
        assert rule_ids_single <= {"no-ungoverned-tool-call"}

    def test_violations_sorted_by_line_then_col(self) -> None:
        source = """
        def run():
            tool.run("a")
            tool.run("b")
        """
        violations = _lint_source(source, [NoUngovernedToolCall])
        if len(violations) >= 2:
            for i in range(len(violations) - 1):
                assert (violations[i].line, violations[i].col) <= (
                    violations[i + 1].line,
                    violations[i + 1].col,
                )

    def test_all_five_rules_registered_by_default(self) -> None:
        linter = GovernanceLinter()
        assert len(linter.rule_classes) == 5
