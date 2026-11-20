import os
import re

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/employee_analytics",
)
# Render/Heroku-style URLs use postgres:// or postgresql:// — pin the psycopg2 driver.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgresql://"):]

# Optional: keep every table in its own schema, so the app can share a database with
# another app (e.g. cip-db on Render's free plan) without touching that app's tables.
DB_SCHEMA = os.getenv("DB_SCHEMA") or None
if DB_SCHEMA and not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", DB_SCHEMA):
    raise ValueError("DB_SCHEMA must be a lowercase identifier, e.g. employee_analytics")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=2,
    connect_args={"options": f"-csearch_path={DB_SCHEMA}"} if DB_SCHEMA else {},
)


def ensure_schema() -> None:
    if DB_SCHEMA:
        with engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"'))
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
