"""Reset the database and load sample data.  Run:  python -m app.seed"""
import random
from datetime import date, timedelta

from .database import Base, SessionLocal, engine, ensure_schema
from .auth import hash_password
from .models import Allocation, Employee, EmployeeSkill, Project, ProjectRequirement, RoleRate, Skill, User
from .services.analytics import compute_rate

rng = random.Random(42)
TODAY = date.today()

# name, category, premium $/hr at proficiency 5
SKILLS = [
    ("React", "Frontend", 6), ("TypeScript", "Frontend", 4), ("Angular", "Frontend", 4),
    ("Vue.js", "Frontend", 3), ("JavaScript", "Frontend", 2), ("HTML/CSS", "Frontend", 0),
    ("Python", "Backend", 4), ("FastAPI", "Backend", 4), ("Django", "Backend", 3),
    ("Java", "Backend", 4), ("Spring Boot", "Backend", 5), ("Node.js", "Backend", 4),
    ("C#", "Backend", 3), (".NET", "Backend", 4), ("Golang", "Backend", 6),
    ("PostgreSQL", "Data", 3), ("MongoDB", "Data", 3), ("SQL", "Data", 1),
    ("Spark", "Data", 7), ("Snowflake", "Data", 7), ("Power BI", "Data", 4),
    ("Machine Learning", "Data", 9),
    ("AWS", "Cloud & DevOps", 7), ("Azure", "Cloud & DevOps", 6), ("GCP", "Cloud & DevOps", 6),
    ("Docker", "Cloud & DevOps", 3), ("Kubernetes", "Cloud & DevOps", 7), ("Terraform", "Cloud & DevOps", 6),
    ("Selenium", "Quality", 2), ("Cypress", "Quality", 3), ("Manual Testing", "Quality", 0),
    ("Agile", "Delivery", 1), ("Figma", "Design", 3), ("Salesforce", "Enterprise", 8), ("SAP", "Enterprise", 9),
]

# role, base $/hr, $/hr per year of experience, cap
RATE_CARD = [
    ("Associate Engineer", 25, 2.0, 40), ("Software Engineer", 35, 3.0, 65),
    ("Senior Software Engineer", 50, 3.5, 95), ("Tech Lead", 65, 4.0, 120),
    ("Architect", 85, 4.5, 160), ("QA Engineer", 28, 2.5, 70), ("DevOps Engineer", 45, 3.5, 110),
    ("Data Engineer", 48, 3.5, 115), ("Business Analyst", 40, 3.0, 90),
    ("Project Manager", 70, 4.0, 140), ("UI/UX Designer", 38, 3.0, 90),
]

TRACKS = {
    "frontend": (["React", "TypeScript", "JavaScript", "HTML/CSS", "Angular", "Vue.js", "Cypress"], 9),
    "backend_java": (["Java", "Spring Boot", "PostgreSQL", "SQL", "Docker", "Kubernetes"], 7),
    "backend_py": (["Python", "FastAPI", "Django", "PostgreSQL", "Docker", "AWS"], 7),
    "backend_net": (["C#", ".NET", "Azure", "SQL", "Angular"], 5),
    "fullstack": (["React", "Node.js", "TypeScript", "MongoDB", "AWS", "Golang"], 6),
    "data": (["Python", "Spark", "Snowflake", "SQL", "Power BI", "Machine Learning", "Azure"], 7),
    "devops": (["AWS", "Kubernetes", "Terraform", "Docker", "Azure", "GCP"], 5),
    "qa": (["Selenium", "Cypress", "Manual Testing", "Java", "Agile"], 6),
    "ba": (["Agile", "SQL", "Power BI", "Salesforce"], 3),
    "pm": (["Agile", "Power BI"], 3),
    "design": (["Figma", "HTML/CSS", "React"], 2),
    "enterprise": (["Salesforce", "SAP", "Java", "SQL"], 2),
}

FIRST = ["Aarav", "Priya", "Liam", "Sofia", "Noah", "Ananya", "Ethan", "Meera", "Lucas", "Divya",
         "Mason", "Kavya", "Oliver", "Isha", "James", "Fatima", "Daniel", "Chen", "Arjun", "Emma",
         "Ravi", "Olivia", "Karthik", "Mia", "Vikram", "Grace", "Rahul", "Hannah", "Suresh", "Zara",
         "Deepak", "Nina", "Ajay", "Leah", "Sanjay", "Ava"]
LAST = ["Sharma", "Kumar", "Patel", "Nguyen", "Garcia", "Iyer", "Smith", "Reddy", "Khan", "Lee",
        "Menon", "Brown", "Nair", "Wilson", "Rao", "Martin", "Das", "Lopez", "Pillai", "Clark"]
LOCATIONS = ["Chennai", "Bengaluru", "Hyderabad", "Pune", "Dallas", "London", "Remote"]

