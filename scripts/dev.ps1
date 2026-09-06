$ErrorActionPreference = "Stop"

$frontendRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path (Split-Path -Parent $frontendRoot) "long_task_1"
$preferredPython = "D:\SoftWare\Anaconda\envs\Lang_Task\python.exe"
$venvPython = Join-Path $backendRoot ".venv\Scripts\python.exe"
$python = if (Test-Path -LiteralPath $venvPython) { $venvPython } elseif (Test-Path -LiteralPath $preferredPython) { $preferredPython } else { "python" }

function Test-BackendReady {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8000/api/system/status" -TimeoutSec 2
        return $response.StatusCode -in @(200, 401, 403)
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        return $statusCode -in @(401, 403)
    }
}

$backendReady = $false
$backendReady = Test-BackendReady

if (-not $backendReady) {
    if (-not (Test-Path -LiteralPath $backendRoot)) {
        throw "Backend directory not found: $backendRoot"
    }
    $runRoot = Join-Path $backendRoot "runs"
    New-Item -ItemType Directory -Path $runRoot -Force | Out-Null
    Start-Process `
        -FilePath $python `
        -ArgumentList "-m", "engine.server" `
        -WorkingDirectory $backendRoot `
        -RedirectStandardOutput (Join-Path $runRoot "server.out.log") `
        -RedirectStandardError (Join-Path $runRoot "server.err.log") `
        -WindowStyle Hidden

    $deadline = (Get-Date).AddSeconds(20)
    do {
        Start-Sleep -Milliseconds 500
        $backendReady = Test-BackendReady
    } until ($backendReady -or (Get-Date) -gt $deadline)

    if (-not $backendReady) {
        $errorLog = Join-Path $runRoot "server.err.log"
        if (Test-Path -LiteralPath $errorLog) { Get-Content -LiteralPath $errorLog -Tail 80 }
        throw "FastAPI backend failed to start on http://127.0.0.1:8000"
    }
}

$schema = Invoke-RestMethod -Uri "http://127.0.0.1:8000/openapi.json" -TimeoutSec 5
if ([int]$schema.info.'x-run-stream-protocol' -lt 2) {
    throw "Port 8000 is occupied by an older backend without streaming approval support. Stop that backend and restart from $backendRoot. No process was terminated automatically."
}
Write-Host "FastAPI backend ready (stream protocol 2): http://127.0.0.1:8000" -ForegroundColor Green
Set-Location -LiteralPath $frontendRoot
npm run dev:web
