# Security review

This is a source review and automated boundary verification, not an independent penetration test or compliance certification.

| Concern | Implemented control and evidence |
| --- | --- |
| Broken route authorization | Default Staff-authorized API group; Admin policies on project/assignment writes and service checks on user management. API tests deny Manager project writes and privileged staff creation, and reject anonymous/legacy Resource sessions. |
| Resource access | Resources have no credentials or authenticated access. Login and session resolution independently require Admin/Manager; migration 003 deletes old Resource hashes and sessions. API tests forge a legacy Resource cookie and verify 401 on private routes. |
| Privilege escalation | Manager account operations require both old and requested roles to be Resource. Last-admin/self-deactivation rules run under locks. Resource role changes are prevented to retain ownership semantics. |
| Credential handling | No seeded production accounts. Explicit bootstrap uses environment credentials. Staff use ASP.NET Identity versioned salted PBKDF2 hashes, 220,000 SHA-512 iterations, automatic rehash on login. Resource creation stores NULL, never a generated undisclosed password; a database role/credential constraint prevents Resource hashes. Random test credentials remain in ignored local state. |
| Authentication abuse | Account lockout after five failures, endpoint throttling, identical dummy-password work factor, generic sign-in errors, bounded password/body sizes. Expired lockout counters reset. |
| Session/token security | 256-bit random tokens; only digests in MySQL. HttpOnly, SameSite cookies, Secure mandatory in Production, 12-hour expiry. Deactivation, role edits and password changes revoke sessions. |
| CSRF/CORS | Unsafe requests require an exact configured Origin and custom header. No CORS grants. Production rejects HTTP origins and insecure cookies. API tests reject missing headers and production misconfiguration. |
| SQL injection | Every user value is parameterized; only fixed allowlisted sort expressions are interpolated. Route GUIDs are parsed; term IDs are validated before lookup. No query concatenation contains user SQL. |
| Mass assignment | Explicit request DTOs; server controls identity, role on public registration, audit timestamps, verification status and creator IDs. |
| XSS | React text rendering, no raw HTML insertion, same-origin CSP, nosniff, frame denial, no-referrer. CSP currently permits inline scripts required by static Next.js rendering; nonce-based dynamic rendering would further strengthen defense in depth. |
| Public onboarding | Expiring/revocable capacity-limited bearer invitations; use count locked and consumed transactionally. Tokens travel in fragments and are returned once. Password-free Resource profile creation, explicit notice/consent, rate limits and validation. No session cookie is issued. Anonymous resource.submitted audit events have NULL actor. |
| Personal data exposure | No public people directory or Resource access to profiles, assignments or time. Public submission returns only its new profile ID, and vocabulary contains no personal data. Responses never include password hashes or token digests. |
| Staff time entry | Only Admins/Managers record, edit or remove resource time. The selected assignment determines the actual resource lock and daily cap, independent of the acting staff ID. Original recorder ID/name remains visible; each correction/removal audits the current actor. Cross-staff edits and concurrent daily-cap attempts are exercised in real MySQL tests. |
| Logging | No request-body or token logging. Structured failures use type, database error number, trace ID and stack locations without exception data messages. Cancelled requests are not logged as server failures. Audit data contains identifiers and safe action metadata. |
| Concurrent integrity | Invitation row locks, project/assignment overlap checks, current resource status locks, READ COMMITTED daily-time checks under a resource lock, optimistic versions and database constraints. |
| Production defaults | HTTPS origin and secure cookies enforced; no public database/API port in base Compose; non-root application containers; one-shot migrations; readiness/liveness checks. |
| Dependencies | Vulnerable OpenAPI version upgraded; vulnerable lint chain removed. NuGet and npm audits are part of verification evidence. |

The work factor was checked against the [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Tune login capacity on deployment hardware without reducing this minimum; apply edge abuse controls before multiple API replicas.

Before live operation, Tenacom still owns HTTPS hosting, backup/restore rehearsal, secrets injection, retention/erasure policy, operational account recovery and monitoring. Email ownership verification, MFA/SSO, automated password-reset delivery and distributed rate limiting are not implemented requirements of this release; do not represent internal profile review as identity verification.
