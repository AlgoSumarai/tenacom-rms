# Requirement coverage

This maps the supplied forty-section brief to concrete source and verification. Execution results and environment limits are recorded separately in [verification](verification.md); a source mapping alone is not a passing test claim.

The user's 2026-10-08 clarification supersedes the original Resource authentication/self-service requirements: **all Resources submit details without passwords or login; only Admins and Managers sign in and record resource hours**. The mappings below reflect this accepted change. The [Resource submission quality review](resource-submission-quality-review.md) applies the original twenty-two-category rating process to it.

| Brief sections | Concrete implementation / evidence |
| --- | --- |
| 1–2, 40: Capture professionals before projects; complete resource-to-work workflow | Independent ResourceProfiles; `/join`, `/network`, `/projects`, `/hours`; API WorkflowTests and Playwright workflow.spec.ts |
| 3: Dedicated QR onboarding | Revocable expiring Invitations with transactional use counts; fragment token links; downloadable QR PNG; separate mobile `/join` and browser onboarding test |
| 4: Required supported stack | .NET 10 API project, MySQL 8.4 Compose service, Next.js 16 and strict TypeScript, multi-stage Dockerfiles; version/compatibility checks and dependency audits |
| 5–7: Roles, Admin and Manager capabilities | Central route policies in Program.cs, account/object rules in services; users/network/project/hours/invitation screens; API and Manager browser boundary tests |
| 8–9: Revised Resource experience and normalized expertise | Password-free progressive public submission; green-circle checkmark and thank-you acknowledgement; staff profile editor; ProfileTerms / VocabularyTerms with Field/Industry/Skill/Expertise, optional proficiency/years and extensible staff vocabulary |
| 10: Discovery | ProfileService.Search, indexed EXISTS taxonomy/project filters, q/status/project/history/inactive filters, stable sort and pagination; `/network` and API/browser search checks |
| 11–12: Projects and many-to-many history | Projects plus explicit Assignments with role/date ranges; overlapping ranges rejected; inactive-resource history can be closed; project edit/complete/archive UI and API tests |
| 13: Time and totals under revised staff-entry rule | Admin/Manager record/correct/remove dated integer-minute TimeEntries for selected resources and assignments; original recorder retained, resource row lock and READ COMMITTED daily cap, soft deletion and actor audit trail; grouped/full-filter totals and concurrency/reporting tests |
| 14: Validation and review | HTML constraint feedback, authoritative Rules/application checks, MySQL constraints; Pending/Verified/NeedsChanges reviews; profile edits reset review, tested in API workflow |
| 15–16: Mobile design and brand | Dedicated onboarding, large controls, responsive layouts; navy/blue/Manrope family from Tenacom website; mobile overflow test and rendered screenshots |
| 17: Frontend engineering | Server route/layout files plus focused interactive workflow components, strict TS types, central data access/session, loading/empty/error/success states; typecheck/lint/build/Playwright |
| 18: Backend engineering | Api/Application/Domain/Infrastructure boundaries, DTOs, parameterized async SQL, DI, cancellation, centralized safe Problem Details; compile and API integration tests |
| 19: Database | Embedded ordered/checksummed SQL migrations, advisory lock, primary/foreign/unique/check constraints and search/report indexes; real MySQL migration replay and workflow |
| 20–21, 37: Security and privacy | [Security review](security-review.md), staff-only HttpOnly sessions and password hashing/lockout, migration removes legacy Resource credentials/sessions, CSRF checks, minimal public data and no sensitive request logging; abuse and boundary tests |
| 22: Auditability | UTC metadata and transactional AuditEvents for registration, user/profile/project/assignment/time mutations; audit assertions in integration test |
| 23: REST and docs | Consistent resource routes, generated staff-protected OpenAPI, pagination and filters; [API guide](api.md); OpenAPI availability assertion |
| 24: Observability | Structured error type/database code/trace/stack logging, cancellation handling, separate live/ready health endpoints and container checks |
| 25: Containers | Frontend/API/MySQL plus one-shot migration job, health-gated dependencies, persistent volume, loopback development ports, non-root app images, build-time CA secret option |
| 26–27: Tests and accessibility | RulesTests, ProductionConfigurationTests, real-MySQL WorkflowTests; browser onboarding/Admin/search/project/assignment/time/Manager/error tests; axe WCAG checks and visual QA |
| 28: Performance | Bounded pages, bulk profile-term read, relationship/date indexes, no unbounded people/project/time API responses; full-filter totals independent of pagination; scale limits documented |
| 29–30: Code and repository quality | Cohesive monorepo, formatting, strict compiler/lint checks, dependency lockfile, ignored secrets/generated output, README and operational scripts |
| 31–33: Architecture and implementation process | [Architecture](architecture.md) documents initial domain, permissions, schema, assumptions, API/UI boundaries and vertical implementation plan; workflow components are backed by real API services |
| 34: Definition of done | Explicit current-state acceptance checks in [verification](verification.md); completion remains conditional on every required gate |
| 35–36: Quality review and improvement | [Original quality review](quality-review.md) and [revised Resource submission review](resource-submission-quality-review.md) record initial scores, concrete weaknesses, implemented changes and subsequent review evidence |
| 38: Cleanup | Formatting/lint/type/build checks; source scan for debug logs, dead TODOs, unsafe HTML and token storage; `.gitignore`, `.gitattributes`, placeholder-only `.env.example` |
| 39: Final engineering report | Architecture, model, security, test evidence, assumptions, review results and remaining operational limits are documented and summarized at handoff |

No payroll/billing, public people directory, multi-tenancy or compliance workflow is implied. Profile review records a team assessment; it does not assert identity, email ownership or qualification verification. These scope interpretations are explicit in architecture and operations documentation.
