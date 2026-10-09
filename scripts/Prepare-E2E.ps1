$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
  docker compose -f compose.yaml -f compose.dev.yaml up -d --wait --wait-timeout 120 db
  if ($LASTEXITCODE -ne 0) { throw 'Local MySQL is not ready.' }
  $values = @{}
  Get-Content .env | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object { $key, $value = $_ -split '=', 2; $values[$key] = $value }
  'CREATE DATABASE IF NOT EXISTS tenacom_e2e; GRANT ALL ON tenacom_e2e.* TO ''tenacom''@''%'';' | docker compose exec -T db sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -u root'
  if ($LASTEXITCODE -ne 0) { throw 'Could not create E2E database.' }
  $env:ConnectionStrings__Database = "Server=127.0.0.1;Port=3307;Database=tenacom_e2e;User=tenacom;Password=$($values.MYSQL_PASSWORD)"
  dotnet run --project apps/api --no-launch-profile -- --migrate
  if ($LASTEXITCODE -ne 0) { throw 'Migration failed.' }
  New-Item -ItemType Directory -Force .local | Out-Null
  if (!(Test-Path .local/e2e.json)) {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $env:BOOTSTRAP_EMAIL = 'browser-admin@example.test'
    $env:BOOTSTRAP_PASSWORD = [Convert]::ToBase64String($bytes)
    dotnet run --project apps/api --no-launch-profile -- --bootstrap
    if ($LASTEXITCODE -ne 0) { throw 'Bootstrap failed; use a fresh test database.' }
    @{ email = $env:BOOTSTRAP_EMAIL; password = $env:BOOTSTRAP_PASSWORD } | ConvertTo-Json | Set-Content .local/e2e.json
    Remove-Item Env:BOOTSTRAP_PASSWORD
    Remove-Item Env:BOOTSTRAP_EMAIL
  }
  Write-Output 'Prepared dedicated E2E database and ignored local test credentials.'
} finally { Pop-Location }