# code, name, client, billable, status, months ago started, description, [(skill, role, headcount, min_prof, min_exp)]
PROJECTS = [
    ("PRJ-1001", "Retail Commerce Replatform", "Northwind Retail", True, "Active", 10,
     "Rebuild the e-commerce storefront as a headless React app on AWS.",
     [("React", "Senior Software Engineer", 3, 4, 4), ("TypeScript", "Software Engineer", 2, 3, 2),
      ("Node.js", "Software Engineer", 2, 3, 3), ("AWS", "DevOps Engineer", 1, 3, 4), ("Cypress", "QA Engineer", 1, 3, 2)]),
    ("PRJ-1002", "Claims Processing Modernization", "Contoso Insurance", True, "Active", 14,
     "Move mainframe claims workflows to Spring Boot microservices on Kubernetes.",
     [("Java", "Senior Software Engineer", 3, 4, 5), ("Spring Boot", "Software Engineer", 3, 3, 3),
      ("PostgreSQL", "Software Engineer", 1, 3, 2), ("Kubernetes", "DevOps Engineer", 1, 3, 4), ("Selenium", "QA Engineer", 1, 3, 2)]),
    ("PRJ-1003", "Data Lakehouse Migration", "Fabrikam Health", True, "Active", 7,
     "Migrate on-prem warehouse to Snowflake with Spark pipelines and Power BI reporting.",
     [("Spark", "Data Engineer", 2, 4, 4), ("Snowflake", "Data Engineer", 3, 3, 3),
      ("Python", "Data Engineer", 2, 3, 2), ("Azure", "DevOps Engineer", 1, 3, 3), ("Power BI", "Business Analyst", 1, 3, 2)]),
    ("PRJ-1004", "Mobile Banking Portal", "Woodgrove Bank", True, "Active", 5,
     "Customer self-service banking portal built on .NET and Angular.",
     [("Angular", "Software Engineer", 2, 3, 2), ("C#", "Senior Software Engineer", 2, 4, 4),
      (".NET", "Software Engineer", 2, 3, 2), ("Azure", "DevOps Engineer", 1, 3, 3), ("Manual Testing", "QA Engineer", 1, 2, 1)]),
    ("PRJ-1005", "Supply Chain Analytics", "Litware Logistics", True, "Active", 4,
     "Demand-forecasting models and executive dashboards.",
     [("Machine Learning", "Data Engineer", 2, 4, 4), ("Python", "Data Engineer", 2, 3, 3),
      ("Power BI", "Business Analyst", 1, 3, 2), ("SQL", "Data Engineer", 1, 3, 1)]),
    ("PRJ-1006", "CRM Rollout", "Adventure Works", True, "Active", 3,
     "Salesforce Sales Cloud implementation for 400 sales reps.",
     [("Salesforce", "Senior Software Engineer", 3, 3, 3), ("Agile", "Project Manager", 1, 3, 6)]),
    ("PRJ-1007", "Cloud Cost Optimization", "Tailspin Airlines", True, "Pipeline", -1,
     "FinOps review and Terraform-based landing zone for AWS workloads.",
     [("AWS", "DevOps Engineer", 2, 4, 5), ("Terraform", "DevOps Engineer", 2, 3, 3), ("Kubernetes", "DevOps Engineer", 1, 3, 3)]),
    ("PRJ-1008", "Patient Scheduling API", "Fabrikam Health", True, "Pipeline", -1,
     "HIPAA-compliant scheduling API and staff web console.",
     [("FastAPI", "Software Engineer", 2, 3, 2), ("Python", "Senior Software Engineer", 2, 4, 5),
      ("PostgreSQL", "Software Engineer", 1, 3, 2), ("React", "Software Engineer", 1, 3, 2)]),
    ("PRJ-1009", "ERP Integration", "Proseware", True, "On Hold", 2,
     "SAP S/4HANA integration with legacy order management.",
     [("SAP", "Senior Software Engineer", 2, 4, 6), ("Java", "Software Engineer", 1, 3, 3)]),
    ("PRJ-2001", "Internal HR Portal", "Internal", False, "Active", 6,
     "Employee self-service portal for leave, appraisals and documents.",
     [("React", "Software Engineer", 1, 3, 1), ("FastAPI", "Software Engineer", 1, 3, 1), ("PostgreSQL", "Software Engineer", 1, 2, 1)]),
    ("PRJ-2002", "Enterprise Design System", "Internal", False, "Active", 8,
     "Shared component library and design tokens for all client work.",
     [("Figma", "UI/UX Designer", 1, 3, 2), ("React", "Software Engineer", 1, 3, 2), ("TypeScript", "Software Engineer", 1, 3, 2)]),
    ("PRJ-2003", "GenAI Assistant PoC", "Pre-sales", False, "Active", 2,
     "Proof of concept for a document Q&A assistant to support RFP responses.",
     [("Python", "Software Engineer", 1, 3, 2), ("Machine Learning", "Data Engineer", 1, 3, 3)]),
    ("PRJ-2004", "DevOps Platform Upgrade", "Internal", False, "Completed", 12,
     "Upgrade CI/CD runners and Kubernetes clusters.",
     [("Docker", "DevOps Engineer", 1, 3, 2), ("Kubernetes", "DevOps Engineer", 1, 3, 3)]),
    ("PRJ-1010", "Omnichannel Mobile App", "Northwind Retail", True, "Pipeline", -1,
     "Customer mobile app sharing the new commerce APIs, with loyalty and in-store pickup.",
     [("React", "Senior Software Engineer", 2, 4, 4), ("TypeScript", "Software Engineer", 2, 3, 2),
      ("Node.js", "Software Engineer", 1, 3, 3), ("Figma", "UI/UX Designer", 1, 3, 2), ("Cypress", "QA Engineer", 1, 3, 2)]),
    ("PRJ-1011", "Fraud Detection Platform", "Woodgrove Bank", True, "Pipeline", -1,
     "Real-time card-fraud scoring using ML models on Spark streaming in Azure.",
     [("Machine Learning", "Data Engineer", 2, 4, 5), ("Python", "Data Engineer", 2, 3, 3),
      ("Spark", "Data Engineer", 2, 3, 3), ("Azure", "DevOps Engineer", 1, 3, 4)]),
    ("PRJ-1012", "Telematics Data Platform", "Contoso Motors", True, "Pipeline", -1,
     "Ingest vehicle telemetry with Go services on GKE and serve fleet analytics.",
     [("Golang", "Senior Software Engineer", 3, 4, 5), ("GCP", "DevOps Engineer", 1, 3, 4),
      ("Kubernetes", "DevOps Engineer", 1, 3, 3), ("PostgreSQL", "Software Engineer", 1, 3, 2)]),
    ("PRJ-1013", "S/4HANA Finance Rollout", "Litware Logistics", True, "Pipeline", -1,
     "Finance module rollout across 6 countries with data migration and reporting.",
     [("SAP", "Senior Software Engineer", 3, 4, 6), ("SQL", "Data Engineer", 1, 3, 3),
      ("Agile", "Project Manager", 1, 3, 8)]),
]

