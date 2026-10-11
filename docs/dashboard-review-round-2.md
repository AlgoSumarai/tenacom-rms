# Independent dashboard review — round 2

Date: 2026-10-11. Reviewer: the separate `dashboard_review` agent, which did not implement either revision and did not edit implementation files.

## Result

**Overall: 8.60/10. Accepted under the requested review rubric.** No broken mandatory workflow, critical authorization/security defect, persisted-data integrity defect, high-severity regression, or failing required validation attributable to these changes was established. The remaining recommendations are nonblocking. This is the second of at most three permitted independent rounds; a third round is unnecessary for the reviewed revision.

| Criterion | Weight | Score /10 | Weighted contribution |
| --- | ---: | ---: | ---: |
| Usability and workflow intuitiveness | 25% | 8.6 | 2.150 |
| Functional completeness and correctness | 25% | 8.7 | 2.175 |
| Architecture and code quality | 20% | 8.4 | 1.680 |
| Visual consistency and accessibility | 10% | 8.5 | 0.850 |
| Reliability and regression prevention | 10% | 8.6 | 0.860 |
| Test coverage and validation | 10% | 8.8 | 0.880 |
| **Total** | **100%** | | **8.595, rounded to 8.60** |

The improved score reflects verified corrections and additional regression coverage, not an assumption that passing tests prove the entire application correct.

## Scope and mandatory acceptance audit

The complete original attachment and its dashboard-wide objective remain the review scope. Round 1's detailed architecture/business-rule and mandatory-requirement audit remains applicable; round 2 inspected the current revision, the changed shared controls and editor flows, tests and API/verification documentation, and exercised the revised live UX independently.

| Requirement group | Current evidence and assessment |
| --- | --- |
| Resource rows/details/navigation/list context | Linked rows still provide native keyboard links, hover/focus/selection and independent action/checkbox behavior. Details remain structured and read-only with contact, expertise and paginated project history. Safe internal return URLs preserve list queries; tests verify filter restoration and selection on return. |
| Read-only user details and contextual actions | Staff/resource detail and `/edit` routes remain distinct. Shared person actions retain Edit, permitted Add to Project, and explicitly confirmed deactivation with history retained. Staff cannot be assigned under the existing relationship model. The server continues enforcing Staff/Admin boundaries, Manager resource-only management, self/last-admin protections and version conflicts. |
| Single/bulk assignment with filters/search/sort/pages | ID-based workspace selection is independent of list results, including hidden rows. Visible-page selection, hidden counts, individual deselection and Clear selection have explicit semantics. The full browser suite retains tests across empty search results, taxonomy/availability/inactive toggles, sorting, pagination and navigation. Assignment remains available from the list without removing filters. Independent round-2 probes also verify project/resource chooser paging and Enter with a valid assignment form do not write assignments. |
| Eligibility, duplicates, partial failures and synchronization | The shared dialog still uses eligible planned/active projects, per-resource outcomes, retry of only failed resources and successful-selection removal. Backend transactions retain active-resource/date/overlap validation and duplicate prevention. Existing integration/browser tests include simultaneous duplicates, real partial failure, corrected retry and assignment counts. Nonoverlapping historical memberships remain intentionally permitted. List/detail membership reload callbacks are retained. |
| `/users` staff/resource separation | Separate server queries, tables, entity-appropriate columns, independent URL state, search/status/sort/page controls and empty states remain intact. Admin/Manager permissions and routing to the appropriate dedicated detail views are preserved. The expanded Manager test also verifies permission-aware empty-history guidance. |
| Additional dashboard improvements | Breadcrumbs, contextual project/team actions, paginated searchable assignment choices, recoverable list/detail errors, profile history links, shared destructive dialogs and save notifications extend across resources, people, projects, tracked hours and invitations. Resource editing now focuses one section at a time. Branding and existing data/API models are retained. |
| Architecture, reliability and accessibility | Typed focused shared components, abortable/path-associated data fetching, allowlisted/bound backend list filters and existing transactional business rules remain. The revision corrects implicit form submission semantics and reduces competing editor state. Native links/dialogs, labels, visible focus and live notifications remain; independent mobile draft-dialog Axe and overflow checks passed. |

## Round-1 findings and corrections

1. **Chooser keyboard/pagination behavior: corrected and independently reproduced.** Both shared Pager buttons now explicitly use `type="button"`. RecordFilter prevents Enter from submitting its parent, applies the chooser query and resets page. On the live revised runtime, the previous failing sequence now changes `219 results · Page 2 of 11` to `0 results · Page 1 of 1` for the nonexistent search. There were zero submit events and zero intercepted assignment POSTs during valid-form paging/search. The added browser test independently counts actual writes: none before explicit Save/Assign, then exactly the expected writes.

