param([switch]$SkipInstall)
$ErrorActionPreference='Stop'
$uiProject=Join-Path (Split-Path -Parent $PSScriptRoot) 'frontend'
Push-Location $uiProject
try {
    if (-not $SkipInstall) {
        & npm ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Vue dependency installation failed.' }
    }
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Vue frontend build failed.' }
} finally { Pop-Location }
