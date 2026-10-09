# Engineering quality review

This review records the original implementation under the earlier Resource-login requirement. The user's 2026-10-08 clarification replaces that behaviour with password-free profiles and Admin/Manager time entry. See the [Resource submission quality review](resource-submission-quality-review.md) for the current change, ratings and evidence.

## Cycle 1 — first implementation review

Initial assessment: **6.8/10**. The architecture and workflows were implemented, but compilation alone was insufficient evidence for a deployable system.

| Area | Concrete initial weakness / improvement |
| --- | --- |
| Architecture | Clear modular monolith; SQL mapping assumptions had not been tested against MySQL. |
| Folder/file structure | Cohesive workflows; generated compact frontend source needed consistent formatting. |
| Domain modelling | Assignment and time history explicit; clarify Resource/staff role separation. |
| Database design | Constraints and indexes present; verify migrations twice and concurrency against real MySQL. |
| Backend code quality | Driver's default CHAR(36) coercion broke string ID mapping; make mapping explicit. |
| Frontend code quality | Profile save confirmation disappeared when the form remounted; preserve parent feedback. |
| Type safety | Strict compiler checks passed; null array elements and out-of-range dates needed stronger runtime checks. |
| Security | Vulnerable OpenAPI transitive dependency and lint dependency chain found during checks. |
| Authentication | Cookie/session design sound; sign-in required actual database integration evidence. |
| Authorization | Central policies plus object checks; test Manager escalation and cross-resource access. |
| Validation | Protect against missing dates, malformed profile terms and simultaneous daily overflow. |
| Error handling | Safe Problem Details; stale UI data could remain beside request errors. |
| Mobile UX | Onboarding designed for touch; verify at a real mobile viewport. |
| Desktop UX | Project-history and report filter parameters were initially absent from controls. |
| Accessibility | Labels/focus/landmarks present; add automated checks and visual inspection. |
| Performance | Paginated, no profile N+1 query; substring search remains a measured scaling boundary. |
| Test quality | 20 domain tests passed; full MySQL and browser paths still needed fixes and execution. |
| Docker/infrastructure | Compose parsed; image download failures delayed full-stack verification. |
| Maintainability | Lockfiles and scripts needed validation against actual setup commands. |
| Extensibility | Row-based taxonomy supports new professions; add useful reference vocabulary without rigid categories. |
| Documentation | Architecture documented; operational procedures and exact verification evidence needed completion. |
| Requirement coverage | Functional implementation present; acceptance depends on executed integration/browser/Compose checks. |

Improvements made after this review: upgraded OpenAPI dependencies; removed the vulnerable lint dependency chain and 175 packages; explicit MySQL GUID mapping; stronger profile/date validation; READ COMMITTED plus resource row locking for concurrent daily totals; persistent save confirmation; stale-result clearing; project/resource filter controls; starter taxonomy; secure local setup/test scripts; operational and API guides; automated API/browser tests.

## Cycle 2 — integration and requirement review

Assessment before the final fixes: **7.8/10**. Real-MySQL tests established authentication, role boundaries, stale writes, time editing/deletion and concurrent daily limits. The first browser runs exposed a low-contrast navigation detail and a select label that accidentally included its help text. Full current-release container and browser acceptance remained unproven.

Material improvements implemented in this cycle:

- Raised navigation contrast and separated assignment help text from the accessible label.
- Reduced the first onboarding step by disclosing optional professional details on demand.
- Added explicit loading/error handling to reporting and history screens, plus sign-out failure feedback.
- Matched unknown-account password verification cost to real accounts; raised Identity's SHA-512 work factor to 220,000 iterations; tested lockout and production HTTPS/cookie configuration.
- Preserved the ability to close historical assignments after resource deactivation, while requiring active resources for new assignments.
- Added full-filter time totals independent of pagination, with an API regression assertion.
- Added a protected account-detail route so account creation returns a usable resource location.
- Upgraded Next.js to 16.4.0 after a later audit reported advisories against 16.3.6; removed the earlier vulnerable lint dependency chain.
- Added reproducible browser/database preparation, optional build-time corporate CA trust, CI checks, a source security review, and a requirement-to-evidence map.

