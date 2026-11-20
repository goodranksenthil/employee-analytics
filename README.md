# Employee Analytics — Resource Hub

Workforce dashboard: projects (billable / non-billable), resources and their assignments, bench,
skill matching (by project or uploaded requirement document), hiring needs, and USD bill rates
derived from role, experience and skills.

**Stack:** React + TypeScript + Vite · Python + FastAPI · PostgreSQL

## Pages (left menu)

| Menu | What it shows |
|---|---|
| Dashboard | Total / billable / non-billable projects, resources, bench, utilization, monthly billing, open positions, charts |
| Projects → All / Billable / Non-Billable | Project list with team size, open positions, monthly billing. Click → requirements, assigned team, recommended candidates (one-click assign / release) |
| Projects → Pipeline | Upcoming projects: start/end dates, win probability, required technologies by role, estimated rate and monthly billing per role, contract & probability-weighted value, staffing readiness (internal candidates vs. hires), 12-month billing forecast |
| Resources | Every employee with role, skills, assigned projects, utilization, rate. Click → **employee detail**: skills by category, project assignments, rate breakdown, best-fit open projects |
| Bench | Unallocated employees, days on bench, best matching open project |
| Skill Matching | Rank employees against a project's requirements **or** an uploaded requirement document (PDF / DOCX / TXT) or pasted text |
| Hiring Needs | Open positions per project, internal candidates, and skill sets that must be hired |
| Billing & Rates | Revenue by project, per-employee rate breakdown, editable rate card |

## Bill rate formula

```
hourly rate = role base rate
            + per-year rate × years of experience (max 20)
            + top 3 skill premiums × (proficiency / 5)
            (capped at the role's max rate)
monthly billing = hourly rate × 160 h × allocation %   (billable projects only)
```

Role rates live in the `role_rates` table (editable on the Rate Card tab); skill premiums in `skills.premium_rate`.

## Run it (this machine)

Everything is already installed: Python 3.12 (user install), portable Node.js and PostgreSQL 16 in `tools\`
(database files in `tools\pgdata`, user/password `postgres`/`postgres`).

```powershell
.\start.ps1          # starts PostgreSQL, API on :8010, web on :5173 and opens the browser
.\start.ps1 -Seed    # same, but resets the sample data first
.\start.ps1 -Stop    # stops PostgreSQL
```

> Port 8000 is used by another program on this machine, so the API runs on **8010**
> (Vite proxies `/api` there — see `frontend/vite.config.ts`).

## Run it (fresh machine)

Prerequisites: Python 3.10+, Node 18+, and PostgreSQL (or Docker).

1. Start PostgreSQL (skip if you already have one; then set `DATABASE_URL` in `backend/.env`):

   ```powershell
   docker compose up -d
   ```

2. Backend:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   Copy-Item .env.example .env
   python -m app.seed          # drops & recreates tables, loads sample data
   uvicorn app.main:app --reload --port 8010
   ```

   API docs: http://localhost:8010/docs

3. Frontend (new terminal):

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   Open http://localhost:5173 (Vite proxies `/api` to port 8010).

## API

| Method | Path | |
|---|---|---|
| GET | `/api/dashboard/summary` | KPIs and chart data |
| GET | `/api/projects?billable=&status=` | Project list |
| GET | `/api/projects/{id}` | Requirements, team, candidates |
| GET | `/api/pipeline` | Upcoming projects, technologies, billing estimates, forecast |
| GET | `/api/employees?status=bench\|allocated&search=` | Resource list |
| GET | `/api/employees/{id}` | Skills, assignments, rate, best-fit projects |
| GET | `/api/bench` | Bench list with best match |
| POST | `/api/allocations` | Assign employee (bill rate auto-computed if omitted) |
| DELETE | `/api/allocations/{id}` | Release employee |
| GET | `/api/matching/project/{id}` | Ranked matches for a project |
| POST | `/api/matching/document` | Multipart `file` or `text` → extracted skills + ranked matches |
| GET | `/api/hiring-needs` | Open positions and skills to hire |
| GET/PUT | `/api/billing/rate-card[/{role}]` | Rate card |
| GET | `/api/billing/employees`, `/api/billing/projects` | Rate and revenue tables |
