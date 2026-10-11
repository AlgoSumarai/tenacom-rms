# Verification evidence

This records observed results, not intended checks. Current source is in the supplied checkout; no remote deployment or GitHub Actions run is claimed. The original application and logo checks below are historical evidence under the earlier Resource-login requirements. The password-free Resource release is recorded separately and supersedes that behaviour.

## Original implementation checks — historical

| Check | Observed result |
| --- | --- |
| .NET builds and test compilation | Current Release build completed with **zero warnings and zero errors**. The final API image also completed `dotnet publish -c Release`. Compiler warnings are treated as errors in the API. |
| Backend tests against MySQL 8.4 | **24 passed, 0 failed, 0 skipped** on the current source, including a successful run of the documented `./scripts/Test-Backend.ps1` helper against `tenacom_test`. |
| Database migrations | Real MySQL migrations applied; integration test repeats migration execution to verify no-op replay and exercises relational constraints/transactions. |
| Next.js 16.4.0 production build | Successful compilation, strict TypeScript, route generation and optimization. |
| Frontend lint | Passed with zero warnings under ESLint 10. |
| Frontend typecheck | Passed under strict TypeScript. |
| Frontend formatting | Prettier format check passed. |
| Backend formatting | `dotnet format --verify-no-changes` passed. |
| NuGet vulnerability audit | API project reported no vulnerable packages against the configured sources. |
| npm vulnerability audit after upgrade | Reported **0 vulnerabilities** with Next.js 16.4.0. Earlier reported advisories were addressed rather than suppressed. |
| Compose configuration | Parsed successfully with required environment values; no secret values were printed. |
| Final container build/start | Current API/migration and frontend multi-stage images built. Migration job exited **0**; MySQL, API and web reached **healthy**. Runtime checks confirmed .NET **10.0.12**, Next.js **16.4.0**, API UID **1654** and web UID **1000**. |
| HTTP smoke checks | `/login`, proxied `/api/terms`, `/health/live` and `/health/ready` returned **200**. |
| Full application browser acceptance | **4 passed, 0 failed** through `./scripts/Test-Browser.ps1` using Edge/Playwright and the isolated `tenacom_e2e` database. The run completed in approximately 1.5 minutes, before the subsequent visual logo replacement. |
| Visual/accessibility QA | Mobile onboarding and desktop network screenshots inspected; a 390px viewport has no horizontal overflow. Axe reported zero WCAG 2 A/AA and 2.1 AA violations on the tested network, own-profile and sign-in screens. This is not a full accessibility certification. |
| Source cleanup scan | No required TODO/FIXME stubs, debug Console.WriteLine, raw HTML insertion, browser token storage, or wildcard CORS grants found. Secrets/generated outputs are ignored. |

Backend coverage includes malformed/negative/future/out-of-assignment time, daily caps, concurrent entries, ownership, Manager escalation, public invitation usage, profile review reset, stale versions, time corrections/deletion, historical totals after deactivation, assignment/project date changes, account read scope, password lockout/revocation, production configuration rejection, audit events and generated OpenAPI.

## Acceptance details

The four Playwright tests cover mobile onboarding and profile editing, QR download, Admin sign-in/search/project/assignment/time/reporting, Manager account scope/deactivation, server error recovery and WCAG checks. The workflow also forces an assignment lookup failure, verifies that time submission is blocked, reloads assignments, then records 90 minutes and confirms the grouped 1.5-hour total. The assertion accepts a comma or dot decimal separator because hours are localized for the browser.

Earlier runs exposed real UI defects: select labels included option/help text and profile save could announce success twice. These were fixed in the application before the passing run. No earlier partial test run is treated as final acceptance.

Docker's management API stalled during verification. The user authorized a Docker Desktop restart; a bounded normal restart timed out, then the official forced stop/start recovered it. No volumes were reset or deleted. A cancelled frontend build was identified through BuildKit history and resumed in a background process; only completed final builds count as evidence. Native verification processes on ports 5081/3010 were stopped.

Synthetic test records remain in separate databases. The browser-test administrator password was rotated after acceptance; sign-in/sign-out with the new ignored local credential was verified without printing it. No production account or default password was seeded.

At the original handoff, the standard `docker compose up -d --wait --wait-timeout 120` command succeeded against the clean `tenacom` application database. Both original migrations had applied, the user count was zero, and all long-running services were healthy. Only the frontend was published at `127.0.0.1:3000`; API and database ports were private. `/login` and proxied `/api/terms` returned 200 after the switch. Later user-created accounts are preserved by subsequent upgrades; this is not a current user-count claim.

## Logo replacement — 2026-10-08

The user-supplied Tenacom PNG replaced the placeholder mark on sign-in, onboarding and the workspace sidebar. File hashes confirmed an unchanged copy of the original. Frontend lint, strict typecheck and formatting passed; the production Docker frontend build completed and the updated web container reached healthy. The existing backend and database were retained.