2. **Competing editor drafts: corrected for section switches and explicit Cancel.** ProfileEditor renders one of professional/account/review forms, tracks changes, confirms discard before switching or cancelling, and disables section changes while saving. The reviewer independently entered professional and account drafts, cancelled section changes and editor exit, and observed the entered values preserved with only one editor form mounted. A subsequent API read confirmed the unsaved email remained unchanged in the database. The added real E2E test also saves account/review changes through the actual APIs.

3. **Permission/error guidance: corrected.** ResourceProjects distinguishes Admin guidance from the Manager instruction to request an administrator. The Manager browser test verifies that text and the absent assignment control. ProjectDetail now provides return navigation and Retry in its failed initial load. The independent reviewer injected a 503, verified the exact originating projects-search URL on the return link, removed the failure and used Retry to restore the real project.

4. **Confirmation/success consistency: corrected.** Account deactivation and project archiving use the shared async ConfirmDialog, while project creation/update uses workspace success feedback. Form fields/save controls disable during a request; errors from confirmed operations propagate into the dialog. The new browser test verifies cancellation leaves actual account/project state unchanged, confirmation changes it, project save feedback appears and an archived project loses its assignment action. Existing API rules are unchanged.

## Independent live inspection and validation evidence

The reviewer ran a separate Chromium probe against `tenacom-dashboard-web` and `tenacom-dashboard-api` on the dedicated test network/database. Its assignment POST interception prevented unintended writes; no resource, staff account, project, assignment or time record was created, updated or deleted by this probe. The evidence is preserved outside Playwright's clearing output directory:

- `.local/dashboard-review/probe-round-2.cjs`
- `.local/dashboard-review/round-2-probe.json`
- `.local/dashboard-review/round-2-mobile-draft-dialog.png`
- `.local/dashboard-review/round-2-mobile-menu.png`

At 390×844, the draft-discard dialog and contextual menu stayed within the viewport, with zero document horizontal overflow. The draft dialog's tested Axe WCAG A/AA rules reported zero violations. The reviewer inspected its screenshot: clear title/explanation, distinct Cancel/destructive action, readable spacing and the inactive editor visibly behind the modal. Cancellation preserves drafts; explicit discard allows the intended section change.

The reviewer independently decoded the latest Playwright HTML report: **13 total, 13 expected, 0 unexpected, 0 flaky, 0 skipped, no report errors**. The last-run JSON also reports passed. Test sources include the original core/permission/partial-failure workflows and three new regressions for valid-form chooser behavior, editor drafts and shared confirmation/recovery. `git diff --check` passed during review.

The implementation agent executed and reported current frontend typecheck, lint, formatting and production staging build as passed, followed by the full 13-test Chromium run in 59.3 seconds. Backend Release build, all 25 backend unit/integration tests and .NET formatting passed before round 1; the backend implementation/tests have not changed since that passing validation. The reviewer did not rerun those whole build/unit/integration gates and does not present them as independent executions. The final sequential browser run supersedes a prior timeout while a separate image build competed with Chromium for Docker VM memory. No retries were used to obtain the passing run.

## Ranked remaining recommendations and limits

1. **Low — extend draft protection to more exit paths if needed.** The editor guards section changes and explicit Cancel, as verified. Breadcrumb links, unrelated workspace navigation, browser reload/back and tab closure can still abandon an unsaved draft without this confirmation. The implementation report discloses that scope. A future shared navigation guard or draft persistence could make this more consistent, with focused tests for each supported exit; persisted data is unaffected.

2. **Low — improve recovery from an ambiguous committed assignment response.** A response lost after the server commits can still be shown as failure, while retry is duplicate-protected and may return overlap rejection. No such transport failure was reproduced, and this is not a proven duplicate/data-integrity bug. Membership reconciliation after ambiguous errors would make recovery clearer; test an actual committed request followed by a lost response before changing the behavior.

3. **Low — broaden accessibility/browser and responsive-navigation validation.** The covered Chromium desktop/mobile screens and modal Axe rules pass, but automated Axe is not an exhaustive keyboard/screen-reader audit. Mobile navigation/table scrolling could communicate offscreen content more clearly. Firefox/WebKit, assistive technology, real devices, high-volume performance and a production HTTPS deployment remain unverified.

These limits do not undermine the verified mandatory workflows or the acceptance score. **No unresolved critical acceptance blocker was found; the reviewed revision passes independent review in round 2.**
