$ErrorActionPreference = "Stop"

$frontendRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path (Split-Path -Parent $frontendRoot) "long_task_1"
$preferredPython = "D:\SoftWare\Anaconda\envs\Lang_Task\python.exe"
$python = if (Test-Path -LiteralPath $preferredPython) { $preferredPython } else { "python" }

$backendReady = $false
try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8000/api/system/status" -TimeoutSec 2
    $backendReady = $response.StatusCode -eq 200
} catch {
    $backendReady = $false
}

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
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8000/api/system/status" -TimeoutSec 2
            $backendReady = $response.StatusCode -eq 200
        } catch {
            $backendReady = $false
        }
    } until ($backendReady -or (Get-Date) -gt $deadline)

    if (-not $backendReady) {
        $errorLog = Join-Path $runRoot "server.err.log"
        if (Test-Path -LiteralPath $errorLog) { Get-Content -LiteralPath $errorLog -Tail 80 }
        throw "FastAPI backend failed to start on http://127.0.0.1:8000"
    }
}

Write-Host "FastAPI backend ready: http://127.0.0.1:8000" -ForegroundColor Green
Set-Location -LiteralPath $frontendRoot
npm run dev:web
