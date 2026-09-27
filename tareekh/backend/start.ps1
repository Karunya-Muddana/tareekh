# One command to run Tareekh locally:  powershell -ExecutionPolicy Bypass -File start.ps1
#   1. Hindsight in Docker (creates the container only if it isn't running)
#   2. loads the demo case list the first time
#   3. Tareekh on http://127.0.0.1:8000  (Ctrl+C to stop; Hindsight keeps running)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Wait-Url($url, $name, $seconds) {
    for ($i = 0; $i -lt $seconds; $i++) {
        try { Invoke-RestMethod $url -TimeoutSec 3 | Out-Null; return } catch { Start-Sleep 1 }
    }
    throw "$name did not come up at $url after $seconds s"
}

# --- checks
if (-not (Test-Path .env)) { throw "backend/.env is missing. Copy .env.example to .env and set VERTEX_PROJECT." }
if (-not (Test-Path .venv\Scripts\python.exe)) {
    Write-Host "Creating venv and installing requirements..."
    python -m venv .venv
    .venv\Scripts\python.exe -m pip install -q -r requirements.txt
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker is not running. Start Docker Desktop and try again." }

# --- 1. Hindsight
$running = docker ps -q --filter "name=^tareekh-hindsight$"
if (-not $running) {
    Write-Host "Starting Hindsight container..."
    $gitBash = Join-Path (Split-Path (Split-Path (Get-Command git).Source)) "bin\bash.exe"   # Git Bash, not WSL
    & $gitBash scripts/start_hindsight.sh
    if ($LASTEXITCODE -ne 0) { throw "start_hindsight.sh failed" }
}
Write-Host "Waiting for Hindsight on :8888..."
Wait-Url "http://localhost:8888/health" "Hindsight" 180

# --- 2 + 3. API (background job while we onboard, then follow its output)
Write-Host "Starting Tareekh API on :8000..."
$api = Start-Process .venv\Scripts\python.exe -ArgumentList "-m", "uvicorn", "app.main:app", "--port", "8000" -NoNewWindow -PassThru
try {
    Wait-Url "http://127.0.0.1:8000/health" "Tareekh API" 60
    $cases = Invoke-RestMethod "http://127.0.0.1:8000/cases"
    if (@($cases).Count -eq 0) {
        Write-Host "First run: loading the demo case list and configuring the memory bank..."
        .venv\Scripts\python.exe scripts/onboard_demo.py | Out-Null
    }
    Write-Host ""
    Write-Host "Tareekh is up:  http://127.0.0.1:8000     (Hindsight UI: http://localhost:9999)"
    Write-Host "Ctrl+C to stop."
    Start-Process "http://127.0.0.1:8000"
    $api.WaitForExit()
} finally {
    if (-not $api.HasExited) { Stop-Process -Id $api.Id -Force }
}
