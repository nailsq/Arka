param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$root = "C:/dev/arcaflowers"
$srcApp = Join-Path $root "tmp_live_app.js"
$srcStyle = Join-Path $root "tmp_live_style.css"
$dstApp = Join-Path $root "public/app.js"
$dstStyle = Join-Path $root "public/style.css"

if (-not (Test-Path $srcApp)) {
  throw "Backup file not found: $srcApp"
}
if (-not (Test-Path $srcStyle)) {
  throw "Backup file not found: $srcStyle"
}
if (-not (Test-Path $dstApp)) {
  throw "Target file not found: $dstApp"
}
if (-not (Test-Path $dstStyle)) {
  throw "Target file not found: $dstStyle"
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $root ("restore_backup_" + $stamp)

Write-Host "Source backup files:"
Write-Host "  $srcApp"
Write-Host "  $srcStyle"
Write-Host ""
Write-Host "Target files:"
Write-Host "  $dstApp"
Write-Host "  $dstStyle"
Write-Host ""

if ($DryRun) {
  Write-Host "Dry run mode. No files were changed."
  exit 0
}

New-Item -ItemType Directory -Path $backupDir | Out-Null
Copy-Item $dstApp (Join-Path $backupDir "app.js.current")
Copy-Item $dstStyle (Join-Path $backupDir "style.css.current")

$utf16 = [System.Text.Encoding]::Unicode
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$appText = [System.IO.File]::ReadAllText($srcApp, $utf16)
$styleText = [System.IO.File]::ReadAllText($srcStyle, $utf16)

$appText = $appText.TrimStart([char]0xFEFF)
$styleText = $styleText.TrimStart([char]0xFEFF)

[System.IO.File]::WriteAllText($dstApp, $appText, $utf8NoBom)
[System.IO.File]::WriteAllText($dstStyle, $styleText, $utf8NoBom)

Write-Host ""
Write-Host "Restore completed."
Write-Host "Current files backup saved to:"
Write-Host "  $backupDir"
Write-Host ""
Write-Host "Next:"
Write-Host "  1) npm run start (or restart your server process)"
Write-Host "  2) Hard refresh browser (Ctrl+F5)"
