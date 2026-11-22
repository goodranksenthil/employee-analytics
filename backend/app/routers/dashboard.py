from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require, scrub
from ..database import get_db
from ..models import User
from ..services import analytics as an

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(db: Session = Depends(get_db), user: User = Depends(require("dashboard:view"))):
    return scrub(_summary(db), user)


def _summary(db: Session):
    card = an.rate_card(db)
    projects = [an.project_summary(p) for p in an.load_projects(db)]
    employees = [an.employee_summary(e, card) for e in an.load_employees(db)]

    bench = [e for e in employees if e["status"] == "Bench"]
    bench_skills = Counter(s["name"] for e in bench for s in e["skills"] if s["proficiency"] >= 3)
    total_capacity = len(employees) * 100 or 1

    return {
        "projects": {
            "total": len(projects),
            "billable": sum(p["is_billable"] for p in projects),
            "non_billable": sum(not p["is_billable"] for p in projects),
            "active": sum(p["status"] == "Active" for p in projects),
            "by_status": dict(Counter(p["status"] for p in projects)),
            "open_positions": sum(p["open_positions"] for p in projects),
        },
        "resources": {
            "total": len(employees),
            "allocated": sum(e["status"] != "Bench" for e in employees),
            "fully_allocated": sum(e["status"] == "Fully Allocated" for e in employees),
            "partial": sum(e["status"] == "Partially Allocated" for e in employees),
            "bench": len(bench),
            "billable": sum(e["is_billable"] for e in employees),
            "utilization_pct": round(
                sum(min(e["utilization"], 100) for e in employees) * 100 / total_capacity, 1
            ),
            "by_role": dict(Counter(e["role"] for e in employees)),
        },
        "billing": {
            "monthly_revenue": round(sum(p["monthly_revenue"] for p in projects), 2),
            "annual_run_rate": round(sum(p["monthly_revenue"] for p in projects) * 12, 2),
            "avg_hourly_rate": round(
                sum(e["hourly_rate"] for e in employees) / max(len(employees), 1), 2
            ),
            "by_project": sorted(
                (
                    {"name": p["name"], "code": p["code"], "revenue": p["monthly_revenue"]}
                    for p in projects
                    if p["monthly_revenue"] > 0
                ),
                key=lambda x: x["revenue"],
                reverse=True,
            ),
        },
        "bench_by_skill": [{"skill": k, "count": v} for k, v in bench_skills.most_common(10)],
        "recent_bench": bench[:6],
    }
