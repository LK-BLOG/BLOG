$ErrorActionPreference = "Stop"

$stateDir = Join-Path $env:LOCALAPPDATA "XiaokanEmailBridge"
$secretPath = Join-Path $stateDir "admin_password.dpapi"
$pythonPathFile = Join-Path $stateDir "python_path.txt"

if (-not (Test-Path -LiteralPath $secretPath)) { exit 2 }

try {
  $encrypted = Get-Content -LiteralPath $secretPath -Raw
  $secure = ConvertTo-SecureString $encrypted
  $cred = New-Object System.Management.Automation.PSCredential("admin", $secure)
  $env:ADMIN_PASSWORD = $cred.GetNetworkCredential().Password

  $python = if (Test-Path -LiteralPath $pythonPathFile) {
    (Get-Content -LiteralPath $pythonPathFile -Raw).Trim()
  } else {
    (Get-Command python.exe).Source
  }
  if (-not (Test-Path -LiteralPath $python)) {
    $python = (Get-Command python.exe).Source
  }

  & $python (Join-Path $PSScriptRoot "email_bridge.py") --yes
  exit $LASTEXITCODE
} catch {
  exit 1
}
