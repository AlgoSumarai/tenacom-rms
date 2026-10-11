# Tenacom Resource Management System

A professional resource network connecting people and structured expertise to projects, assignments and recorded work. Built with .NET 10, MySQL 8.4 and Next.js 16 / TypeScript.

## Start with Docker

Prerequisites: Docker Desktop/Engine with Compose v2 or later. Local development additionally requires .NET SDK 10.0.203 or a later 10.0 feature band, Node.js 24 LTS and npm. PowerShell helper scripts run on Windows; equivalent Compose commands work on other platforms.

1. Run `./scripts/New-LocalEnvironment.ps1`, or copy `.env.example` to `.env` and replace both database passwords with different random values. Never commit `.env`.
2. Run `docker compose up --build -d`. MySQL becomes healthy, the migration job completes, then API and frontend start.
3. On Linux/Ubuntu, run `bash scripts/Bootstrap-Admin.sh` and enter your email. On Windows, run `./scripts/Bootstrap-Admin.ps1 -Email you@example.com`. Enter a strong password at the hidden prompt. This explicit operation only works while the user table is empty. There are no default credentials.
4. Open http://localhost:3000 and sign in. Create an invitation, download its QR code, or create staff accounts under **People & access**.

The browser is the only published service. MySQL data persists in the `mysql-data` volume. `docker compose down` stops the stack without deleting data. Do not use `down -v` on a database whose records you need to retain.

The Bash bootstrap script also accepts an email argument: `bash scripts/Bootstrap-Admin.sh you@example.com`. It prompts for and confirms the password, then removes the credentials from its environment when it exits. Start the Docker stack before running it. Do not place passwords directly in command history.

## Develop locally

```powershell
docker compose -f compose.yaml -f compose.dev.yaml up -d db
./scripts/Start-Api.ps1 -Migrate
./scripts/Start-Api.ps1
# In another terminal:
cd apps/web
npm ci
npm run dev
```

The local API listens on http://localhost:5080 and the web app on http://localhost:3000. The development Compose override binds MySQL to loopback port 3307 and optionally the container API to 5080. Do not run both native and container API processes on that port. Next.js proxies `/api` to `API_URL` (defaults to `http://localhost:5080`; Docker builds use `http://api:8080`). The rewrite destination is a build-time setting.

On corporate machines using the Windows trust store, run npm with `NODE_USE_SYSTEM_CA=1` if Node does not recognise the organisation's CA. Preserve TLS verification. Set `NODE_USE_ENV_PROXY=1` if your environment supplies proxy variables. If container dependency downloads also require the corporate CA, run `./scripts/Export-BuildTrust.ps1`, then `docker compose -f compose.yaml -f compose.trust.yaml build`. This optional override mounts public trust roots only during dependency installation; neither private keys nor trust bundles are copied into runtime images.

## Configuration

