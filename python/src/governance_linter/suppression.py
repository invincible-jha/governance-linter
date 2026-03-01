# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
Inline suppression comment support for governance-linter.

Supports two suppression directives in Python source comments:

    # governance-lint: disable=RULE_NAME
        Suppresses *RULE_NAME* for the rest of the block (or the current line).

    # governance-lint: disable-next-line
        Suppresses ALL rules on the immediately following line.

    # governance-lint: disable-next-line=RULE_NAME
        Suppresses only RULE_NAME on the immediately following line.

Suppressed violations are tracked separately in ``SuppressionReport``
so that operators can audit which violations are being silenced.

Example
-------
>>> source = '''
... # governance-lint: disable-next-line=no-hardcoded-trust-level
... if trust_level == 3:
...     pass
... '''
>>> detector = SuppressionDetector(source)
>>> detector.is_suppressed(line=3, rule="no-hardcoded-trust-level")
True
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from governance_linter.rules.base import LintViolation

__all__ = ["SuppressionDetector", "SuppressionReport", "filter_suppressed"]

# Matches: # governance-lint: disable=RULE_NAME  or  # governance-lint: disable
_DISABLE_RE = re.compile(
    r"#\s*governance-lint\s*:\s*disable(?:=([a-zA-Z0-9_\-]+))?\s*$",
    re.IGNORECASE,
)

# Matches: # governance-lint: disable-next-line  or  # governance-lint: disable-next-line=RULE
_DISABLE_NEXT_RE = re.compile(
    r"#\s*governance-lint\s*:\s*disable-next-line(?:=([a-zA-Z0-9_\-]+))?\s*$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class SuppressionEntry:
    """A single parsed suppression directive.

    Attributes:
        line:         Line number (1-based) where the directive appears.
        kind:         ``"disable"`` (current line) or ``"disable-next-line"``.
        rule:         Rule name suppressed, or ``None`` to suppress all rules.
    """

    line: int
    kind: str
    rule: str | None


@dataclass(frozen=True)
class SuppressionReport:
    """Audit record of suppressed violations.

    Attributes:
        suppressed:   List of violations that were suppressed.
        active:       List of violations that were NOT suppressed (passed through).
    """

    suppressed: list[LintViolation]
    active: list[LintViolation]

    @property
    def suppression_count(self) -> int:
        """Number of suppressed violations."""
        return len(self.suppressed)


class SuppressionDetector:
    """Parses suppression directives from Python source code.

    Scans all lines of the source for ``# governance-lint: disable`` and
    ``# governance-lint: disable-next-line`` comments, then exposes
    ``is_suppressed(line, rule)`` for the linter to query.

    Parameters
    ----------
    source:
        Full Python source code as a string.

    Example
    -------
    >>> source = "x = 1  # governance-lint: disable=no-hardcoded-trust-level"
    >>> detector = SuppressionDetector(source)
    >>> detector.is_suppressed(line=1, rule="no-hardcoded-trust-level")
    True
    """

    def __init__(self, source: str) -> None:
        self._entries: list[SuppressionEntry] = []
        self._parse(source)

    def _parse(self, source: str) -> None:
        """Extract all suppression directives from *source*."""
        for line_index, line_text in enumerate(source.splitlines(), start=1):
            stripped = line_text.strip()

            # Check for disable-next-line first (more specific)
            match = _DISABLE_NEXT_RE.search(stripped)
            if match:
                rule = match.group(1) or None
                self._entries.append(
                    SuppressionEntry(line=line_index, kind="disable-next-line", rule=rule)
                )
                continue

            match = _DISABLE_RE.search(stripped)
            if match:
                rule = match.group(1) or None
                self._entries.append(
                    SuppressionEntry(line=line_index, kind="disable", rule=rule)
                )

    def is_suppressed(self, line: int, rule: str) -> bool:
        """Return True if *rule* on *line* is covered by a suppression directive.

        Parameters
        ----------
        line:
            1-based line number of the violation.
        rule:
            The rule ID to check.

        Returns
        -------
        bool:
            True if any suppression directive covers this (line, rule) pair.
        """
        for entry in self._entries:
            # disable directive on the same line as the violation
            if entry.kind == "disable" and entry.line == line:
                if entry.rule is None or entry.rule == rule:
                    return True

            # disable-next-line on the line immediately before the violation
            if entry.kind == "disable-next-line" and entry.line == line - 1:
                if entry.rule is None or entry.rule == rule:
                    return True

        return False

    @property
    def directive_count(self) -> int:
        """Number of suppression directives found in the source."""
        return len(self._entries)


def filter_suppressed(
    violations: list[LintViolation],
    source: str,
) -> SuppressionReport:
    """Partition *violations* into suppressed and active using inline directives.

    Parameters
    ----------
    violations:
        All ``LintViolation`` instances returned by the linter for a file.
    source:
        The Python source code of the file (used to parse suppression comments).

    Returns
    -------
    SuppressionReport:
        ``suppressed``: violations covered by an inline directive.
        ``active``:     violations that remain active after applying directives.
    """
    detector = SuppressionDetector(source)
    suppressed: list[LintViolation] = []
    active: list[LintViolation] = []

    for violation in violations:
        if detector.is_suppressed(violation.line, violation.rule):
            suppressed.append(violation)
        else:
            active.append(violation)

    return SuppressionReport(suppressed=suppressed, active=active)
