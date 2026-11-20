"""Skill matching between employees and project requirements / requirement documents."""
import io
import re
from typing import Iterable, List

from ..models import Employee, Skill
from .analytics import status_of, utilization


def score_employee(emp: Employee, reqs: List[dict]) -> dict:
    """reqs: [{skill_id, skill, min_proficiency, min_experience}]. Score 0-100 (80% skills, 20% experience)."""
    by_skill = {es.skill_id: es for es in emp.skills}
    matched, missing, coverage = [], [], []
    for r in reqs:
        es = by_skill.get(r["skill_id"])
        if es:
            coverage.append(min(es.proficiency / max(r["min_proficiency"], 1), 1.0))
            matched.append(
                {"skill": r["skill"], "proficiency": es.proficiency, "required": r["min_proficiency"]}
            )
        else:
            coverage.append(0.0)
            missing.append(r["skill"])
    min_exp = max((r["min_experience"] for r in reqs), default=0)
    exp_score = 1.0 if min_exp <= 0 else min(emp.years_experience / min_exp, 1.0)
    skill_score = sum(coverage) / len(coverage) if coverage else 0.0
    util = utilization(emp)
    return {
        "employee_id": emp.id,
        "emp_code": emp.emp_code,
        "full_name": emp.full_name,
        "role": emp.role,
        "years_experience": emp.years_experience,
        "status": status_of(util),
        "available_pct": max(0, 100 - util),
        "score": round(skill_score * 80 + exp_score * 20, 1),
        "matched": matched,
        "missing": missing,
    }


def rank(employees: Iterable[Employee], reqs: List[dict], limit: int = 25) -> List[dict]:
    results = [score_employee(e, reqs) for e in employees]
    results = [r for r in results if r["matched"]]
    results.sort(key=lambda r: (r["score"], r["available_pct"]), reverse=True)
    return results[:limit]


def extract_text(filename: str, data: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    if name.endswith(".docx"):
        import docx

        document = docx.Document(io.BytesIO(data))
        return "\n".join(p.text for p in document.paragraphs)
    return data.decode("utf-8", errors="ignore")


def extract_requirements(text: str, skills: Iterable[Skill]) -> List[dict]:
    """Find known skill names in free text; pick up 'N+ years' as the minimum experience."""
    years = [int(y) for y in re.findall(r"(\d{1,2})\s*\+?\s*(?:years|yrs)", text, re.I)]
    min_exp = float(max(years)) if years else 0.0
    found = []
    for s in skills:
        pattern = r"(?<![A-Za-z0-9])" + re.escape(s.name) + r"(?![A-Za-z0-9#+])"
        if re.search(pattern, text, re.I):
            found.append(
                {"skill_id": s.id, "skill": s.name, "min_proficiency": 3, "min_experience": min_exp}
            )
    return found
