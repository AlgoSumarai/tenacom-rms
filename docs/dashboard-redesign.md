# Dashboard redesign

## Audit and implementation plan

The starting dashboard opens resource profiles in editing mode, mixes staff and resources in one paginated table, and makes project pages the only assignment entry point. Network filters live only in component state, so opening a profile loses list context. Resource selection and bulk actions are absent. Shared data loading can display results from the previous query while a new query is pending.

Mandatory work:

1. Use linked, keyboard-accessible resource rows with independent selection and contextual actions. Keep filters in the URL and selection in the workspace session; visible-page selection never implies selection of all matches.
2. Introduce read-only resource and staff detail pages, explicit editors, and a shared ellipsis menu. Removal means deactivation with confirmation; project and time history remain intact. Staff cannot be assigned because assignments require Resource profiles.
3. Share a project-assignment dialog between lists and details. Search and paginate planned/active projects, keep hidden selections, revalidate through the existing API, and report per-resource failures. Only successful resources leave the selection.
4. Query staff and resources separately on `/users`, with independent search, status, sorting, pagination, and empty states. Retain existing Admin/Manager boundaries.

Additional improvements: consistent detail breadcrumbs and project links, actionable empty/error states, cancellation and loading feedback, selected-row styling, accessible dialogs/menus, and visible confirmation of saves and assignment changes. Reuse these patterns on project details and assignment management. Preserve Tenacom branding.

Engineering work: focused shared row/menu/dialog components; typed selection and assignment state; allowlisted server-side list filters; abort obsolete data requests and avoid rendering stale results. No new runtime dependencies or schema changes were introduced.

Risks and safeguards: protect history and last-admin rules through existing account APIs; retain transactional overlap/date/active-resource validation; suppress double submissions; preserve only safe internal return URLs; exercise both staff roles. Run synthetic workflows against separate test databases rather than the user's database.

## Validation and independent review

Executed on Ubuntu using Docker on 2026-10-11. Native Node/.NET installation was unnecessary. Tests used the dedicated `tenacom_dashboard_test` and `tenacom_dashboard_e2e` databases, with synthetic identities and ignored, owner-readable `.local` configuration files. The normal application database was not used for testing.

| Check | Result |
| --- | --- |
| `dotnet build --configuration Release` | Passed, zero warnings/errors |
| `dotnet test --configuration Release --no-build --verbosity minimal` | 25 passed, zero failed/skipped; includes MySQL integration tests |
| `dotnet format --verify-no-changes --no-restore` | Passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run format:check` | Passed |
| `npm run build` through the web Dockerfile | Passed, including new detail/editor routes |
| `npm run test:e2e` against the revised production container build | 13 Chromium tests passed in 59.3 seconds; no retries/skips |
| `git diff --check` | Passed |
| Final local stack | `docker compose up -d --wait --wait-timeout 120` passed; MySQL/API/web healthy, migration exited 0 |
| Final HTTP smoke checks | `http://localhost:3000/login` and proxied `/api/terms` both returned 200 |

Browser coverage in `apps/web/tests/dashboard.spec.ts`, plus the updated existing workflows, proves resource row and keyboard navigation; read-only resource/staff details and explicit editors; contextual actions; selection across search, availability/taxonomy/inactive toggles, sorting, pagination and detail navigation; single and bulk assignment with real duplicate rejection and partial-failure retries; separate people tables and independent list state; cancellation/deactivation/history retention; Manager restrictions; recoverable list/project errors; and confirmed time removal/invitation revocation. Existing public onboarding, profile management, project assignment, and hours workflows also pass. Axe checks pass for the covered desktop/mobile screens and assignment dialog; mobile resource and assignment checks show no page overflow. Wide tables scroll within their own panels.

