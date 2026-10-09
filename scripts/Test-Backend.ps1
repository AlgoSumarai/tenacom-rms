param([switch]$UnitOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
  if ($UnitOnly) { dotnet test --filter 'Category!=Integration'; exit $LASTEXITCODE }
  docker compose -f compose.yaml -f compose.dev.yaml up -d --wait --wait-timeout 120 db
  if ($LASTEXITCODE -ne 0) { throw 'Local MySQL is not ready.' }
  $values = @{}
  Get-Content .env | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object { $key, $value = $_ -split '=', 2; $values[$key] = $value }
  # This dedicated test database contains synthetic records only. Never point TEST_DATABASE at production.
  'CREATE DATABASE IF NOT EXISTS tenacom_test; GRANT ALL ON tenacom_test.* TO ''tenacom''@''%'';' | docker compose exec -T db sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -u root'
  if ($LASTEXITCODE -ne 0) { throw 'Could not prepare test database.' }
  $env:TEST_DATABASE = "Server=127.0.0.1;Port=3307;Database=tenacom_test;User=tenacom;Password=$($values.MYSQL_PASSWORD)"
  dotnet test --verbosity minimal
  exit $LASTEXITCODE
} finally { Pop-Location }
