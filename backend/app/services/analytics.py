"""Core calculations: utilization, bench status, bill rates, project staffing."""
from datetime import date
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Allocation, Employee, EmployeeSkill, Project, ProjectRequirement, RoleRate

HOURS_PER_MONTH = 160
MAX_EXPERIENCE_YEARS = 20  # experience component stops growing after this
TOP_SKILL_PREMIUMS = 3  # only the best N skill premiums count toward the rate


# ---------- loading ----------

def load_employees(db: Session) -> List[Employee]:
    stmt = (
        select(Employee)
        .where(Employee.is_active.is_(True))
        .options(
            selectinload(Employee.skills).selectinload(EmployeeSkill.skill),
            selectinload(Employee.allocations).selectinload(Allocation.project),
        )
        .order_by(Employee.full_name)
    )
    return list(db.scalars(stmt))


def load_employee(db: Session, employee_id: int) -> Optional[Employee]:
    stmt = (
        select(Employee)
        .where(Employee.id == employee_id)
        .options(
            selectinload(Employee.skills).selectinload(EmployeeSkill.skill),
            selectinload(Employee.allocations).selectinload(Allocation.project),
        )
    )
    return db.scalars(stmt).first()


def load_projects(db: Session) -> List[Project]:
    stmt = (
        select(Project)
        .options(
            selectinload(Project.requirements).selectinload(ProjectRequirement.skill),
            selectinload(Project.allocations)
            .selectinload(Allocation.employee)
            .selectinload(Employee.skills)
            .selectinload(EmployeeSkill.skill),
        )
        .order_by(Project.code)
    )
    return list(db.scalars(stmt))


def rate_card(db: Session) -> Dict[str, RoleRate]:
    return {r.role: r for r in db.scalars(select(RoleRate))}


# ---------- allocation / utilization ----------

def is_active(a: Allocation, today: Optional[date] = None) -> bool:
    today = today or date.today()
    return a.start_date <= today and (a.end_date is None or a.end_date >= today)


def active_allocations(emp: Employee) -> List[Allocation]:
    return [a for a in emp.allocations if is_active(a)]


def utilization(emp: Employee) -> int:
    return sum(a.allocation_pct for a in active_allocations(emp))


def status_of(util: int) -> str:
    if util <= 0:
        return "Bench"
    if util < 100:
        return "Partially Allocated"
    return "Fully Allocated"


def monthly_billing(a: Allocation) -> float:
    if not a.project.is_billable:
        return 0.0
    return round(a.bill_rate * HOURS_PER_MONTH * a.allocation_pct / 100, 2)


# ---------- billing ----------

def compute_rate(emp: Employee, card: Dict[str, RoleRate]) -> dict:
    """Hourly USD rate = role base + per-year * experience + top skill premiums (scaled by proficiency)."""
    rc = card.get(emp.role)
    base = rc.base_rate if rc else 30.0
    per_year = rc.per_year_rate if rc else 2.0
    experience = per_year * min(emp.years_experience, MAX_EXPERIENCE_YEARS)
    premiums = sorted(
        (
            {"skill": es.skill.name, "amount": round(es.skill.premium_rate * es.proficiency / 5, 2)}
            for es in emp.skills
            if es.skill.premium_rate > 0
        ),
        key=lambda p: p["amount"],
        reverse=True,
    )[:TOP_SKILL_PREMIUMS]
    skills = sum(p["amount"] for p in premiums)
    rate = base + experience + skills
    capped = False
    if rc and rc.max_rate and rate > rc.max_rate:
        rate, capped = rc.max_rate, True
    return {
        "role": emp.role,
        "base": round(base, 2),
        "experience": round(experience, 2),
        "skill_premium": round(skills, 2),
        "skill_premiums": premiums,
        "capped": capped,
        "hourly_rate": round(rate),
        "monthly_full_time": round(rate) * HOURS_PER_MONTH,
    }


# ---------- serializers ----------

def skill_list(emp: Employee) -> List[dict]:
    return sorted(
        (
            {
                "skill_id": es.skill_id,
                "name": es.skill.name,
                "category": es.skill.category,
                "proficiency": es.proficiency,
                "years": es.years,
            }
            for es in emp.skills
        ),
        key=lambda s: (-s["proficiency"], s["name"]),
    )


def employee_summary(emp: Employee, card: Dict[str, RoleRate]) -> dict:
    allocs = active_allocations(emp)
    util = sum(a.allocation_pct for a in allocs)
    return {
        "id": emp.id,
        "emp_code": emp.emp_code,
        "full_name": emp.full_name,
        "email": emp.email,
        "role": emp.role,
        "years_experience": emp.years_experience,
        "location": emp.location,
        "utilization": util,
        "available_pct": max(0, 100 - util),
        "status": status_of(util),
        "is_billable": any(a.project.is_billable for a in allocs),
        "skills": [{"name": s["name"], "proficiency": s["proficiency"]} for s in skill_list(emp)],
        "projects": [
            {
                "id": a.project.id,
                "name": a.project.name,
                "is_billable": a.project.is_billable,
                "allocation_pct": a.allocation_pct,
            }
            for a in allocs
        ],
        "hourly_rate": compute_rate(emp, card)["hourly_rate"],
        "monthly_billing": round(sum(monthly_billing(a) for a in allocs), 2),
    }


def has_skill(emp: Employee, skill_id: int, min_prof: int) -> bool:
    return any(es.skill_id == skill_id and es.proficiency >= min_prof for es in emp.skills)


def requirement_rows(project: Project) -> List[dict]:
    team = [a.employee for a in project.allocations if is_active(a)]
    rows = []
    for r in project.requirements:
        filled = min(sum(1 for e in team if has_skill(e, r.skill_id, r.min_proficiency)), r.headcount)
        rows.append(
            {
                "id": r.id,
                "skill_id": r.skill_id,
                "skill": r.skill.name,
                "category": r.skill.category,
                "role": r.role,
                "headcount": r.headcount,
                "min_proficiency": r.min_proficiency,
                "min_experience": r.min_experience,
                "filled": filled,
                "open": r.headcount - filled,
            }
        )
    return rows


def project_summary(p: Project) -> dict:
    team = [a for a in p.allocations if is_active(a)]
    reqs = requirement_rows(p)
    return {
        "id": p.id,
        "code": p.code,
        "name": p.name,
        "client": p.client,
        "is_billable": p.is_billable,
        "status": p.status,
        "start_date": p.start_date.isoformat(),
        "end_date": p.end_date.isoformat() if p.end_date else None,
        "team_size": len(team),
        "required_headcount": sum(r["headcount"] for r in reqs),
        "open_positions": sum(r["open"] for r in reqs) if p.status in ("Active", "Pipeline") else 0,
        "monthly_revenue": round(sum(monthly_billing(a) for a in team), 2),
        "skills": sorted({r["skill"] for r in reqs}),
    }
