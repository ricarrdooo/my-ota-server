$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskPython=Join-Path $taskRoot '.venv\Scripts\python.exe'
Push-Location $taskRoot
try {
    $env:PYTHONIOENCODING='utf-8'
    & $taskPython -m ota_server.quick_tunnel --stop
    exit $LASTEXITCODE
} finally { Pop-Location }