Validation found and corrected an exact-label problem, mobile overflow from an absolutely positioned hidden table heading, automatic scroll dismissing an actions menu, and an asynchronous URL-update race affecting rapid filter changes. Filter updates now use Next's integrated native history support with a synchronous URL subscription. Early test-host allowlisting and URL-space assertion issues were fixed in the isolated harness/tests. Formatting and lint failures introduced during implementation were resolved before the final successful checks. The expanded browser tests initially needed a scoped error assertion to exclude Next's route announcer and a precise accessible name for project Status; both were corrected. A subsequent run stalled under Docker VM memory pressure when a production image build overlapped Chromium. The concurrent build was cancelled, and the entire suite then passed sequentially with no test retries.

The latest browser result is also recorded in ignored `apps/web/test-results/.last-run.json`; screenshots include `dashboard-resource-mobile.png`, `dashboard-people-desktop.png`, and `dashboard-assignment-mobile.png`. These contain synthetic data.

Independent [review round 1](dashboard-review-round-1.md) scored **8.25/10**, with no demonstrated critical acceptance blockers. The independent reviewer inspected the implementation, screenshots, completed test report and live production test containers. It reproduced a keyboard-search defect and identified avoidable draft loss between simultaneous editor sections, incomplete permission/error guidance and confirmation inconsistencies.

Corrections made after round 1:

- Shared pagination buttons explicitly use `type="button"`. Enter applies the nested record-picker search and resets its page without submitting the enclosing assignment/time form.
- Resource editing presents one section at a time. Switching sections or cancelling prompts before discarding a dirty draft; saving locks section navigation. Professional details, account settings and reviews retain their separate APIs and version rules.
- Project details include return navigation and Retry on fetch failure. Resource-history empty guidance explains that only administrators can assign resources.
- Account deactivation and project archiving use the shared async confirmation dialog, retaining errors in the dialog and preventing repeated submits. Project create/update operations report success.
- New browser regressions cover valid assignment forms with pagination/Enter, explicit-write counting, project-detail recovery, section draft protection, deactivation/archive cancellation and confirmation, and Manager guidance.

Independent [review round 2](dashboard-review-round-2.md) scored **8.60/10** (weighted raw score 8.595) and accepted the revised implementation. It verified every round-1 correction, independently exercised the revised live flows, inspected mobile layout/Axe results and confirmed the recorded 13-test report contains no failures, flakes or skips. No critical acceptance blockers were found; a third review was unnecessary.

The definition of done is met: all mandatory groups are implemented, additional dashboard workflows improved, required checks pass, and a separate reviewer accepted the work above 8/10 within two rounds. The current application is running at **http://localhost:3000** against its normal database; synthetic testing used separate databases. The final production images were built and started after browser validation/review. Temporary review app containers were removed after review; ignored test configuration, synthetic databases and evidence remain available for reproducibility. No dependency audit, remote deployment or cross-browser run is claimed by this dashboard work.

## Behaviour and limits

- Select-page affects only active resources visible on that page. Hidden selections remain listed and individually removable; Clear selection removes all selections. Successful assignments leave the selection, while failures stay selected. Selection survives workspace navigation and resets on a full reload/sign-out. URL-based filters survive reloads and returning from detail pages.
- Only Admins assign resources. Staff accounts cannot be assigned to projects under the existing relationship model. Managers can manage Resource profiles; they cannot inspect/manage other staff accounts.
- Remove deactivates a person. It retains project associations and time history, and is distinct from editing an assignment. Reactivation remains available in the explicit editor. Self-deactivation, last-admin and version-conflict protections remain enforced on the server.
- New assignments accept active Resource profiles and planned/active projects. Date and overlap rules remain transactional in the existing API. Separate, non-overlapping historical assignments to the same project remain allowed. Bulk operations report individual outcomes and retry only unsuccessful resources.
- Browser validation covered Chromium at desktop and 390px mobile widths. Other browser engines and a production HTTPS deployment were not exercised in this task.
- Draft confirmation covers resource-section switches and explicit Cancel. Browser reload, tab closure and navigation through unrelated workspace links do not persist drafts or provide a universal navigation guard.
- An ambiguous network failure after a committed assignment can still appear as unsuccessful. Server overlap validation prevents duplicate writes on retry; the reviewer recorded this as an untested transport-recovery limitation.
