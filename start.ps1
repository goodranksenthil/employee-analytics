# Starts PostgreSQL (portable, in tools\), the FastAPI backend (port 8010) and the Vite frontend (port 5173).
# Usage:  .\start.ps1            start everything
#         .\start.ps1 -Seed      also reset and reload sample data
#         .\start.ps1 -Stop      stop PostgreSQL (close the API/web windows yourself)
param([switch]$Seed, [switch]$Stop)

$root = $PSScriptRoot
$pgBin = Join-Path $root "tools\pg\pgsql\bin"
$pgData = Join-Path $root "tools\pgdata"
$nodeDir = Join-Path $root "tools\node\node-v26.13.1-win-x64"
$py = Join-Path $root "backend\.venv\Scripts\python.exe"

if ($Stop) { & "$pgBin\pg_ctl.exe" -D $pgData stop; return }

& "$pgBin\pg_ctl.exe" -D $pgData status *> $null
if ($LASTEXITCODE -ne 0) {
    & "$pgBin\pg_ctl.exe" -D $pgData -l (Join-Path $root "tools\pg.log") -o "-p 5432" -w start
}

if ($Seed) { Push-Location (Join-Path $root "backend"); & $py -m app.seed; Pop-Location }

Start-Process powershell -WorkingDirectory (Join-Path $root "backend") -ArgumentList "-NoExit", "-Command", "& '$py' -m uvicorn app.main:app --reload --port 8010"
Start-Process powershell -WorkingDirectory (Join-Path $root "frontend") -ArgumentList "-NoExit", "-Command", "`$env:Path = '$nodeDir;' + `$env:Path; npm run dev"

Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"
