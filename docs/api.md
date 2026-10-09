# API guide

All routes below have `/api` prefix. JSON uses camelCase. Use the session cookie; clients should not store tokens in local storage. For every unsafe method send `Origin` equal to the configured application origin and `X-Tenacom-Request: 1`. Login and onboarding also require these CSRF controls. Authentication failures return 401; role violations 403; non-owned profile/project lookup 404. Validation returns 400, duplicate/stale writes 409, throttling 429 and unexpected failures 500 with an opaque traceId. Error bodies follow Problem Details.

| Routes | Methods / behaviour |
| --- | --- |
| `/auth/login`, `/auth/logout`, `/auth/password` | POST; Admin/Manager sign-in, revoke current session, change staff password and revoke all sessions |
| `/auth/me` | GET current account |
| `/onboarding` | Anonymous POST with invitation token, email, consent, structured profile and honeypot website; no password or session cookie |
| `/terms` | GET vocabulary, POST new term (staff) |
| `/users`, `/users/{id}` | Staff GET paged people or authorized detail, POST person, PUT edit/deactivate; Resource creation omits password, staff creation requires it |
| `/resources`, `/resources/{id}` | Staff GET search/profile, PUT profile by ID |
| `/resources/{id}/review` | Staff PUT review status and internal feedback |
| `/invitations`, `/invitations/{id}` | GET latest 100, POST create, DELETE revoke |
| `/projects`, `/projects/{id}` | GET paged projects/detail, POST create, PUT edit/archive |
| `/assignments` | GET paged assignments; projectId/resourceId filters |
| `/projects/{id}/assignments` | POST assignment |
| `/projects/{projectId}/assignments/{id}` | PUT role/dates, preserving resource/project identity |
| `/time-entries`, `/time-entries/{id}` | Admin/Manager GET paged entries, POST resource hours, PUT corrections, DELETE with version query; original createdBy/createdByName retained |
| `/reports/hours` | GET paged resource/project aggregates |

Resource search accepts `q`, `status`, `terms` (comma-delimited query IDs; storage remains relational), `projectId`, `includeInactive`, `sort=name|recent`, `page`. User/project search accepts q/page. Time and reports accept resourceId/projectId/start/end/page. Only Admins and Managers have system access; Resource passwords and legacy sessions are rejected. Apart from login, onboarding and vocabulary, the `/api` group requires staff authorization. Dates use ISO YYYY-MM-DD and ranges are inclusive. Pages are capped to 20 (network/users/projects) or 50 (assignments/time/reports); responses contain items, total, pageNumber, pageSize.

Profile updates include name, headline, summary, phone, location, status, terms and version. Each term includes termId, proficiency, and optional years. Terms use Learning/Practitioner/Advanced/Expert. Work is integer minutes, 1–1440, constrained to the assignment date range and no future dates in Africa/Johannesburg. Sum across a resource's projects is capped at 1440 minutes per date under a row lock. Versioned PUTs must include the last-read version. Conflicts require reloading and reconciling changes.

OpenAPI at `/openapi/v1.json` is generated from the backend contracts and requires staff authentication. `/health/live` and `/health/ready` are anonymous private-network health endpoints.

Hours reports also return `totalMinutes`, aggregated over every entry matching the filters, regardless of pagination. Filter by resource, project and/or date range to obtain individual, project or network totals. Soft-deleted entries are excluded; deactivated resources' historical work remains included.
