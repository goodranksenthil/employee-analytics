import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from .database import Base, SessionLocal, engine, ensure_schema
from .models import Employee
from .routers import auth, billing, dashboard, employees, pipeline, positions, projects, talent


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_schema()
    Base.metadata.create_all(bind=engine)
    # Demo deploys: load sample data and the 4 demo logins into an empty database (never overwrites).
    if os.getenv("SEED_DEMO_DATA", "false").lower() == "true":
        from .seed import ensure_demo_users, run

        with SessionLocal() as db:
            empty = db.scalar(select(func.count()).select_from(Employee)) == 0
        if empty:
            run(reset=False)
        with SessionLocal() as db:
            ensure_demo_users(db)
    yield


app = FastAPI(title="Employee Analytics API", version="1.1.0", lifespan=lifespan)

origins = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX") or None,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, dashboard.router, projects.router, pipeline.router, employees.router, talent.router, billing.router, positions.router):
    app.include_router(r, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
