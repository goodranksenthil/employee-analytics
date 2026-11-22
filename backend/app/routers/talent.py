from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import current_user, require
from ..database import get_db
from ..models import Skill
from ..services import analytics as an
from ..services.matching import extract_requirements, extract_text, rank, score_employee

router = APIRouter(tags=["talent"])

AVAILABLE_THRESHOLD = 50  # an employee with >= 50% free capacity counts as available supply


@router.get("/skills", dependencies=[Depends(current_user)])
def list_skills(db: Session = Depends(get_db)):
    return [
        {"id": s.id, "name": s.name, "category": s.category, "premium_rate": s.premium_rate}
        for s in db.scalars(select(Skill).order_by(Skill.category, Skill.name))
    ]


@router.get("/matching/project/{project_id}", dependencies=[Depends(require("matching:use"))])
def match_project(project_id: int, only_available: bool = False, db: Session = Depends(get_db)):
    project = next((p for p in an.load_projects(db) if p.id == project_id), None)
    if not project:
        raise HTTPException(404, "Project not found")
    reqs = an.requirement_rows(project)
    employees = an.load_employees(db)
    if only_available:
        employees = [e for e in employees if an.utilization(e) < 100]
    return {
        "source": f"{project.code} · {project.name}",
        "requirements": reqs,
        "matches": rank(employees, reqs),
    }


@router.post("/matching/document", dependencies=[Depends(require("matching:use"))])
async def match_document(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    only_available: bool = Form(False),
    db: Session = Depends(get_db),
):
    if file is not None:
        content = extract_text(file.filename or "", await file.read())
        source = file.filename
    elif text:
        content, source = text, "Pasted text"
    else:
        raise HTTPException(400, "Upload a requirement document or paste text")
    reqs = extract_requirements(content, db.scalars(select(Skill)))
    if not reqs:
        return {"source": source, "requirements": [], "matches": [], "message": "No known skills found in document"}
    employees = an.load_employees(db)
    if only_available:
        employees = [e for e in employees if an.utilization(e) < 100]
    return {"source": source, "requirements": reqs, "matches": rank(employees, reqs)}


@router.get("/hiring-needs", dependencies=[Depends(require("hiring:view"))])
def hiring_needs(db: Session = Depends(get_db)):
    """Open positions on Active/Pipeline projects and how many must be hired after using bench supply."""
    employees = an.load_employees(db)
    available = [e for e in employees if 100 - an.utilization(e) >= AVAILABLE_THRESHOLD]

    positions = []
    by_skill = defaultdict(lambda: {"open": 0, "projects": set(), "min_proficiency": 5, "min_experience": 0.0, "roles": set()})
    for p in an.load_projects(db):
        if p.status not in ("Active", "Pipeline"):
            continue
        for r in an.requirement_rows(p):
            if r["open"] <= 0:
                continue
            cands = sorted(
                (score_employee(e, [r]) for e in available if an.has_skill(e, r["skill_id"], r["min_proficiency"])),
                key=lambda s: s["score"],
                reverse=True,
            )
            positions.append(
                {
                    "project_id": p.id,
                    "project": p.name,
                    "code": p.code,
                    "client": p.client,
                    "is_billable": p.is_billable,
                    "status": p.status,
                    **r,
                    "internal_candidates": [
                        {"employee_id": c["employee_id"], "full_name": c["full_name"], "score": c["score"]}
                        for c in cands[:3]
                    ],
                    "to_hire": max(0, r["open"] - len(cands)),
                }
            )
            agg = by_skill[r["skill"]]
            agg["skill_id"] = r["skill_id"]
            agg["open"] += r["open"]
            agg["projects"].add(p.name)
            agg["roles"].add(r["role"])
            agg["min_proficiency"] = min(agg["min_proficiency"], r["min_proficiency"])
            agg["min_experience"] = max(agg["min_experience"], r["min_experience"])

    skills = []
    for name, agg in by_skill.items():
        supply = sum(1 for e in available if an.has_skill(e, agg["skill_id"], agg["min_proficiency"]))
        skills.append(
            {
                "skill": name,
                "open": agg["open"],
                "internal_supply": supply,
                "to_hire": max(0, agg["open"] - supply),
                "roles": sorted(agg["roles"]),
                "min_experience": agg["min_experience"],
                "projects": sorted(agg["projects"]),
            }
        )
    skills.sort(key=lambda s: (s["to_hire"], s["open"]), reverse=True)
    return {
        "total_open": sum(s["open"] for s in skills),
        "total_to_hire": sum(s["to_hire"] for s in skills),
        "positions": positions,
        "skills": skills,
    }
