$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$credentials = Get-Content (Join-Path $root '.local/e2e.json') -Raw | ConvertFrom-Json
$env:E2E_ADMIN_EMAIL = $credentials.email
$env:E2E_ADMIN_PASSWORD = $credentials.password
$ready = $false
$baseUrl = if ($env:E2E_BASE_URL) { $env:E2E_BASE_URL.TrimEnd('/') } else { 'http://localhost:3000' }
for ($attempt = 0; $attempt -lt 6; $attempt++) {
  try { Invoke-WebRequest "$baseUrl/api/terms" -UseBasicParsing -TimeoutSec 30 | Out-Null; $ready = $true; break }
  catch { if ($attempt -lt 5) { Start-Sleep -Seconds 2 } }
}
if (!$ready) { throw 'The browser application and API are not ready.' }
Push-Location (Join-Path $root 'apps/web')
try { npm.cmd run test:e2e; exit $LASTEXITCODE }
finally { Pop-Location; Remove-Item Env:E2E_ADMIN_EMAIL; Remove-Item Env:E2E_ADMIN_PASSWORD }
