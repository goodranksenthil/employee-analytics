"""Upcoming (pipeline) projects: required technologies, estimated billing and staffing readiness."""
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require
from ..database import get_db
from ..services import analytics as an
from ..services.matching import score_employee

router = APIRouter(prefix="/pipeline", tags=["pipeline"], dependencies=[Depends(require("pipeline:view"))])

AVAILABLE_THRESHOLD = 50
FORECAST_MONTHS = 12


def add_months(d: date, n: int) -> date:
    m = d.month - 1 + n
    return date(d.year + m // 12, m % 12 + 1, 1)


def estimate_rate(req, card) -> float:
    """Hourly rate for a requirement, priced like an employee at the minimum experience and proficiency."""
    rc = card.get(req.role)
    base = rc.base_rate if rc else 30.0
    per_year = rc.per_year_rate if rc else 2.0
    rate = base + per_year * min(req.min_experience, an.MAX_EXPERIENCE_YEARS)
    rate += req.skill.premium_rate * req.min_proficiency / 5
    if rc and rc.max_rate:
        rate = min(rate, rc.max_rate)
    return round(rate)


@router.get("")
def pipeline(db: Session = Depends(get_db)):
    card = an.rate_card(db)
    employees = an.load_employees(db)
    available = [e for e in employees if 100 - an.utilization(e) >= AVAILABLE_THRESHOLD]
    projects = [p for p in an.load_projects(db) if p.status == "Pipeline"]
    projects.sort(key=lambda p: p.start_date)

    items = []
    tech = defaultdict(lambda: {"headcount": 0, "projects": set(), "internal_available": 0, "category": ""})
    for p in projects:
        reqs = []
        for r in p.requirements:
            rate = estimate_rate(r, card) if p.is_billable else 0
            monthly = rate * an.HOURS_PER_MONTH * r.headcount
            req_dict = {"skill_id": r.skill_id, "skill": r.skill.name, "min_proficiency": r.min_proficiency,
                        "min_experience": r.min_experience}
            cands = sorted(
                (
                    score_employee(e, [req_dict])
                    for e in available
                    if an.has_skill(e, r.skill_id, r.min_proficiency) and e.years_experience >= r.min_experience
                ),
                key=lambda s: s["score"],
                reverse=True,
            )
            to_hire = max(0, r.headcount - len(cands))
            reqs.append({
                "skill": r.skill.name,
                "category": r.skill.category,
                "role": r.role,
                "headcount": r.headcount,
                "min_proficiency": r.min_proficiency,
                "min_experience": r.min_experience,
                "est_rate": rate,
                "monthly_billing": monthly,
                "internal_available": len(cands),
                "to_hire": to_hire,
                "candidates": [
                    {"employee_id": c["employee_id"], "full_name": c["full_name"], "role": c["role"],
                     "available_pct": c["available_pct"]}
                    for c in cands[:3]
                ],
            })
            t = tech[r.skill.name]
            t["headcount"] += r.headcount
            t["projects"].add(p.name)
            t["category"] = r.skill.category
            t["internal_available"] = max(t["internal_available"], len(cands))

        headcount = sum(r["headcount"] for r in reqs)
        monthly = sum(r["monthly_billing"] for r in reqs)
        duration = p.duration_months or 12
        to_hire = sum(r["to_hire"] for r in reqs)
        items.append({
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "client": p.client,
            "description": p.description,
            "is_billable": p.is_billable,
            "start_date": p.start_date.isoformat(),
            "days_to_start": (p.start_date - date.today()).days,
            "duration_months": duration,
            "end_date": add_months(p.start_date, duration).isoformat(),
            "probability": p.probability,
            "headcount": headcount,
            "monthly_billing": monthly,
            "contract_value": monthly * duration,
            "weighted_value": round(monthly * duration * p.probability / 100),
            "blended_rate": round(monthly / (headcount * an.HOURS_PER_MONTH), 2) if headcount and monthly else 0,
            "to_hire": to_hire,
            "readiness_pct": round((headcount - to_hire) * 100 / headcount) if headcount else 100,
            "technologies": sorted({r["skill"] for r in reqs}),
            "requirements": reqs,
        })

    # Probability-weighted billing forecast for the next 12 months.
    first = date.today().replace(day=1)
    forecast = []
    for i in range(FORECAST_MONTHS):
        m = add_months(first, i)
        row = {"month": m.strftime("%b %Y"), "weighted": 0.0, "full": 0.0}
        for it in items:
            start = date.fromisoformat(it["start_date"]).replace(day=1)
            if start <= m < add_months(start, it["duration_months"]):
                row["full"] += it["monthly_billing"]
                row["weighted"] += it["monthly_billing"] * it["probability"] / 100
        row["weighted"] = round(row["weighted"])
        forecast.append(row)

    technologies = sorted(
        (
            {"skill": k, "category": v["category"], "headcount": v["headcount"],
             "internal_available": v["internal_available"], "to_hire": max(0, v["headcount"] - v["internal_available"]),
             "projects": sorted(v["projects"])}
            for k, v in tech.items()
        ),
        key=lambda t: t["headcount"],
        reverse=True,
    )

    return {
        "summary": {
            "count": len(items),
            "headcount": sum(i["headcount"] for i in items),
            "monthly_billing": sum(i["monthly_billing"] for i in items),
            "contract_value": sum(i["contract_value"] for i in items),
            "weighted_value": sum(i["weighted_value"] for i in items),
            "to_hire": sum(i["to_hire"] for i in items),
            "next_start": items[0]["start_date"] if items else None,
        },
        "projects": items,
        "technologies": technologies,
        "forecast": forecast,
    }
