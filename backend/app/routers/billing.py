from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require
from ..database import get_db
from ..models import RoleRate
from ..schemas import RoleRateIn
from ..services import analytics as an

router = APIRouter(prefix="/billing", tags=["billing"], dependencies=[Depends(require("billing:view"))])


@router.get("/rate-card")
def get_rate_card(db: Session = Depends(get_db)):
    return [
        {
            "role": r.role,
            "base_rate": r.base_rate,
            "per_year_rate": r.per_year_rate,
            "max_rate": r.max_rate,
        }
        for r in db.scalars(select(RoleRate).order_by(RoleRate.base_rate))
    ]


@router.put("/rate-card/{role}", dependencies=[Depends(require("billing:edit"))])
def update_rate(role: str, body: RoleRateIn, db: Session = Depends(get_db)):
    rr = db.scalars(select(RoleRate).where(RoleRate.role == role)).first()
    if not rr:
        raise HTTPException(404, "Role not found")
    rr.base_rate, rr.per_year_rate, rr.max_rate = body.base_rate, body.per_year_rate, body.max_rate
    db.commit()
    return {"role": role, **body.model_dump()}


@router.get("/employees")
def employee_rates(db: Session = Depends(get_db)):
    card = an.rate_card(db)
    rows = []
    for e in an.load_employees(db):
        rate = an.compute_rate(e, card)
        allocs = an.active_allocations(e)
        rows.append(
            {
                "id": e.id,
                "emp_code": e.emp_code,
                "full_name": e.full_name,
                "role": e.role,
                "years_experience": e.years_experience,
                "top_skills": [s["name"] for s in an.skill_list(e)[:3]],
                **{k: rate[k] for k in ("base", "experience", "skill_premium", "hourly_rate", "monthly_full_time", "capped")},
                "billable_pct": sum(a.allocation_pct for a in allocs if a.project.is_billable),
                "monthly_billing": round(sum(an.monthly_billing(a) for a in allocs), 2),
            }
        )
    rows.sort(key=lambda r: r["hourly_rate"], reverse=True)
    return rows


@router.get("/projects")
def project_billing(db: Session = Depends(get_db)):
    rows = []
    for p in an.load_projects(db):
        team = [a for a in p.allocations if an.is_active(a)]
        if not team:
            continue
        revenue = sum(an.monthly_billing(a) for a in team)
        billable_hours = sum(an.HOURS_PER_MONTH * a.allocation_pct / 100 for a in team if p.is_billable)
        rows.append(
            {
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "client": p.client,
                "is_billable": p.is_billable,
                "team_size": len(team),
                "billable_hours": round(billable_hours),
                "blended_rate": round(revenue / billable_hours, 2) if billable_hours else 0,
                "monthly_revenue": round(revenue, 2),
            }
        )
    rows.sort(key=lambda r: r["monthly_revenue"], reverse=True)
    return rows
