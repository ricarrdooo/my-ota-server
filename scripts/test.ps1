$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
Push-Location $taskRoot
try {
    $env:PYTHONIOENCODING='utf-8'
    & '.\.venv\Scripts\python.exe' -m pytest -q
    exit $LASTEXITCODE
} finally { Pop-Location }
