param([switch]$Uninstall)

$ErrorActionPreference = "Stop"
$taskName = "XiaokanEmailBridge"
$stateDir = Join-Path $env:LOCALAPPDATA "XiaokanEmailBridge"
$secretPath = Join-Path $stateDir "admin_password.dpapi"
$pythonPathFile = Join-Path $stateDir "python_path.txt"

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stateDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Uninstalled."
  exit 0
}

if (-not (Test-Path -LiteralPath $secretPath)) {
  $secure = Read-Host -AsSecureString "Online admin password"
  New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
  ConvertFrom-SecureString $secure | Set-Content -LiteralPath $secretPath
  (Get-Command python.exe).Source | Set-Content -LiteralPath $pythonPathFile
}

$runScript = Join-Path $PSScriptRoot "run_email_bridge.ps1"
$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runScript`""
$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
  -Hidden `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Poll the Xiaokan blog email outbox and send via agently-cli" `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Write-Host "Installed. Email bridge runs every minute."
