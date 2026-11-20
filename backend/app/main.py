import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from .database import Base, SessionLocal, engine
from .models import Employee
from .routers import billing, dashboard, employees, pipeline, projects, talent


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Cloud deploys: load sample data into an empty database on first start (never overwrites).
    if os.getenv("SEED_DEMO_DATA", "false").lower() == "true":
        with SessionLocal() as db:
            empty = db.scalar(select(func.count()).select_from(Employee)) == 0
        if empty:
            from .seed import run

            run(reset=False)
    yield


app = FastAPI(title="Employee Analytics API", version="1.0.0", lifespan=lifespan)

origins = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX") or None,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (dashboard.router, projects.router, pipeline.router, employees.router, talent.router, billing.router):
    app.include_router(r, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
