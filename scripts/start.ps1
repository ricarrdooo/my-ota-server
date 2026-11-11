param([ValidateRange(1,65535)][int]$Port=8000,[string]$LanIP='')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskPython=Join-Path $taskRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Run: python -m venv .venv; then .venv\Scripts\python.exe -m pip install -r requirements-dev.txt' }
$taskVueBundle=Join-Path $taskRoot 'ota_server\static\admin\admin.js'
if (-not (Test-Path -LiteralPath $taskVueBundle)) { throw 'Vue assets missing. First run: .\scripts\build-ui.ps1' }
Push-Location $taskRoot
try {
    $env:PYTHONIOENCODING='utf-8'
    if (-not $env:OTA_PUBLIC_URL) { $env:OTA_PUBLIC_URL="http://127.0.0.1:$Port" }
    if ($LanIP) {
        Write-Warning '仅限可信局域网调试：设备密钥以 HTTP 明文传输。管理后台仍仅供本机访问。'
        & $taskPython -m ota_server serve --port $Port --lan-http-host $LanIP
    } else {
        & $taskPython -m ota_server serve --port $Port
    }
    exit $LASTEXITCODE
} finally { Pop-Location }
