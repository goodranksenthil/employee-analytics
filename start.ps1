# Starts PostgreSQL (portable, in tools\), the FastAPI backend (port 8010) and the Vite frontend (port 5173).
# Usage:  .\start.ps1            start everything
#         .\start.ps1 -Seed      also reset and reload sample data
#         .\start.ps1 -Stop      stop the API, web and PostgreSQL
param([switch]$Seed, [switch]$Stop)

$root = $PSScriptRoot
$pgBin = Join-Path $root "tools\pg\pgsql\bin"
$pgData = Join-Path $root "tools\pgdata"
$nodeDir = Join-Path $root "tools\node\node-v26.13.1-win-x64"
$py = Join-Path $root "backend\.venv\Scripts\python.exe"

if ($Stop) {
    foreach ($port in 8010, 5173) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    }
    & "$pgBin\pg_ctl.exe" -D $pgData stop
    return
}

& "$pgBin\pg_ctl.exe" -D $pgData status *> $null
if ($LASTEXITCODE -ne 0) {
    & "$pgBin\pg_ctl.exe" -D $pgData -l (Join-Path $root "tools\pg.log") -o "-p 5432" -w start
}

if ($Seed) { Push-Location (Join-Path $root "backend"); & $py -m app.seed; Pop-Location }

function Test-Port([int]$port) {
    [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# The API and web servers run in their own (minimized) windows, independent of whatever
# launched this script, so they keep running until you close those windows or sign out.
if (Test-Port 8010) { Write-Host "API already running on :8010" }
else {
    Start-Process powershell -WindowStyle Minimized -WorkingDirectory (Join-Path $root "backend") `
        -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle = 'Resource Hub API :8010'; & '$py' -m uvicorn app.main:app --port 8010"
}
if (Test-Port 5173) { Write-Host "Web already running on :5173" }
else {
    Start-Process powershell -WindowStyle Minimized -WorkingDirectory (Join-Path $root "frontend") `
        -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle = 'Resource Hub Web :5173'; `$env:Path = '$nodeDir;' + `$env:Path; npm run dev"
}

# Wait until both answer before opening the browser.
for ($i = 0; $i -lt 40 -and -not ((Test-Port 8010) -and (Test-Port 5173)); $i++) { Start-Sleep -Milliseconds 500 }
Start-Process "http://localhost:5173"
