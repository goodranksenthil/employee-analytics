from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Allocation, Project
from ..schemas import AllocationIn
from ..services import analytics as an
from ..services.matching import score_employee

router = APIRouter(tags=["resources"])


@router.get("/employees")
def list_employees(
    status: Optional[str] = None,  # bench | allocated | partial | full
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    card = an.rate_card(db)
    items = [an.employee_summary(e, card) for e in an.load_employees(db)]
    status_map = {
        "bench": {"Bench"},
        "allocated": {"Partially Allocated", "Fully Allocated"},
        "partial": {"Partially Allocated"},
        "full": {"Fully Allocated"},
    }
    if status in status_map:
        items = [e for e in items if e["status"] in status_map[status]]
    if search:
        q = search.lower()
        items = [
            e
            for e in items
            if q in e["full_name"].lower()
            or q in e["emp_code"].lower()
            or q in e["role"].lower()
            or any(q in s["name"].lower() for s in e["skills"])
        ]
    return items


@router.get("/employees/{employee_id}")
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = an.load_employee(db, employee_id)
    if not emp:
        raise HTTPException(404, "Employee not found")
    card = an.rate_card(db)
    allocations = sorted(emp.allocations, key=lambda a: a.start_date, reverse=True)

    # Best-fit projects that still have open positions.
    fits = []
    current = {a.project_id for a in an.active_allocations(emp)}
    for p in an.load_projects(db):
        if p.id in current or p.status not in ("Active", "Pipeline"):
            continue
        open_reqs = [r for r in an.requirement_rows(p) if r["open"] > 0]
        if not open_reqs:
            continue
        s = score_employee(emp, open_reqs)
        if s["matched"]:
            fits.append(
                {
                    "project_id": p.id,
                    "code": p.code,
                    "name": p.name,
                    "is_billable": p.is_billable,
                    "status": p.status,
                    "score": s["score"],
                    "matched": s["matched"],
                    "missing": s["missing"],
                }
            )
    fits.sort(key=lambda f: f["score"], reverse=True)

    return {
        **an.employee_summary(emp, card),
        "join_date": emp.join_date.isoformat(),
        "skills_detail": an.skill_list(emp),
        "rate": an.compute_rate(emp, card),
        "allocations": [
            {
                "id": a.id,
                "project_id": a.project.id,
                "code": a.project.code,
                "name": a.project.name,
                "client": a.project.client,
                "is_billable": a.project.is_billable,
                "allocation_pct": a.allocation_pct,
                "bill_rate": a.bill_rate,
                "monthly_billing": an.monthly_billing(a),
                "start_date": a.start_date.isoformat(),
                "end_date": a.end_date.isoformat() if a.end_date else None,
                "active": an.is_active(a),
            }
            for a in allocations
        ],
        "best_fit_projects": fits[:5],
    }


@router.get("/bench")
def bench(db: Session = Depends(get_db)):
    card = an.rate_card(db)
    projects = [p for p in an.load_projects(db) if p.status in ("Active", "Pipeline")]
    open_by_project = {p.id: [r for r in an.requirement_rows(p) if r["open"] > 0] for p in projects}
    result = []
    for e in an.load_employees(db):
        if an.utilization(e) > 0:
            continue
        summary = an.employee_summary(e, card)
        best = None
        for p in projects:
            reqs = open_by_project[p.id]
            if not reqs:
                continue
            s = score_employee(e, reqs)
            if s["matched"] and (best is None or s["score"] > best["score"]):
                best = {"project_id": p.id, "name": p.name, "score": s["score"]}
        last_end = max((a.end_date for a in e.allocations if a.end_date), default=None)
        summary["bench_since"] = (last_end or e.join_date).isoformat()
        summary["bench_days"] = (date.today() - (last_end or e.join_date)).days
        summary["best_match"] = best
        result.append(summary)
    result.sort(key=lambda x: x["bench_days"], reverse=True)
    return result


@router.post("/allocations", status_code=201)
def create_allocation(body: AllocationIn, db: Session = Depends(get_db)):
    emp = an.load_employee(db, body.employee_id)
    project = db.get(Project, body.project_id)
    if not emp or not project:
        raise HTTPException(404, "Employee or project not found")
    if any(a.project_id == project.id for a in an.active_allocations(emp)):
        raise HTTPException(400, "Employee is already allocated to this project")
    if an.utilization(emp) + body.allocation_pct > 100:
        raise HTTPException(
            400, f"Over-allocation: employee is already {an.utilization(emp)}% allocated"
        )
    rate = body.bill_rate
    if rate is None:
        rate = an.compute_rate(emp, an.rate_card(db))["hourly_rate"] if project.is_billable else 0
    alloc = Allocation(
        employee_id=emp.id,
        project_id=project.id,
        allocation_pct=body.allocation_pct,
        bill_rate=rate,
        start_date=body.start_date or date.today(),
    )
    db.add(alloc)
    db.commit()
    return {"id": alloc.id, "bill_rate": rate}


@router.delete("/allocations/{allocation_id}")
def release_allocation(allocation_id: int, db: Session = Depends(get_db)):
    alloc = db.get(Allocation, allocation_id)
    if not alloc:
        raise HTTPException(404, "Allocation not found")
    # Keep history: end it yesterday so the employee is free from today.
    alloc.end_date = max(alloc.start_date, date.today() - timedelta(days=1))
    if alloc.end_date >= date.today():
        db.delete(alloc)
    db.commit()
    return {"released": allocation_id}
