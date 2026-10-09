# Deployment and operations

## Release

Build with pinned lockfiles; refresh supported .NET/Node/MySQL base images regularly and scan images before release. Configure HTTPS at a trusted reverse proxy. Publish only the frontend. Set Production, secure cookies, an exact HTTPS origin and appropriate AllowedHosts. Compose binds the frontend to loopback for a local reverse proxy. Configure HSTS at the TLS termination layer. Do not enable wildcard CORS or trust arbitrary forwarded headers.

Use a MySQL account with DDL permission for the migration job and a different account with SELECT/INSERT/UPDATE/DELETE only for the API. Back up, execute the one-shot migration job, then deploy the API and web together. Bootstrap only the first empty database; later staff management uses authenticated administration. Validate `/health/live` and `/health/ready` from the private network. The web health check validates the sign-in page; database readiness must also be monitored independently.

## Backups and restoration

Use your managed MySQL backup/PITR facility when available. For self-hosted deployments, schedule consistent encrypted backups with a dedicated backup account and store them away from the application host. Keep encryption keys separate, restrict restore permissions, and rehearse restoration to an isolated database. Retention and recovery objectives require a Tenacom business decision. Never verify a restore by overwriting a live database. Record migration version and application image digest with each backup.

## Security operations

Deactivate staff to revoke all sessions immediately; deactivate resource profiles to remove them from active discovery and new assignments while preserving history. Invitations can be revoked independently of submitted profiles. Use short invitation lifetimes and small use limits for private introductions. QR links are bearer capabilities: avoid publishing them broadly. They capture Resource details only and grant no login or system access. Admins and Managers maintain details and record hours. Profile review is not identity/email verification. A future email provider can support email ownership and staff password recovery; these are not currently claimed features. Staff account recovery requires a controlled administrator/operator procedure, not database password guessing or public reset tokens.

For the password-free Resource release, migration 003 removes every legacy Resource password hash and session, clears their lockout counters, and constrains Resource credentials to NULL. Staff hashes are retained. Deploy the API and frontend together after this migration. Do not roll back to a credential-requiring API or restore Resource passwords: add a forward fix if needed. Existing profile IDs, assignments and time history remain intact, and staff can maintain historical entries within their assignment dates. Resources request corrections or removal through the person who invited them.

Sessions expire after 12 hours and store only SHA-256 token digests. Password changes revoke every session. Production cookies are Secure, HttpOnly and SameSite=Lax. Mutations require exact Origin and a custom header. Rate limits are in-process and see the reverse proxy's IP in Compose, intentionally conservative for an initial single-instance deployment. For larger deployments use trusted edge limits with documented forwarding rules; do not blindly trust X-Forwarded-For.

Logs include error types and correlation IDs but no request bodies, tokens, profile data or passwords. AuditEvents retain actor, action, entity ID, timestamps and safe action metadata. Restrict database audit access. Treat database backups as personal information. Define deletion/retention policy with Tenacom before live data collection; routine deactivation is not erasure. A lawful erasure operation must be designed to preserve required project aggregates while removing unnecessary personal data.

## Known scale boundaries

Resource search uses indexed taxonomy relationships plus substring text matching. Measure slow queries before replacing text search with a full-text index/search service. Lists are paginated; vocabulary is capped at 5,000 terms and recent invitations at 100. No distributed queue, cache, payroll, billing or multi-tenant isolation is needed for this scope. Multi-replica deployments require shared edge rate limiting. Use load tests against realistic network sizes before committing to an SLA.
