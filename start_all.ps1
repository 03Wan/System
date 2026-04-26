param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

function Write-Info($msg) {
  Write-Host "[INFO] $msg" -ForegroundColor Cyan
}

function Start-WindowWithScript {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptText
  )
  $bytes = [System.Text.Encoding]::Unicode.GetBytes($ScriptText)
  $encoded = [Convert]::ToBase64String($bytes)
  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-EncodedCommand", $encoded
  ) -WindowStyle Normal
}

function Start-FrontendWindow {
  $skipLiteral = if ($SkipInstall) { '$true' } else { '$false' }
  $script = @'
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath "__ROOT__\frontend"

if (__SKIP_INSTALL__ -eq $false) {
  if (!(Test-Path ".\node_modules")) {
    Write-Host "[FRONTEND] node_modules not found, running npm install..." -ForegroundColor Yellow
    npm install
  }
}

Write-Host "[FRONTEND] Starting Vite on http://127.0.0.1:5173" -ForegroundColor Green
npm run dev -- --host 0.0.0.0 --port 5173
'@
  $script = $script.Replace("__ROOT__", $root).Replace("__SKIP_INSTALL__", $skipLiteral)
  Start-WindowWithScript -ScriptText $script
}

try {
  Write-Info "Project: $root"
  Write-Info "Launching frontend only (Supabase backend)..."
  Start-FrontendWindow

  Write-Host ""
  Write-Host "Done. One window was opened:" -ForegroundColor Green
  Write-Host "- Frontend: http://127.0.0.1:5173" -ForegroundColor Green
  Write-Host ""
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "[ERROR] Startup failed. Press any key to exit."
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
  exit 1
}