# Pipeline deals: code -> (win probability %, days until expected start, duration in months)
PIPELINE_META = {
    "PRJ-1007": (75, 30, 6),
    "PRJ-1008": (90, 15, 8),
    "PRJ-1010": (80, 21, 9),
    "PRJ-1011": (50, 60, 10),
    "PRJ-1012": (60, 45, 12),
    "PRJ-1013": (40, 90, 18),
}


# Demo logins shown on the login screen: username, password, display name, role.
# The employee login is linked to the first seeded employee (EMP1001).
DEMO_USERS = [
    ("employee", "Employee@123", None, "employee"),
    ("delivery", "Delivery@123", "Delivery Manager (demo)", "delivery_manager"),
    ("finance", "Finance@123", "Finance (demo)", "finance"),
    ("hr", "Hr@12345", "HR (demo)", "hr"),
]


def ensure_demo_users(db) -> int:
    """Create the 4 demo logins if no users exist yet. Returns how many were created."""
    if db.query(User).count():
        return 0
    emp = db.query(Employee).filter(Employee.emp_code == "EMP1001").first()
    for username, password, name, role in DEMO_USERS:
        db.add(User(
            username=username,
            password_hash=hash_password(password),
            full_name=name or (emp.full_name if emp else "Demo Employee"),
            role=role,
            employee_id=emp.id if (role == "employee" and emp) else None,
        ))
    db.commit()
    return len(DEMO_USERS)


def role_for(track: str, years: float) -> str:
    fixed = {"qa": "QA Engineer", "devops": "DevOps Engineer", "data": "Data Engineer",
             "ba": "Business Analyst", "pm": "Project Manager", "design": "UI/UX Designer"}
    if track in fixed:
        return fixed[track]
    if years < 2:
        return "Associate Engineer"
    if years < 5:
        return "Software Engineer"
    if years < 9:
        return "Senior Software Engineer"
    if years < 13:
        return "Tech Lead"
    return "Architect"


def months_ago(n: int) -> date:
    return TODAY - timedelta(days=30 * n)


