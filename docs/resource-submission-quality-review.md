# Resource submission quality review

The user's 2026-10-08 clarification supersedes the original authenticated Resource workflow: all Resources submit professional details without a password or system access. Only Admins and Managers sign in and record resource hours. The original twenty-two-category review and up-to-three-cycle improvement process applies to this change.

## Cycle 1 — requirement and source review

Initial assessment: **7.2/10 against the revised requirement**. The existing staff security and historical data model are sound, but public onboarding creates login credentials, its completion screen directs people to sign in, and only Resource accounts can record hours. This cannot satisfy the revised workflow by hiding a password input alone.

| Category | Concrete weakness / required improvement |
| --- | --- |
| Architecture | Separate profile identity from permission to authenticate; avoid generating undisclosed passwords. |
| Folder/file structure | Remove the obsolete own-profile route and consolidate staff navigation. |
| Domain modelling | Resources must remain searchable/assignable identities while no longer being authenticated users. |
| Database design | PasswordHash is mandatory for every identity; add a forward migration and role/credential constraint. |
| Backend code quality | Registration calls credential-based account insertion; support explicit password-free Resource creation. |
| Frontend code quality | Onboarding requires a password and presents a sign-in action after success. |
| Type safety | Request contracts and UI types must reflect optional staff credentials and password-free submissions. |
| Security | Existing Resource sessions and hashes must no longer permit access. |
| Authentication | Both password sign-in and session resolution must be restricted to staff. |
| Authorization | Time writes currently require Resource role; move them to Admin/Manager with server enforcement. |
| Validation | Preserve consent, invitation limits, bounded profiles and daily time caps. |
| Error handling | A failed submission must retain the form and show an error, never a success acknowledgement. |
| Mobile UX | Remove credential friction; show the requested green-circle checkmark and concise thank-you message. |
| Desktop UX | Staff need to select a resource and assignment before entering hours. |
| Accessibility | Completion needs a clear heading/focus transition; the decorative checkmark must not duplicate announcements. |
| Performance | Avoid Resource password hashing; retain bounded assignment selection and indexed reports. |
| Test quality | Existing tests authenticate Resources; replace those expectations with submission/no-access and staff-time regression coverage. |
| Docker/infrastructure | Verify migration compatibility and deploy API/frontend together without resetting data volumes. |
| Maintainability | Remove obsolete Resource-login branches and wording that could mislead future maintainers. |
| Extensibility | Keep resource identity, assignment and historical entry IDs stable. |
| Documentation | Update permission tables, onboarding/API/security guidance and verification evidence. |
| Requirement coverage | The new rule must cover public submissions, staff-created Resources, existing credentials and time-entry ownership. |

Acceptance at this stage was withheld pending actual migration, backend/browser tests, builds, formatting, lint and visual/accessibility checks.

## Cycle 2 — implementation, regression checks and demanding review

Implemented password-free public submission and staff-created Resource profiles, the requested green-circle checkmark/thank-you screen, staff-only login/session resolution and default API authorization, migration of legacy credentials/sessions, Admin/Manager time entry with original recorder attribution, and removal of the obsolete own-profile page and Resource navigation. Updated the permission, API, architecture, operations and security documentation. A failed submission retains its details and consent until a successful retry.