| Setting | Purpose |
| --- | --- |
| `ConnectionStrings__Database` | MySQL connection string, API only |
| `Security__Origin` / `APP_ORIGIN` | Exact browser origin allowed for mutations |
| `Security__SecureCookies` / `SECURE_COOKIES` | Must be true outside Development |
| `ASPNETCORE_ENVIRONMENT` | Development locally; Production when deployed |
| `AllowedHosts` | Allowed API hosts; constrain for your reverse proxy |
| `API_URL` | Next.js upstream at build time |
| `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` | One-time empty-database administrator provisioning |
| `TEST_DATABASE` | Dedicated MySQL database for integration tests |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_BASE_URL` | Browser-test credentials and URL; synthetic/test environment only |

Production must use HTTPS, secure cookies, private database/API networking, secret injection, backups, and separate migration/runtime database accounts. The local Compose stack is an orchestration baseline, not a managed production hosting service. See [operations](docs/operations.md) for release and backup guidance.

For the complete application on Oracle Cloud Always Free, follow the [Oracle deployment guide](docs/oracle-deployment.md). It covers an Ubuntu ARM server, HTTPS, separate runtime database permissions, existing-data transfer and a fresh-install alternative.

## Workflows and permissions

| Action | Admin | Manager | Resource |
| --- | --- | --- | --- |
| Sign in | Yes | Yes | No |
| Submit details through an invitation | — | — | Yes; no password |
| Search/read resource profiles | Yes | Yes | No |
| Edit/review profiles | Yes | Yes | No |
| Create/edit/deactivate users | All roles | Resource role only | No |
| Invitations and vocabulary | Yes | Yes | Public vocabulary for submission only |
| Create/edit/archive projects; assign resources | Yes | No | No |
| Read projects and assignments | All | All | No |
| Record/edit/remove resource time | Yes | Yes | No |
| Read hours/reports | All | All | No |

Resources provide professional details through the invitation form and finish at a green checkmark and thank-you message. They have no password or system sign-in. Admins and Managers maintain profiles and record hours against a selected resource and project assignment. The original recorder remains visible when another staff member corrects an entry. Contact the person who invited you to request a correction or removal.

This follows the user's 2026-10-08 clarification and replaces the original authenticated Resource workflow. Migration 003 removes existing Resource credentials and sessions while retaining profile IDs, assignments and time history. Resource roles remain fixed to preserve those relationships. Historical records are preserved on deactivation; this release has no approval/payroll lock.

## Repository

```text
apps/api/
  Api/             Thin REST routes
  Application/     Services and explicit request/response contracts
  Domain/          Validation and permission rules
  Infrastructure/  MySQL, migrations and session authentication
apps/web/src/
  app/             Next.js server-rendered routes/layouts
  components/      Interactive workflow components
  lib/             API client and domain types
tests/Tenacom.Api.Tests/  Domain and real-MySQL API workflow tests
apps/web/tests/          Playwright browser workflows
scripts/                 Repeatable local operations
docs/                    Architecture, operations, verification and review
```

Read [architecture and assumptions](docs/architecture.md) before extending the domain. SQL is parameterized; sorts use allowlisted expressions. Transactions protect invitation usage, assignment overlap, last-admin safety and daily time totals. Version columns reject stale edits.

## Migrations and API documentation

Run `docker compose run --rm migrate`, or `./scripts/Start-Api.ps1 -Migrate` for a native API. Migration files are embedded, ordered and checksum-checked. Never edit an applied migration; add the next numbered SQL file. Back up before DDL changes: MySQL DDL is not rolled back atomically. A failed migration requires operator inspection and repair before retrying; do not clear the migration ledger blindly.

OpenAPI JSON is served at `http://localhost:5080/openapi/v1.json` for signed-in Admin/Manager callers when the API is exposed locally. In Compose-only deployments access the API through a trusted internal tool using the session cookie; it is deliberately not a public endpoint. [API guide](docs/api.md) lists routes and error conventions.

## Checks

```powershell
dotnet build
./scripts/Test-Backend.ps1 -UnitOnly
./scripts/Test-Backend.ps1
dotnet format --verify-no-changes
cd apps/web
npm ci
npm run typecheck
npm run lint
npm run build
npm run format:check
npm run test:e2e
```

`Test-Backend.ps1` creates a separate `tenacom_test` database using the local Compose service and runs unit plus MySQL integration tests. It does not erase existing databases. Tests create uniquely named synthetic records. Browser tests need a running application and administrator credentials in environment variables; they also create synthetic records. Edge is selected by default on Windows; other platforms use Playwright-managed Chromium installed with `npx playwright install chromium`.

For isolated local browser tests, run `./scripts/Prepare-E2E.ps1`, start the API with `./scripts/Start-Api.ps1 -E2E`, start the frontend with `npm run build` followed by `npm start`, then run `./scripts/Test-Browser.ps1`. This uses a separate `tenacom_e2e` database and random credentials in ignored `.local/e2e.json`. Never use these synthetic accounts in a production database.

Test traces/screenshots may contain synthetic account information and invitation links. Test output folders are ignored; do not publish artifacts from real user sessions.

The [verification report](docs/verification.md) records checks actually executed and the remaining deployment limits. The [original quality review](docs/quality-review.md) records the initial implementation; the [Resource submission review](docs/resource-submission-quality-review.md) covers the revised password-free workflow and its improvement cycles.
