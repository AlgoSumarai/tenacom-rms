# Independent dashboard review — round 1

Date: 2026-10-11. Reviewer: the separate `dashboard_review` agent, which did not implement the redesign and did not modify implementation files.

## Result

**Overall: 8.25/10.** The reviewed revision meets the numerical acceptance threshold. No critical security, persisted-data integrity, high-severity regression, or broken mandatory workflow was established in this review. There are concrete, noncritical UX defects and useful follow-up improvements below. A passing score does not imply exhaustive coverage.

| Criterion | Weight | Score /10 | Weighted contribution |
| --- | ---: | ---: | ---: |
| Usability and workflow intuitiveness | 25% | 8.0 | 2.00 |
| Functional completeness and correctness | 25% | 8.4 | 2.10 |
| Architecture and code quality | 20% | 8.2 | 1.64 |
| Visual consistency and accessibility | 10% | 8.3 | 0.83 |
| Reliability and regression prevention | 10% | 8.4 | 0.84 |
| Test coverage and validation | 10% | 8.4 | 0.84 |
| **Total** | **100%** | | **8.25** |

## Evidence and mandatory requirements

The reviewer read the full user brief, inspected the tracked diff and relevant new untracked components/routes/tests, and checked the existing account, resource, assignment and permission rules. The Bootstrap-Admin script and its README changes belong to the earlier bootstrap work; they do not contribute to the dashboard score.

| Requirement | Evidence and assessment |
| --- | --- |
| Clickable resource rows, dedicated details, scannable hierarchy, focus/hover/selection, independent actions | `network.tsx`, `entity-ui.tsx`, `profile-detail.tsx`, and shared CSS provide linked rows with native keyboard links and guards around row controls. Existing browser tests exercise cell navigation, keyboard Enter on the link, actions and checkbox clicks. Reviewed resource/people screenshots show clear names, secondary metadata and separate status badges. |
| Return to list with context | `list-state.ts` keeps filters in the URL; `detailHref` carries the originating URL and `returnPath` allows only internal list/project paths. Tests cover availability, expertise, sorting and `/users` filters on return. Resource selection is intentionally scoped to the mounted workspace and survives details/navigation but resets on reload/sign-out. |
| Read-only staff and resource details; explicit editing | Dedicated `ProfileDetail` and `UserDetail` render semantic information and relationships without editable fields. New `/edit` routes contain the forms. Browser tests assert zero standard-detail inputs/selects/textareas and perform successful explicit edits. |
| Consistent contextual actions, permissions, confirmation and unambiguous removal | Shared `PersonActions` offers Edit, Admin-only resource Add to Project and confirmed Remove. The dialog explicitly identifies deactivation and history retention, separate from project association changes. Server endpoint policies, `AccountService.Get/Update`, last-admin/self protections and role-retention rules remain enforced. Managers cannot manage staff or assign resources; tests inspect both UI and API restrictions. |
| Single/bulk assignment regardless of list state | Workspace selection is keyed by ID, independent of query/page. Visible-page selection explicitly means active resources on the current page; hidden selection is counted, reviewable and individually removable, with Clear selection. Tests cover unfiltered views, empty search results, availability/taxonomy/inactive toggles, sorting, pagination and details. The shared assignment dialog searches/paginates eligible projects and stays available with hidden selections. |
| Eligibility, duplicate prevention, partial failure and synchronization | `ProjectService.Assign` retains transactional project/resource locking and server validation for active Resource profiles, planned/active projects, dates and overlapping assignments. The new integration test attempts simultaneous duplicate writes and verifies one success. Nonoverlapping historical assignments to the same project remain valid under existing business rules. The dialog reports individual failures and retries only failures; successful IDs leave selection and list/detail membership queries reload. The browser test verifies a real duplicate failure, subsequent corrected retry and assignment counts. |
| Separate `/users` tables, entity-specific columns, search/filter/sort/page/empty states | `PeopleTable` makes two independent server queries and uses separate URL parameter prefixes. Backend filters are allowlisted and SQL-bound; sort SQL comes only from the allowlist. Staff/resource columns and routing differ appropriately. Managers receive an explanatory staff-access panel rather than a forbidden staff dataset. Browser and integration tests verify separation, filtering and pagination. |
| Dashboard-wide improvements beyond the minimum | Project details/team rows, project list context, searchable paginated assignment choices, invitation/time-removal dialogs, loading/error recovery, notifications, breadcrumbs and profile history links extend the improvements beyond the requested list screens. The original branding remains intact. Recovery and confirmation patterns are improved substantially, although not completely uniform. |

Architecture is reasonably focused: row/menu/dialog, selection, assignment and feedback responsibilities have reusable typed components; no dependency or schema expansion was introduced. `useData` aborts obsolete requests and associates results with request paths, which prevents prior-query rows from appearing as new-query results. Existing backend business logic remains authoritative. The shared controls need stricter form semantics, and the editor still creates avoidable interactions between independent form states.

## Independent browser inspection