def run(reset: bool = True) -> None:
    """reset=True drops and recreates all tables first (local use); False only inserts."""
    ensure_schema()
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        skills = {n: Skill(name=n, category=c, premium_rate=p) for n, c, p in SKILLS}
        db.add_all(skills.values())
        db.add_all(RoleRate(role=r, base_rate=b, per_year_rate=y, max_rate=m) for r, b, y, m in RATE_CARD)
        db.flush()

        # Employees
        names, employees, n = set(), [], 1
        for track, (pool, count) in TRACKS.items():
            for _ in range(count):
                while True:
                    name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
                    if name not in names:
                        names.add(name)
                        break
                years = round(rng.uniform(0.5, 17), 1)
                if track == "pm":
                    years = round(rng.uniform(8, 18), 1)
                emp = Employee(
                    emp_code=f"EMP{1000 + n}",
                    full_name=name,
                    email=f"{name.lower().replace(' ', '.')}@company.example",
                    role=role_for(track, years),
                    years_experience=years,
                    location=rng.choice(LOCATIONS),
                    join_date=TODAY - timedelta(days=int(rng.uniform(60, 2200))),
                )
                picks = rng.sample(pool, k=min(len(pool), rng.randint(3, 5)))
                for s in picks:
                    prof = max(1, min(5, round(2 + years / 5 + rng.uniform(-1, 1))))
                    emp.skills.append(
                        EmployeeSkill(skill=skills[s], proficiency=prof, years=round(min(years, rng.uniform(0.5, years + 0.5)), 1))
                    )
                db.add(emp)
                employees.append(emp)
                n += 1
        db.flush()

        card = {r.role: r for r in db.query(RoleRate).all()}
        util = {e.id: 0 for e in employees}
        active_projects = []

        # Projects + allocations (only for Active / Completed projects)
        for code, name, client, billable, status, ago, desc, reqs in PROJECTS:
            prob, days_out, duration = PIPELINE_META.get(code, (100, 30, None))
            start = months_ago(ago) if ago >= 0 else TODAY + timedelta(days=days_out)
            project = Project(code=code, name=name, client=client, is_billable=billable, status=status,
                              start_date=start, end_date=months_ago(1) if status == "Completed" else None,
                              description=desc, probability=prob, duration_months=duration)
            for skill, role, head, prof, exp in reqs:
                project.requirements.append(ProjectRequirement(
                    skill=skills[skill], role=role, headcount=head, min_proficiency=prof, min_experience=exp))
            db.add(project)
            db.flush()
            if status not in ("Active", "Completed"):
                continue

            team = set()
            pct = 100 if billable else 50
            for skill, role, head, prof, exp in reqs:
                # leave some positions open so hiring needs show up
                fill = head - (1 if rng.random() < 0.4 else 0)
                already = sum(1 for e in employees if e.id in team and any(
                    es.skill.name == skill and es.proficiency >= prof for es in e.skills))
                cands = [e for e in employees if e.id not in team and util[e.id] + pct <= 100
                         and any(es.skill.name == skill and es.proficiency >= prof for es in e.skills)]
                rng.shuffle(cands)
                for e in cands[: max(0, fill - already)]:
                    team.add(e.id)
                    rate = compute_rate(e, card)["hourly_rate"] if billable else 0
                    end = project.end_date
                    if status != "Completed":
                        util[e.id] += pct
                    a_start = start + timedelta(days=rng.randint(0, 45))
                    db.add(Allocation(employee=e, project=project, allocation_pct=pct, bill_rate=rate,
                                      start_date=min(a_start, TODAY), end_date=end))
            if status == "Active":
                active_projects.append(project)

        # Backfill: most remaining people join an active project that uses one of their skills
        # (shadow / partial roles), leaving a realistic bench of roughly 15%.
        for e in employees:
            if util[e.id] > 0 or rng.random() > 0.65:
                continue
            emp_skills = {es.skill.name for es in e.skills if es.proficiency >= 2}
            fits = [p for p in active_projects if emp_skills & {r.skill.name for r in p.requirements}]
            if not fits:
                continue
            p = rng.choice(fits)
            pct = rng.choice([50, 100, 100])
            util[e.id] += pct
            db.add(Allocation(employee=e, project=p, allocation_pct=pct,
                              bill_rate=compute_rate(e, card)["hourly_rate"] if p.is_billable else 0,
                              start_date=TODAY - timedelta(days=rng.randint(10, 120))))
        # Bench people get a recently ended assignment so "days on bench" is realistic.
        for e in employees:
            if util[e.id] > 0 or not active_projects:
                continue
            p = rng.choice(active_projects)
            end = TODAY - timedelta(days=rng.randint(5, 75))
            db.add(Allocation(employee=e, project=p, allocation_pct=100,
                              bill_rate=compute_rate(e, card)["hourly_rate"] if p.is_billable else 0,
                              start_date=end - timedelta(days=rng.randint(90, 240)), end_date=end))
        db.commit()
        users = ensure_demo_users(db)
        bench = sum(1 for v in util.values() if v == 0)
        print(f"Seeded {len(employees)} employees, {len(PROJECTS)} projects, {bench} on bench, {users} demo logins.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
