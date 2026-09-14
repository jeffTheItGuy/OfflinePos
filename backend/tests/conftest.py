"""Shared pytest setup for backend UNIT tests.

Unit tests must never touch a live database or the network, so we point
SQLAlchemy at in-memory SQLite BEFORE any backend module is imported.
"""
import os
import sys

# Force an isolated in-memory DB for the whole unit suite. Must run before
# backend.app.config is imported, because it reads DATABASE_URL at import time.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

# Make `import backend.app...` resolve from the repo root regardless of CWD.
# tests/backend/ -> repo root is two levels up.
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)