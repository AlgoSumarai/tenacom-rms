$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Force (Join-Path $root '.local') | Out-Null
$certificates = Get-ChildItem Cert:\LocalMachine\Root, Cert:\CurrentUser\Root | Sort-Object Thumbprint -Unique
$pem = foreach ($certificate in $certificates) {
  '-----BEGIN CERTIFICATE-----'
  [Convert]::ToBase64String($certificate.RawData, [Base64FormattingOptions]::InsertLineBreaks)
  '-----END CERTIFICATE-----'
}
[IO.File]::WriteAllLines((Join-Path $root '.local/build-ca.pem'), $pem, [Text.Encoding]::ASCII)
Write-Output "Exported $($certificates.Count) public trust roots for optional BuildKit mounts. No private keys were exported."