Six Edge/Playwright layout previews covered desktop/mobile sign-in, mobile onboarding and desktop/mobile/tablet workspace views (1440px, 390px and 1024px as applicable). All six loaded the logo, had no horizontal overflow and reported zero violations for the tested WCAG 2 A/AA and 2.1 AA axe rules. Rendered screenshots were inspected. Workspace previews used mocked API responses for layout inspection; they do not represent another authentication/business-flow test run. The four full workflow tests were not rerun for this visual-only change.

## Password-free Resource release — 2026-10-08

The confirmed rule applies to every Resource: only Admins and Managers sign in and record resource hours. Public and staff-created Resources have no password. Submission success displays a white checkmark in a green circle and “Thank you for providing your details.” without a sign-in action.

| Current check | Observed result |
| --- | --- |
| Backend regression suite | `./scripts/Test-Backend.ps1`: **24 passed, 0 failed, 0 skipped**, against real MySQL 8.4. Password-free submission has no Set-Cookie, no stored hash/session and a NULL anonymous audit actor. Resource login and forged legacy sessions are rejected. Staff profile edits, cross-staff time corrections/deletion, recorder attribution and concurrent daily caps are exercised. |
| Browser acceptance | `./scripts/Test-Browser.ps1`: **5 passed, 0 failed**, approximately 1.4 minutes. Actual mobile public submission, no password in fields/payload, no session/private access, rejected Resource login, staff profile maintenance, QR download, Admin assignment/hours and Manager password-free creation/deactivation/hours. Forced submission and assignment lookup failures prove recovery and truthful success states. |
| Build and code checks | Release .NET build **0 warnings / 0 errors**; backend formatting, strict TypeScript, zero-warning ESLint and Prettier checks pass. The updated API and Next.js production container builds complete. |
| Dependency audit | NuGet reports no vulnerable API packages; npm reports **0 vulnerabilities**. The first npm audit encountered the corporate certificate chain; retry with `NODE_USE_SYSTEM_CA=1` succeeded with TLS verification retained. |
| Visual/accessibility checks | Actual 390px mobile and desktop thank-you screenshots inspected, as well as desktop staff hours. Completion heading is focused, the green circle/checkmark is visible, public screens have no horizontal overflow, and axe reports zero tested WCAG 2 A/AA and 2.1 AA violations on network, thank-you, hours and sign-in screens. |
| Legacy-data upgrade | Before migration, `tenacom_test` contained **12 Resource credentials, 1 Resource session, 12 profiles, 6 assignments and 12 time rows**. Afterwards it has **0 Resource credentials / sessions, 15 profiles, 7 assignments and 14 time rows**; new regression fixtures explain the additions. Existing data was retained. Migration replay also passes. |
| Main-data preservation | Backed up the main database before migration 003. Before/after checksums match for staff account details/credentials, resource profiles, assignments and time history. The existing main staff account and Resource profile are preserved. Main has **3 applied migrations, 0 Resource credentials and 0 Resource sessions**. No bootstrap, password reset or volume deletion was performed. |
| Deployment | Standard `docker compose up -d --wait --wait-timeout 120` succeeds against `tenacom`, after testing separately in `tenacom_e2e`. Migration exits **0**; MySQL, API and web are healthy. Main database selection is verified; `/login`, proxied `/api/terms` and private `/health/live`/`/health/ready` return **200**. The base Compose configuration publishes only the frontend on loopback port 3000. |
| Cleanup | Source scan finds no TODO/FIXME stubs, debug Console.WriteLine, raw HTML insertion, browser token storage or wildcard CORS grants. Secrets, the local backup and test artifacts remain ignored. The temporary preservation query was removed. Official logo file hash still matches the supplied PNG. |
| Quality process | [Resource submission review](resource-submission-quality-review.md) covers all twenty-two categories: **7.2/10 initial → 8.4/10 final**, after repository changes and actual checks. The original review remains historical. |

The browser tests deliberately keep older synthetic historical entries in the isolated database; their original Resource recorder remains visible after credential removal. New entries are attributed to the acting Admin or Manager. This is preservation of history, not permission for Resources to sign in.

## Current verification limits

The 2026-10-11 [dashboard redesign evidence](dashboard-redesign.md) records the current frontend/backend checks, expanded 13-test Chromium suite, dedicated test databases, independent reviews, and workflow-specific limits. Its results supersede the older dashboard test counts above; historical deployment, security and dependency-audit results are not claimed as newly rerun checks.

No external production hosting, independent penetration test, load/SLA benchmark, restore rehearsal, real-device QR scan, exhaustive screen-reader audit, or remote CI execution is claimed. These operational/validation limits do not replace the required local build, migration, role, workflow and container gates.
