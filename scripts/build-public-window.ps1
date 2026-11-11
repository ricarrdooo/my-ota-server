$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$exe = Join-Path $root 'OTA公网地址.exe'
& $compiler /nologo /target:winexe /optimize+ /codepage:65001 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/out:$exe" (Join-Path $PSScriptRoot 'PublicTunnelWindow.cs')
if ($LASTEXITCODE) { throw '公网窗口编译失败' }
$desktop = [Environment]::GetFolderPath('Desktop')
$link = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'OTA 公网地址.lnk'))
$link.TargetPath = $exe
$link.WorkingDirectory = $root
$link.Description = '启动个人 OTA 公网服务并复制 ESP32 的 HTTPS 地址'
$link.Save()
Write-Output $exe
