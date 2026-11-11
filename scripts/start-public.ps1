param([ValidateRange(1024,65535)][int]$Port=8000,
      [ValidateSet('http2','quic','auto')][string]$Protocol='auto',
      [switch]$PrepareOnly)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskPython=Join-Path $taskRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Python environment missing. Initialize .venv first.' }
Push-Location $taskRoot
try {
    $env:PYTHONIOENCODING='utf-8'
    $taskArguments=@('-m','ota_server.quick_tunnel','--port',"$Port",'--protocol',$Protocol)
    if ($PrepareOnly) { $taskArguments+='--prepare-only' }
    & $taskPython @taskArguments
    exit $LASTEXITCODE
} finally { Pop-Location }
