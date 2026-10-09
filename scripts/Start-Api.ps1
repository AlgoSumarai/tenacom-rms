param([switch]$Migrate, [switch]$E2E)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$values = @{}
Get-Content (Join-Path $root '.env') | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object { $key, $value = $_ -split '=', 2; $values[$key] = $value }
$databaseName = if ($E2E) { 'tenacom_e2e' } else { 'tenacom' }
$env:ConnectionStrings__Database = "Server=127.0.0.1;Port=3307;Database=$databaseName;User=tenacom;Password=$($values.MYSQL_PASSWORD)"
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Security__Origin = $values.APP_ORIGIN
$env:Security__SecureCookies = 'false'
$env:ASPNETCORE_URLS = 'http://localhost:5080'
if ($Migrate) { dotnet run --project (Join-Path $root 'apps/api') --no-launch-profile -- --migrate }
else { dotnet run --project (Join-Path $root 'apps/api') --no-launch-profile }
exit $LASTEXITCODE
