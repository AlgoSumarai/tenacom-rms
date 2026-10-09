param([Parameter(Mandatory=$true)][string]$Email)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$secret = Read-Host 'Initial administrator password (12-128 characters)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
  $env:BOOTSTRAP_EMAIL = $Email
  $env:BOOTSTRAP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  Push-Location $root
  try { docker compose run --rm -e BOOTSTRAP_EMAIL -e BOOTSTRAP_PASSWORD api --bootstrap }
  finally { Pop-Location }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  Remove-Item Env:BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:BOOTSTRAP_EMAIL -ErrorAction SilentlyContinue
}