At this review, 24 backend tests and frontend lint/type/format checks passed, as did the patched frontend production build. Docker's control API became unresponsive while other projects' containers were running. Container and browser acceptance were still unproven; the final assessment was therefore withheld.

## Cycle 3 — final acceptance and engineering review

Final assessment: **8.4/10** (category mean 8.39, rounded). This is a demanding assessment of the implemented and locally verified release, not a claim of production hosting, independent security certification or an SLA.

The final improvement cycle corrected select accessible names, removed duplicate profile-save announcements, and added loading, failure, retry and empty states to assignment selection in the time form. Time cannot be submitted while assignments are unavailable. The browser workflow now exercises that failure and recovery. Environment files at every directory depth are excluded from image build contexts. Docker recovery and final image builds were completed; 24 backend tests and all four browser tests passed. Formatting, lint, type checks, dependency audits, container health/non-root checks and visual QA supplied the final evidence.

| Category | Score | Remaining concrete weakness / material next improvement |
| --- | ---: | --- |
| Architecture | 8.6 | Explicit SQL and object checks depend on disciplined service boundaries; retain boundary tests when adding routes. |
| Folder/file structure | 8.6 | Some workflow files contain both a screen and its form; split them when either grows materially. |
| Domain modelling | 8.7 | Staff and Resource roles are exclusive; supporting staff time recording would require an explicit additional resource identity model. |
| Database design | 8.5 | MySQL DDL is forward-only rather than atomic; production upgrades need a rehearsed backup/repair procedure. |
| Backend code quality | 8.3 | SQL projection changes can break mapping without compiler errors; extend real-MySQL tests alongside contract changes. |
| Frontend code quality | 8.1 | Workflow state uses local hooks rather than a shared query cache; add caching only if measured repeated requests justify it. |
| Type safety | 8.6 | TypeScript types do not validate external JSON at runtime; the API remains the authoritative validation boundary. |
| Security | 8.3 | CSP permits inline Next.js scripts and rate limits are in-process; nonce-based rendering and trusted edge limits would strengthen a larger deployment. |
| Authentication | 8.2 | MFA/SSO, email ownership checks and automated recovery delivery are absent; select an identity/provider strategy before requiring those capabilities. |
| Authorization | 8.6 | The three-role model is deliberately small; new roles need coordinated central policies and object-level regression tests. |
| Validation | 8.5 | Optional telephone text is bounded rather than region-normalized; introduce normalization only if a verified contact workflow requires it. |
| Error handling | 8.3 | Safe errors require operators to correlate trace IDs with logs; production log aggregation and alerting are deployment work. |
| Mobile UX | 8.3 | Verified at a 390px browser viewport; real-device keyboard and camera/QR behavior need device testing. |
| Desktop UX | 8.3 | Operational search and tables are implemented; saved searches or exports should follow demonstrated user needs. |
| Accessibility | 8.1 | Automated checks and keyboard/focus semantics cover core screens; exhaustive screen-reader and assistive-device review remains unverified. |
| Performance | 7.9 | Substring search and aggregate reports have no load/SLA benchmark; measure realistic data before adopting full-text search or summary tables. |
| Test quality | 8.2 | One comprehensive MySQL workflow has many assertions; split independent scenarios as the suite grows to improve failure isolation. |
| Docker/infrastructure | 8.3 | Local orchestration is verified; external HTTPS hosting, image scanning and backup/restore rehearsal remain operational gates. |
| Maintainability | 8.4 | Dependency/base-image maintenance still needs an operator cadence; lockfiles, audits and CI checks provide the starting point. |
| Extensibility | 8.4 | Taxonomy is row-based, but the vocabulary/recent-invitation views are bounded; add server search/pagination before exceeding documented limits. |
| Documentation | 8.6 | Setup/test commands were exercised locally; provider-specific production instructions require a selected hosting environment. |
| Requirement coverage | 8.7 | All required local workflows and acceptance gates are implemented and verified; operational limits are explicitly recorded in the evidence report. |

The progression is **6.8 → 7.8 → 8.4** over three review/improvement cycles. The score increased because defects were fixed and required gates were executed successfully. No placeholders, unexecuted intentions or earlier partial test runs were counted as completed work.
