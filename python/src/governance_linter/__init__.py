# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation

"""
aumos-governance-linter
=======================

Python AST-based linter that catches ungoverned agent actions in Python source
code. Mirrors the five rules of the ``eslint-plugin-aumos-governance`` plugin.

Quickstart
----------

.. code-block:: python

    from governance_linter import GovernanceLinter

    linter = GovernanceLinter()
    violations = linter.lint_file("src/agent.py")
    print(linter.format_violations(violations))

Or from the command line::

    governance-lint src/

"""

from .linter import GovernanceLinter
from .rules.base import BaseRule, LintViolation

__all__ = ["GovernanceLinter", "BaseRule", "LintViolation"]
__version__ = "0.1.0"
