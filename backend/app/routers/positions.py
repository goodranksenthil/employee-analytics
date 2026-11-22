"""Open positions for employees to browse and apply to; application review for Delivery Managers and HR."""
from collections import Counter
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..auth import require
from ..database import get_db
from ..models import Application, Employee, EmployeeSkill, ProjectRequirement, User
from ..services import analytics as an
from ..services.matching import score_employee

router = APIRouter(tags=["positions"])

OPEN_STATUSES = ("Active", "Pipeline")
REVIEW_STATUSES = ("Applied", "Shortlisted", "Selected", "Rejected")


class ApplyIn(BaseModel):
    note: str = Field("", max_length=1000)


class ReviewIn(BaseModel):
    status: str


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _own_employee(db: Session, user: User) -> Employee:
    emp = an.load_employee(db, user.employee_id) if user.employee_id else None
    if not emp:
        raise HTTPException(400, "This login is not linked to an employee record")
    return emp


def _open_positions(db: Session):
    """(project, requirement row dict) for every unfilled requirement on Active/Pipeline projects."""
    for p in an.load_projects(db):
        if p.status not in OPEN_STATUSES:
            continue
        stack = sorted({r.skill.name for r in p.requirements})
        for r in an.requirement_rows(p):
            if r["open"] > 0:
                yield p, r, stack


@router.get("/positions")
def list_positions(db: Session = Depends(get_db), user: User = Depends(require("positions:view"))):
    emp = _own_employee(db, user)
    mine = {a.requirement_id: a for a in db.scalars(select(Application).where(Application.employee_id == emp.id))}
    applicants = Counter(db.scalars(select(Application.requirement_id)))
    my_skills = {es.skill_id: es.proficiency for es in emp.skills}

    items = []
    for p, r, stack in _open_positions(db):
        fit = score_employee(emp, [r])
        my_level = my_skills.get(r["skill_id"])
        app = mine.get(r["id"])
        items.append({
            "requirement_id": r["id"],
            "project": {
                "id": p.id, "code": p.code, "name": p.name, "client": p.client, "status": p.status,
                "start_date": p.start_date.isoformat(), "description": p.description,
                "is_billable": p.is_billable, "technologies": stack,
            },
            "skill": r["skill"],
            "category": r["category"],
            "role": r["role"],
            "openings": r["open"],
            "headcount": r["headcount"],
            "min_proficiency": r["min_proficiency"],
            "min_experience": r["min_experience"],
            "applicants": applicants.get(r["id"], 0),
            "fit": {
                "score": fit["score"],
                "my_level": my_level,
                "meets_level": bool(my_level and my_level >= r["min_proficiency"]),
                "meets_experience": emp.years_experience >= r["min_experience"],
            },
            "my_application": {"id": app.id, "status": app.status, "applied_at": app.created_at.isoformat()} if app else None,
        })
    items.sort(key=lambda i: (i["my_application"] is None, -i["fit"]["score"], i["project"]["start_date"]))
    return {
        "employee": {"id": emp.id, "full_name": emp.full_name, "role": emp.role,
                     "years_experience": emp.years_experience, "available_pct": max(0, 100 - an.utilization(emp))},
        "positions": items,
    }


@router.post("/positions/{requirement_id}/apply", status_code=201)
def apply(requirement_id: int, body: ApplyIn, db: Session = Depends(get_db), user: User = Depends(require("positions:apply"))):
    emp = _own_employee(db, user)
    match = next(((p, r) for p, r, _ in _open_positions(db) if r["id"] == requirement_id), None)
    if not match:
        raise HTTPException(404, "This position is no longer open")
    exists = db.scalars(select(Application).where(
        Application.employee_id == emp.id, Application.requirement_id == requirement_id)).first()
    if exists:
        raise HTTPException(409, f"You already applied for this position (status: {exists.status})")
    now = _now()
    app = Application(employee_id=emp.id, requirement_id=requirement_id, note=body.note.strip(),
                      status="Applied", created_at=now, updated_at=now)
    db.add(app)
    db.commit()
    return {"id": app.id, "status": app.status}


@router.delete("/applications/{application_id}")
def withdraw(application_id: int, db: Session = Depends(get_db), user: User = Depends(require("positions:apply"))):
    app = db.get(Application, application_id)
    if not app or app.employee_id != user.employee_id:
        raise HTTPException(404, "Application not found")
    if app.status not in ("Applied", "Shortlisted"):
        raise HTTPException(400, f"An application that is {app.status.lower()} can't be withdrawn")
    db.delete(app)
    db.commit()
    return {"withdrawn": application_id}


@router.get("/applications")
def list_applications(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require("applications:review")),
):
    stmt = (
        select(Application)
        .options(
            selectinload(Application.employee).selectinload(Employee.skills).selectinload(EmployeeSkill.skill),
            selectinload(Application.employee).selectinload(Employee.allocations),
            selectinload(Application.requirement).selectinload(ProjectRequirement.project),
            selectinload(Application.requirement).selectinload(ProjectRequirement.skill),
        )
        .order_by(Application.created_at.desc())
    )
    if status:
        stmt = stmt.where(Application.status == status)
    rows = []
    for a in db.scalars(stmt):
        e, r = a.employee, a.requirement
        level = next((es.proficiency for es in e.skills if es.skill_id == r.skill_id), None)
        fit = score_employee(e, [{"skill_id": r.skill_id, "skill": r.skill.name,
                                  "min_proficiency": r.min_proficiency, "min_experience": r.min_experience}])
        rows.append({
            "id": a.id,
            "status": a.status,
            "note": a.note,
            "applied_at": a.created_at.isoformat(),
            "updated_at": a.updated_at.isoformat(),
            "reviewed_by": a.reviewed_by,
            "employee": {"id": e.id, "emp_code": e.emp_code, "full_name": e.full_name, "role": e.role,
                         "years_experience": e.years_experience, "available_pct": max(0, 100 - an.utilization(e))},
            "position": {"requirement_id": r.id, "skill": r.skill.name, "role": r.role,
                         "min_proficiency": r.min_proficiency, "min_experience": r.min_experience,
                         "project_id": r.project.id, "project": r.project.name, "code": r.project.code,
                         "client": r.project.client, "project_status": r.project.status},
            "fit": {"score": fit["score"], "level": level},
        })
    return {"applications": rows, "counts": dict(Counter(r["status"] for r in rows))}


@router.patch("/applications/{application_id}")
def review(application_id: int, body: ReviewIn, db: Session = Depends(get_db), user: User = Depends(require("applications:review"))):
    if body.status not in REVIEW_STATUSES:
        raise HTTPException(400, f"Status must be one of {', '.join(REVIEW_STATUSES)}")
    app = db.get(Application, application_id)
    if not app:
        raise HTTPException(404, "Application not found")
    app.status = body.status
    app.updated_at = _now()
    app.reviewed_by = user.full_name
    db.commit()
    return {"id": app.id, "status": app.status}
