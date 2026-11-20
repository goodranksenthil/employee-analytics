from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..services import analytics as an
from ..services.matching import rank

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def list_projects(
    billable: Optional[bool] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    items = [an.project_summary(p) for p in an.load_projects(db)]
    if billable is not None:
        items = [p for p in items if p["is_billable"] == billable]
    if status:
        items = [p for p in items if p["status"].lower() == status.lower()]
    return items


@router.get("/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = next((p for p in an.load_projects(db) if p.id == project_id), None)
    if not project:
        raise HTTPException(404, "Project not found")
    team = [
        {
            "allocation_id": a.id,
            "employee_id": a.employee.id,
            "emp_code": a.employee.emp_code,
            "full_name": a.employee.full_name,
            "role": a.employee.role,
            "years_experience": a.employee.years_experience,
            "allocation_pct": a.allocation_pct,
            "bill_rate": a.bill_rate,
            "monthly_billing": an.monthly_billing(a),
            "start_date": a.start_date.isoformat(),
        }
        for a in project.allocations
        if an.is_active(a)
    ]
    reqs = an.requirement_rows(project)
    open_reqs = [r for r in reqs if r["open"] > 0] or reqs
    team_ids = {t["employee_id"] for t in team}
    candidates = rank(
        (e for e in an.load_employees(db) if e.id not in team_ids and an.utilization(e) < 100),
        open_reqs,
        limit=8,
    )
    return {
        **an.project_summary(project),
        "description": project.description,
        "requirements": reqs,
        "team": team,
        "candidates": candidates,
    }
