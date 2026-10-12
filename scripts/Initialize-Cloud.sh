#!/usr/bin/env bash
# Run locally from a tenacom-rms clone. Requires Docker and Bash.
set +x
set -euo pipefail
project_root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$project_root"
trap 'unset ConnectionStrings__Database BOOTSTRAP_EMAIL BOOTSTRAP_PASSWORD password_confirmation' EXIT
cert_path="$project_root/.local/aiven-ca.pem"
if [[ ! -f "$cert_path" ]]; then
  printf 'Save the Aiven CA certificate as .local/aiven-ca.pem first.\n' >&2
  exit 1
fi
docker info >/dev/null
docker build -f apps/api/Dockerfile -t tenacom-cloud-admin .
printf 'Use the avnadmin connection string for your new, empty tenacom database.\n'
printf 'Include SslMode=VerifyFull;SslCa=/etc/secrets/aiven-ca.pem;MaximumPoolSize=10\n'
IFS= read -r -s -p 'Connection string (hidden): ' ConnectionStrings__Database
printf '\n'
case "$ConnectionStrings__Database" in
  *'SslMode=VerifyFull;'*'SslCa=/etc/secrets/aiven-ca.pem;'*) ;;
  *) printf 'Use the TLS settings and order shown above.\n' >&2; exit 1 ;;
esac
export ConnectionStrings__Database
docker run --rm \
  --mount "type=bind,src=$cert_path,dst=/etc/secrets/aiven-ca.pem,readonly" \
  -e ConnectionStrings__Database tenacom-cloud-admin --migrate
IFS= read -r -p 'First administrator email: ' BOOTSTRAP_EMAIL
IFS= read -r -s -p 'Administrator password (12-128 characters): ' BOOTSTRAP_PASSWORD
printf '\n'
if [[ -z "$BOOTSTRAP_EMAIL" ]] || (( ${#BOOTSTRAP_PASSWORD} < 12 || ${#BOOTSTRAP_PASSWORD} > 128 )); then
  printf 'Enter an email and a password between 12 and 128 characters.\n' >&2
  exit 1
fi
IFS= read -r -s -p 'Confirm administrator password: ' password_confirmation
printf '\n'
if [[ "$BOOTSTRAP_PASSWORD" != "$password_confirmation" ]]; then
  printf 'Passwords do not match.\n' >&2
  exit 1
fi
export BOOTSTRAP_EMAIL BOOTSTRAP_PASSWORD
docker run --rm \
  --mount "type=bind,src=$cert_path,dst=/etc/secrets/aiven-ca.pem,readonly" \
  -e ConnectionStrings__Database -e BOOTSTRAP_EMAIL -e BOOTSTRAP_PASSWORD \
  tenacom-cloud-admin --bootstrap
printf 'Database initialized and administrator created. Continue with Render and Netlify.\n'
