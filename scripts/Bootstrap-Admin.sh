#!/usr/bin/env bash
set +x
set -euo pipefail

if (( $# > 1 )); then
  printf 'Usage: %s [admin-email]\n' "$0" >&2
  exit 1
fi

project_root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$project_root"

if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required. Install Docker with Compose before running this script.\n' >&2
  exit 1
fi
docker compose version >/dev/null

if [[ ! -f .env ]]; then
  printf 'Missing .env. Follow the Docker setup in README.md first.\n' >&2
  exit 1
fi

trap 'unset BOOTSTRAP_EMAIL BOOTSTRAP_PASSWORD password_confirmation' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

BOOTSTRAP_EMAIL="${1:-}"
if [[ -z "$BOOTSTRAP_EMAIL" ]]; then
  IFS= read -r -p 'Initial administrator email: ' BOOTSTRAP_EMAIL
fi
if [[ -z "$BOOTSTRAP_EMAIL" ]]; then
  printf 'An administrator email is required.\n' >&2
  exit 1
fi

IFS= read -r -s -p 'Password (12-128 characters): ' BOOTSTRAP_PASSWORD
printf '\n'
if (( ${#BOOTSTRAP_PASSWORD} < 12 || ${#BOOTSTRAP_PASSWORD} > 128 )); then
  printf 'Use a password between 12 and 128 characters.\n' >&2
  exit 1
fi
IFS= read -r -s -p 'Confirm password: ' password_confirmation
printf '\n'
if [[ "$BOOTSTRAP_PASSWORD" != "$password_confirmation" ]]; then
  printf 'Passwords do not match.\n' >&2
  exit 1
fi
unset password_confirmation

export BOOTSTRAP_EMAIL BOOTSTRAP_PASSWORD
if docker compose run --rm --no-deps -T \
  -e BOOTSTRAP_EMAIL -e BOOTSTRAP_PASSWORD api --bootstrap; then
  printf 'Administrator created. Sign in at http://localhost:3000 with the credentials you entered.\n'
else
  printf 'Administrator creation failed. Check the error above. The Docker stack must be running and the Users table must be empty.\n' >&2
  exit 1
fi
