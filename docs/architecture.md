# Architecture and decisions

## Scope and assumptions

Tenacom's professional network is independent of employment or project allocation. A Resource identity has one profile and may have no projects. Only Admins and Managers authenticate. They maintain resource details, review profiles, manage invitations/vocabulary, and record or correct resource hours. Only Admins change projects/assignments and staff roles. Resources submit details through public invitations without a password and receive a thank-you acknowledgement; corrections go through the inviting team member. This implements the user's 2026-10-08 clarification, superseding the original Resource login and self-service time flow. There is no payroll, billing, public directory, or tenant model.

Verification means an internal profile review (Pending, Verified, NeedsChanges), not proof of identity, email ownership, or qualifications. Profile changes reset review to Pending. Onboarding requires explicit permission to retain professional information; privacy text describes purpose and who can access it. Deployment owners must set a real privacy contact and retention policy.

## Domain and schema

Users retain shared person identities with a role and active flag. Admin/Manager rows require a password hash; Resource rows require a NULL hash under a database check constraint. Only staff can resolve sessions. ResourceProfiles share their User primary key, so credential removal does not replace profile, assignment or historical time IDs. Migration 003 clears legacy Resource hashes/lockout counters and removes their sessions. VocabularyTerms use an extensible kind (Field, Industry, Skill, Expertise); ProfileTerms relate many terms to a profile and retain proficiency and years of experience. Vocabulary values are rows, never hard-coded professions or comma-separated storage.

Projects have a unique code, dates, status and version. Assignments join a ResourceProfile to a Project with a date range and role description. A resource can return to the same project through a new non-overlapping assignment. TimeEntries reference assignments and keep date, minutes, notes, creator, update metadata and a soft-delete timestamp. Changes are audited. Database checks enforce positive duration, ranges, vocabularies and roles. Resource-row locks serialize daily hour changes so concurrent entries cannot exceed 24 hours across assignments.

Invitations are reusable business-card links with expiry and maximum uses. Only SHA-256 token digests are stored; tokens contain 256 random bits, are returned once, and travel in the URL fragment so they do not appear in server access logs. Submission consumes a use in a transaction, creates a Resource profile with no credentials, and sets no session cookie. Anonymous submission audits use a NULL actor and the created profile as entity. Staff-created Resource profiles also have no password. Staff accounts require a strong initial password supplied securely by the operator; staff can change it. No production password is seeded.

## Boundaries

A modular monolith under apps/api has Domain rules, Application services/contracts, Infrastructure database/authentication/migrations, and thin API route groups. MySqlConnector and Dapper provide parameterized asynchronous SQL with cancellation. Explicit SQL migrations avoid coupling framework support to an EF provider release; migration checksums and MySQL advisory locks make deployment repeatable. DDL migrations are forward-only and must be backed up before upgrades (MySQL DDL is not transactionally rolled back).

Next.js App Router renders layouts on the server; interactive workflow components handle forms and filters. A same-origin /api reverse proxy keeps browser cookies first-party. The API is not exposed by default in Compose. There is no browser token storage. Opaque HttpOnly SameSite=Lax cookies reference revocable database sessions. Each request resolves current user role/activity. Unsafe requests require an exact configured Origin and a custom header; no CORS is enabled. Production requires HTTPS and secure cookies. Password hashing uses ASP.NET Core Identity's versioned PBKDF2 hasher. Login has per-account lockout plus endpoint rate limiting. Error responses use Problem Details and trace IDs, never SQL or exception content.

## Search and reporting

Staff search by name, professional summary, location, status, project history, and multiple taxonomy terms. Terms use AND across selected values. Results are bounded and paginated with stable sorting. Indexed relationship tables support EXISTS filters; substring text search is acceptable for the initial network size and can be replaced by full-text search if measured query latency warrants it. Reports group time by resource and project, filtered by inclusive dates; minutes are canonical and hours are derived.

## UI and brand

Reference inspected 2026-10-07: https://tenacom.vercel.app/ and its published stylesheet. Core colours: navy #07111b, raised navy #0c1a26, paper #dbe1e3, blue #2a82be. Manrope is the main family; compact metadata uses a monospace fallback. Application forms use brighter surfaces, strong contrast and visible focus. Staff see Network, Projects, Hours, People & access and Invitations. Public onboarding uses short logical sections with review and consent before submission, with optional details progressively disclosed. Successful saving clears the invitation fragment and focuses the thank-you heading beneath a decorative white checkmark in a green circle. Failed saving retains details and displays a recoverable error.

The supplied official Tenacom logo is stored unchanged at `apps/web/public/branding/tenacom.png`. A shared BrandLogo component displays it on sign-in, onboarding and the workspace sidebar. CSS excludes its surrounding whitespace from the visible frame while preserving the mark, wordmark, colours and proportions.

## Implementation and verification plan

1. Schema, configuration, authentication, policies and container foundation.
2. Invitations, password-free submission, staff profile editing and taxonomy.
3. Resource discovery, staff account management and profile review.
4. Projects and assignment history.
5. Time-entry rules, editing/deletion and grouped reports.
6. Responsive UI, accessible errors/loading/empty states.
7. Domain and MySQL API integration tests, browser critical paths, builds, lint, Compose smoke tests.
8. Dedicated security/quality review, up to three improvement cycles, final evidence report.

## Operations

Database-backed sessions survive API restarts and support immediate revocation. Initial administrator creation is an explicit CLI operation using environment-provided credentials, allowed only on an empty user database. Runtime credentials should not hold DDL privileges in production; run migrations as a separate release job. Single API instance rate limiting is suitable for initial deployment; multiple replicas require shared edge limits. Health checks distinguish liveness from database readiness. All date-only work records use the user's entered business date, while audit timestamps use UTC.
