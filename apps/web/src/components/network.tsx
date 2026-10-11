"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Page, Profile, Term } from "@/lib/types";
import { RecordFilter } from "./record-filter";
import { Badge, Empty, Heading, Loading, Notice, Pager, useData } from "./ui";
import { useUser } from "./session";
import { LinkedRow } from "./entity-ui";
import { PersonActions } from "./person-actions";
import { detailHref, useListQuery } from "./list-state";
import {
  useResourceSelection,
  type SelectedResource,
} from "./resource-selection";
import { AssignResourcesDialog } from "./assign-resources-dialog";

export function Network() {
  const actor = useUser();
  const { params, update, href } = useListQuery();
  const [query, setQuery] = useState(params.get("q") || "");
  const [assign, setAssign] = useState<SelectedResource[] | null>(null);
  const selection = useResourceSelection();
  const selectedIds = new Set(selection.selected.map((x) => x.id));
  const page = Math.max(1, Number(params.get("page")) || 1);
  const termIds = (params.get("terms") || "").split(",").filter(Boolean);
  const request = new URLSearchParams({
    q: params.get("q") || "",
    status: params.get("status") || "",
    sort: params.get("sort") || "name",
    terms: termIds.join(","),
    includeInactive: String(params.get("includeInactive") === "true"),
    projectId: params.get("projectId") || "",
    page: String(page),
  });
  const { data, error, loading, reload } = useData<Page<Profile>>(
    `/resources?${request}`,
  );
  const { data: terms, error: termsError } = useData<Term[]>("/terms");
  const visible = data?.items.filter((x) => x.active) || [];
  const allSelected =
    visible.length > 0 && visible.every((x) => selectedIds.has(x.id));
  const someSelected = visible.some((x) => selectedIds.has(x.id));
  const selectPage = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectPage.current)
      selectPage.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);
  const hidden = selection.selected.filter(
    (x) => !data?.items.some((p) => p.id === x.id),
  ).length;
  const clearFilters = () => {
    setQuery("");
    update({
      q: "",
      status: "",
      sort: "",
      terms: "",
      includeInactive: false,
      projectId: "",
      page: 1,
    });
  };
  return (
    <>
      <Heading eyebrow="People & possibility" title="Resource network">
        <Link className="button" href="/invitations">
          Invite a resource ↗
        </Link>
      </Heading>
      <p className="page-intro">
        Find expertise, view professional profiles, and connect resources to
        project teams.
      </p>
      <form
        className="card stack"
        aria-label="Resource filters"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: query, page: 1 });
        }}
      >
        <div className="filters">
          <label className="search">
            Search the network
            <input
              type="search"
              maxLength={100}
              placeholder="Name, expertise, location…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Availability
            <select
              aria-label="Availability"
              value={params.get("status") || ""}
              onChange={(e) => update({ status: e.target.value, page: 1 })}
            >
              <option value="">Any availability</option>
              {["Available", "Limited", "Unavailable"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select
              aria-label="Sort by"
              value={params.get("sort") || "name"}
              onChange={(e) => update({ sort: e.target.value, page: 1 })}
            >
              <option value="name">Name A–Z</option>
              <option value="recent">Recently updated</option>
            </select>
          </label>
          <button>Search</button>
          <button type="button" className="secondary" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
        <details
          open={
            termIds.length > 0 ||
            !!params.get("projectId") ||
            params.get("includeInactive") === "true"
          }
        >
          <summary>
            More filters
            {termIds.length > 0 && ` · ${termIds.length} areas selected`}
          </summary>
          <div className="stack">
            <p className="muted">
              Match every selected field, industry, skill or expertise.
            </p>
            <Notice error={termsError} />
            <div className="term-picker">
              {terms?.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={termIds.includes(t.id)}
                  onClick={() =>
                    update({
                      terms: (termIds.includes(t.id)
                        ? termIds.filter((id) => id !== t.id)
                        : [...termIds, t.id]
                      ).join(","),
                      page: 1,
                    })
                  }
                >
                  {t.kind} · {t.name}
                </button>
              ))}
            </div>
            <RecordFilter
              kind="projects"
              value={params.get("projectId") || ""}
              onChange={(projectId) => update({ projectId, page: 1 })}
            />
            <label className="check-label">
              <input
                type="checkbox"
                checked={params.get("includeInactive") === "true"}
                onChange={(e) =>
                  update({ includeInactive: e.target.checked, page: 1 })
                }
              />
              Include deactivated resources
            </label>
          </div>
        </details>
      </form>
      {actor.role === "Admin" && (
        <section className="selection-bar" aria-label="Resource selection">
          <div className="row between">
            <div>
              <strong role="status">
                {selection.selected.length}{" "}
                {selection.selected.length === 1 ? "resource" : "resources"}{" "}
                selected
              </strong>
              <p className="muted">
                {hidden > 0
                  ? `${hidden} selected resources are outside this page or these filters. `
                  : ""}
                Selection stays across searches, filters and pages.
              </p>
            </div>
            <div className="row">
              <button
                disabled={!selection.selected.length}
                onClick={() => setAssign([...selection.selected])}
              >
                Add selected to Project
              </button>
              <button
                className="secondary"
                disabled={!selection.selected.length}
                onClick={selection.clear}
              >
                Clear selection
              </button>
            </div>
          </div>
          {selection.selected.length > 0 && (
            <details>
              <summary>Review selected resources</summary>
              <ul className="selected-resources">
                {selection.selected.map((x) => (
                  <li key={x.id}>
                    <span>{x.name}</span>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`Deselect ${x.name}`}
                      onClick={() => selection.toggle(x)}
                    >
                      Deselect
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      <Notice error={error} />
      {error && (
        <button className="secondary" onClick={reload}>
          Reload resources
        </button>
      )}
      {loading && <Loading />}
      {data && (
        <section className="card data-card" aria-label="Resources">
          <div className="table-heading">
            <h2>Resources</h2>
            <span className="muted">{data.total} matching resources</span>
          </div>
          {data.items.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {actor.role === "Admin" && (
                      <th className="selection-cell">
                        <input
                          ref={selectPage}
                          type="checkbox"
                          aria-label="Select active resources on this page"
                          checked={allSelected}
                          disabled={!visible.length}
                          onChange={(e) =>
                            selection.selectPage(visible, e.target.checked)
                          }
                        />
                      </th>
                    )}
                    <th>Resource</th>
                    <th>Location & expertise</th>
                    <th>Availability</th>
                    <th>Review</th>
                    <th>
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <LinkedRow
                      key={p.id}
                      href={detailHref("network", p.id, href)}
                      selected={selectedIds.has(p.id)}
                    >
                      {actor.role === "Admin" && (
                        <td className="selection-cell">
                          <input
                            type="checkbox"
                            aria-label={`Select ${p.name}`}
                            checked={selectedIds.has(p.id)}
                            disabled={!p.active && !selectedIds.has(p.id)}
                            onChange={() =>
                              selection.toggle({ id: p.id, name: p.name })
                            }
                          />
                        </td>
                      )}
                      <td>
                        <Link
                          className="entity-name"
                          href={detailHref("network", p.id, href)}
                        >
                          {p.name}
                        </Link>
                        <span className="cell-secondary">
                          {p.headline || "Profile in progress"}
                        </span>
                      </td>
                      <td>
                        <span>{p.location || "Location not added"}</span>
                        <div className="tag-list">
                          {p.terms.slice(0, 3).map((t) => (
                            <Badge key={t.termId}>{t.name}</Badge>
                          ))}
                          {p.terms.length > 3 && (
                            <Badge>+{p.terms.length - 3}</Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge>{p.active ? p.status : "Deactivated"}</Badge>
                      </td>
                      <td>
                        <Badge>
                          {p.reviewStatus === "NeedsChanges"
                            ? "Needs changes"
                            : p.reviewStatus}
                        </Badge>
                      </td>
                      <td>
                        <PersonActions
                          person={{ ...p, role: "Resource" }}
                          back={href}
                          onChanged={reload}
                        />
                      </td>
                    </LinkedRow>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              No resources match these filters. Try a broader search or invite
              someone to the network.
              <div className="row empty-actions">
                <button className="secondary" onClick={clearFilters}>
                  Clear filters
                </button>
                <Link href="/invitations">Invite a resource</Link>
              </div>
            </Empty>
          )}
          <Pager
            data={data}
            onPage={(page) => update({ page })}
            label="Resources pagination"
          />
        </section>
      )}
      {assign && (
        <AssignResourcesDialog
          resources={assign}
          onClose={() => setAssign(null)}
          onAssigned={(ids) => {
            selection.remove(ids);
            reload();
          }}
        />
      )}
    </>
  );
}