| Category | Score / 10 | Observed improvement | Remaining weakness / next material improvement |
| --- | --- | --- | --- |
| Architecture | 8.5 | Profile identity and authentication eligibility are explicit across API, UI and database. | Shared Users storage remains a legacy naming compromise; split person and staff credentials if identity requirements expand. |
| Folder/file structure | 8.5 | Removed the obsolete own-profile route; staff profile editing and navigation are consolidated. | Time and people components are sizeable; split them when adding distinct workflows. |
| Domain modelling | 8.3 | Resources have profiles and history without credentials; staff act on their behalf. | Availability and consent retention remain business policies requiring deployment ownership. |
| Database design | 8.5 | Forward migration 003 clears legacy credentials/sessions and adds a role/credential check; preserves relationships. | MySQL DDL is not atomic; operators need backup and forward-repair procedures. |
| Backend code quality | 8.4 | Explicit password-free contracts; staff checks in authentication/time services; parameterized transactional writes. | The comprehensive integration workflow has several assertions in one test; smaller fixtures would improve failure isolation. |
| Frontend code quality | 8.4 | Shared field/filter components, password-free form, success only after confirmed saving, and staff hours UI. | No global form abstraction; extract common state only when more forms justify it. |
| Type safety | 8.6 | Nullable Resource credential storage, password-free submission DTO and recorder response types; strict build passes. | API/frontend contracts are maintained separately; generated client types would reduce drift. |
| Security | 8.3 | No generated Resource password; database constraint, login and session guards agree; no session from submission. | Independent penetration testing and stronger CSP deployment remain unverified. |
| Authentication | 8.5 | Only Admin/Manager passwords and sessions work; existing staff credential checksum retained. | MFA/SSO and automated staff recovery are outside this release. |
| Authorization | 8.8 | Default Staff policy; Admin-only project/assignment writes; Manager user scope retained; forged Resource cookies denied. | Keep policy/object-boundary regression coverage as new endpoints are introduced. |
| Validation | 8.6 | Consent, invitation use limits, profile bounds, assignment dates and cross-staff daily caps remain enforced. | Email ownership and qualifications are not validated by internal profile review. |
| Error handling | 8.5 | Browser tests prove failed saving retains details and only a successful retry shows thanks; lookup reload works. | Offline/resume and multi-tab recovery have not been exercised comprehensively. |
| Mobile UX | 8.7 | 390px actual submission ends at the requested clear green checkmark and message, with no password or sign-in links. | Real-device QR scanning and broader device testing remain outstanding. |
| Desktop UX | 8.5 | Staff select a resource and its assignment, record hours and see original recorder attribution. | High-volume entry might benefit from batch input after measuring staff needs. |
| Accessibility | 8.2 | Thank-you heading receives focus; checkmark is decorative; tested screens have zero axe WCAG violations. | Automated checks do not replace an exhaustive keyboard/screen-reader audit. |
| Performance | 7.8 | Removed Resource password hashing; bounded search/assignment paging and indexed time reporting retained. | No realistic-size load/SLA benchmark; measure query latency before scaling. |
| Test quality | 8.5 | 24 backend and 5 browser tests pass, including actual staff time entry, anonymous submission, failure retry and legacy-cookie denial. | Browser coverage uses Edge on Windows and one mobile viewport; broaden only for supported deployment targets. |
| Docker/infrastructure | 8.4 | Release images build; migration exits 0; main MySQL/API/web healthy; standard private API/database configuration restored. | External TLS hosting, image scanning and backup restoration rehearsal are not demonstrated. |
| Maintainability | 8.3 | Obsolete UI branches removed; staff-only rules and operational migration behaviour documented. | Defensive legacy ownership predicates remain in internal reads; simplify with a larger service-policy cleanup when warranted. |
| Extensibility | 8.1 | Stable Resource/assignment/time IDs and normalized taxonomy support future workflows. | No time approval/payroll lock or tenancy model; those require explicit domain additions. |
| Documentation | 8.5 | Current permission matrix, API contracts, security model, migration guidance and observed verification updated. | Production privacy contact, retention and operational recovery depend on deployment decisions. |
| Requirement coverage | 8.8 | Covers public, staff-created and existing Resources, no login/password, exact acknowledgement and both staff roles entering hours. | External operational certification is outside the requested local application change. |

**Final overall engineering-quality assessment: 8.4/10.** This is an engineering judgement based on observed local evidence, not an automated certification or independent review. The score exceeds 8 after the implemented improvements; no third cycle is needed under the supplied process. The lower performance, accessibility and operational scores reflect unverified scale, assistive-technology and production checks rather than being hidden by passing builds.

## Acceptance evidence

- `./scripts/Test-Backend.ps1`: **24 passed, 0 failed, 0 skipped**, real MySQL 8.4. Staff corrections/removal preserve the original recorder; competing staff entries still respect one resource's daily cap.
- `./scripts/Test-Browser.ps1`: **5 passed, 0 failed**, approximately 1.4 minutes. Includes Admin and Manager hours entry, password-free mobile submission, rejected Resource login, no session cookie/private access, failed-save retry, QR download and error recovery.
- Release build: **0 warnings, 0 errors**; `dotnet format --verify-no-changes`, frontend strict typecheck, zero-warning lint and Prettier checks pass. Current NuGet and npm audits report no vulnerabilities.
- Actual mobile and desktop thank-you screenshots inspected; axe checks pass on tested network, thank-you, tracked-hours and sign-in screens; public screens have no horizontal overflow.
- Main database backed up before migration. Before/after checksums match for staff credentials, resource profiles, assignments and time history. Three migrations are applied, with **0 Resource credentials and 0 Resource sessions**. No database volumes were reset.
- Standard main-database Compose startup completed; migration exited **0** and MySQL/API/web are **healthy**. Detailed evidence and limitations are in [verification](verification.md).
