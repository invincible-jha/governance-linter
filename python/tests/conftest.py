# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 MuVeraAI Corporation
"""Shared fixtures for governance-linter tests."""

from __future__ import annotations

import textwrap
import tempfile
import os

import pytest


@pytest.fixture
def tmp_py_file(tmp_path: pytest.TempPathFactory) -> callable:
    """Return a factory that writes Python source to a temp file and returns its path."""

    def _make_file(source: str) -> str:
        dedented = textwrap.dedent(source).strip()
        file_path = tmp_path / "test_module.py"  # type: ignore[operator]
        file_path.write_text(dedented, encoding="utf-8")
        return str(file_path)

    return _make_file
