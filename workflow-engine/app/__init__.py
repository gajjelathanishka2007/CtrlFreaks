"""CtrlFreaks workflow engine (backend-only package).

This package is intentionally independent of the React frontend and of any
database or LLM provider. The engine can be imported and executed on its own;
persistence and HTTP concerns live in ``app.storage`` and ``app.api``.
"""

__version__ = "0.1.0"
