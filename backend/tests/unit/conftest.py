"""
Root conftest for backend tests.

Unit tests: force in-memory SQLite (no Postgres needed).
Integration tests: use the real DATABASE_URL from environment.

Detection: if the 'integration' marker is selected via `-m integration`,
we skip the SQLite override.
"""
import os
import sys

# Put repo root on sys.path so `import backend.app...` resolves.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

def pytest_configure(config):
    """Only force SQLite when NOT running integration tests."""
    selected_markers = config.getoption("-m", default="")
    if "integration" not in selected_markers:
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"