The reviewer ran a separate headless Chromium probe in the supplied Playwright Docker image against the **live production test containers**, using synthetic credentials and the isolated E2E database. The probe did not create/delete resource, account, project, assignment or time records. Assignment POSTs were intercepted to prevent unintended writes. Its source is ignored local review scaffolding at `.local/dashboard-review/probe.cjs`; recorded evidence originally resided in `apps/web/test-results/review-round-1-probe.json` and `review-mobile-menu.png`. The probe JSON was preserved as `.local/dashboard-review/round-1-probe.json` before round 2's suite cleared the original output directory.

The live dataset contained 131 resources and 24 eligible projects, enabling actual choice pagination. With valid assignment fields, clicking Next in either the bulk project chooser or project resource chooser emitted **zero submit events and zero assignment POSTs**. Both Next/Previous still have DOM type `submit`; page changes synchronously unmount those buttons, currently suppressing default submission. This is fragile semantic behavior, **not evidence of accidental assignment writes**.

The probe did reproduce an unexpected keyboard interaction: on resource-choice page 2, entering `does-not-exist-review` and pressing Enter changed `131 results · Page 2 of 7` to `131 results · Page 1 of 7`. The search value remained entered and no search was applied. On a 390×844 viewport, the contextual actions popover stayed within the viewport and document overflow was zero.

The reviewer also visually inspected the existing synthetic desktop people, mobile resource-detail and mobile assignment screenshots. Spacing, visual hierarchy, named sections and focus indication are consistent. Mobile tables intentionally scroll within their panels; mobile global navigation also scrolls horizontally and would benefit from a clearer overflow affordance.

## Ranked findings and recommendations

1. **Medium — correct chooser keyboard search and button semantics.** In `record-filter.tsx:45`, the Find input has no Enter handler; in `ui.tsx:117` and `:124`, pagination buttons default to form submission. The live project assignment chooser reproduces Enter navigating backward rather than searching. Set both Pager buttons to `type="button"`, and handle Enter in the nested chooser search by preventing the parent submit and applying its query/page reset. Merely changing Pager types would allow Enter to reach the actual Save assignment submitter instead. Add focused regression tests that fill valid assignment fields before paging and pressing Enter, and assert no assignment write occurs until explicitly submitted. This affects the shared picker used in assignment and hours forms.

2. **Medium — protect drafts across resource editor sections.** `profile-editor.tsx:66` says to save each section separately, but the shared `saved` callback navigates to details after saving any section (`:82`, `:91`, `:104`). A user who edits professional details and contact/review fields before saving one section loses the other unsaved drafts without a warning. This follows directly from the independent local form state and unconditional navigation; it is an unsaved-draft UX issue, not demonstrated loss of persisted data. Keep the editor open with section-level success/refresh, or make only one section editable at a time, or warn before abandoning other dirty sections. Include a multiple-dirty-sections test.

3. **Low — finish permission-aware recovery guidance.** The resource history empty state always says to use the actions menu to add the resource to a project (`profile-detail.tsx`, `ResourceProjects`), although Managers cannot see Add to Project. Give Managers useful permission-aware guidance. `ProjectDetail` returns only loading/error content when its initial fetch fails (`projects.tsx`), unlike staff/resource detail pages with Retry and return navigation. Add that same recovery pattern and a focused project-detail error test.

4. **Low — consolidate remaining confirmation/success interactions.** UserForm deactivation and project archiving still use `window.confirm`, whereas row removal, time deletion and invitation revocation use the new dialog. Project saves also lack the same clear success notice as person/profile saves. Reuse the shared confirmation and feedback patterns when touching these flows, while preserving existing rules. This is consistency polish, not an acceptance blocker.

## Validation assessment and limits

The implementation agent supplied successful backend Release build, all 25 backend unit/integration tests, .NET format, frontend typecheck/lint/format/build and the full 10-test Chromium run. Those full checks were not rerun by the reviewer. The reviewer inspected the relevant test sources, confirmed `apps/web/test-results/.last-run.json` reports passed with no failed IDs, and independently decoded the latest Playwright HTML report: **10 total, 10 expected, 0 unexpected/flaky/skipped, no report errors**. The reviewer also ran `git diff --check` successfully and the separate live browser probe above.

The suites cover the principal mandated journeys and genuine backend constraints rather than only render snapshots. They do not currently cover nested chooser Enter with valid form fields, drafts in multiple editor sections, every shared component consumer under adverse timing, ambiguous network failures after a committed assignment, or every detail-error path. A lost HTTP response after a committed POST may be reported as failure; retry remains duplicate-protected on the server but can leave an unresolved error in the UI. That transport ambiguity was not reproduced and is recorded as a test/recovery limitation, not a proven data-integrity defect.

Accessibility evidence includes native links/dialogs, labeled controls, visible focus, live status/error regions, inspected mobile layouts, and the implementation's executed Axe checks on covered screens. Axe and screenshots do not prove every keyboard/screen-reader journey. Firefox, WebKit, real assistive technology, high-volume performance and a production HTTPS deployment were not exercised here.

**Acceptance blockers: none demonstrated in round 1.** The medium findings should be addressed before calling the experience fully polished; any revision should revalidate the shared form controls and report the independent second-round result honestly.
