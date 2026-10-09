param([string]$Origin = 'http://localhost:3000')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $root '.env'
if (Test-Path -LiteralPath $envPath) { throw '.env already exists; preserving it.' }
function New-Secret {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($bytes)
}
$lines = @("MYSQL_ROOT_PASSWORD=$(New-Secret)", "MYSQL_PASSWORD=$(New-Secret)", "APP_ORIGIN=$Origin", 'ASPNETCORE_ENVIRONMENT=Development', 'SECURE_COOKIES=false')
[IO.File]::WriteAllLines($envPath, $lines)
Write-Output 'Created ignored .env with random local database credentials.'
