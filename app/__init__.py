"""CtrlFreaks backend package.

Layout:
  app/config.py      -> reads settings from environment variables (.env)
  app/database.py    -> SQLAlchemy engine, session factory, base class
  app/models/        -> database tables (ORM models)
  app/schemas/       -> Pydantic request/response shapes
  app/routers/       -> HTTP endpoints
  app/services/      -> business logic used by the routers
"""
