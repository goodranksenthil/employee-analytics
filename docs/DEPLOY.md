# Deploying Employee Analytics: Render + Vercel

Same setup as cip-platform.

```
 Browser ──▶ Vercel (React static site, CDN)
    │
    └──── /api/* (CORS) ──▶ Render web service (FastAPI, Docker)
                                 │
                                 └──▶ Render Postgres 16 (cip-db, schema employee_analytics)
```

| Piece | Where | Config |
|---|---|---|
| React UI | **Vercel** | [`vercel.json`](../vercel.json) — Vite build, `frontend/dist`, SPA routing, security headers |
| FastAPI | **Render** (Docker web service) | [`render.yaml`](../render.yaml), [`backend/Dockerfile`](../backend/Dockerfile) |
| PostgreSQL 16 | **Render Postgres `cip-db`** (shared) | Render allows one free database per workspace, so this app reuses cip-db. `DATABASE_URL` is wired in from it automatically and every table lives in the `employee_analytics` schema (`DB_SCHEMA`), so CIP's tables are never touched. The free database expires after 30 days — upgrade it or point `DATABASE_URL` elsewhere |

Put the code in a GitHub repository first; Render and Vercel deploy from it.

## 1. Render (API + database)

1. <https://dashboard.render.com> → **New → Blueprint** → connect the repository. Render reads
   `render.yaml` and proposes `employee-analytics-api` (connected to the existing `cip-db`).
2. Secrets it asks for:

   | Variable | Value |
   |---|---|
   | `CORS_ORIGINS` | leave empty for now — set the Vercel URL in step 3 |
   | `CORS_ORIGIN_REGEX` | leave empty (optional, see step 3) |

3. **Apply**. The first deploy builds the image, creates the tables and loads the sample data
   (`SEED_DEMO_DATA=true`, only into an empty database). Check
   `https://employee-analytics-api.onrender.com/api/health` → `{"status":"ok"}`. Swagger: `/docs`.
4. Note the service URL — Vercel needs it.

The free plan sleeps after 15 minutes idle (first request then takes ~1 minute).
[`.github/workflows/keep-awake.yml`](../.github/workflows/keep-awake.yml) pings it every 10 minutes —
update the two URLs in it after the first deploy.

## 2. Vercel (UI)

1. <https://vercel.com/new> → import the repository. **Root Directory**: leave as the repo root
   (the root `vercel.json` builds `frontend/`).
2. **Environment Variables** → `VITE_API_BASE_URL` = the Render URL from step 1.4, no trailing
   slash (e.g. `https://employee-analytics-api.onrender.com`). It is compiled into the bundle, so
   **redeploy after changing it**.
3. **Deploy**, then note the production URL (e.g. `https://employee-analytics.vercel.app`).

## 3. Connect them (CORS)

Render → `employee-analytics-api` → **Environment**:

- `CORS_ORIGINS` = `https://employee-analytics.vercel.app` (comma-separate several origins).
- Optional, for Vercel preview deployments:
  `CORS_ORIGIN_REGEX` = `^https://employee-analytics-[a-z0-9-]+\.vercel\.app$`

Save — Render redeploys. Open the Vercel URL: the dashboard loads with the sample data.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| UI loads but every call fails, console shows a CORS error | `CORS_ORIGINS` doesn't contain the exact Vercel origin (scheme + host, no trailing slash) |
| UI calls `https://<vercel-domain>/api/...` and gets 404 / HTML | `VITE_API_BASE_URL` was not set when Vercel built it. Set it and redeploy |
| First load takes ~1 minute | Render free instance was asleep; keep-awake workflow or a paid plan fixes it |
| Data disappeared after 30 days | Free Render Postgres expired; upgrade it or use Supabase |
