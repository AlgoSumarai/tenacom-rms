"use client";
import { useState } from "react";
import Link from "next/link";
import type { Page, Profile, Term } from "@/lib/types";
import { RecordFilter } from "./record-filter";
import { Badge, Empty, Heading, Loading, Notice, Pager, useData } from "./ui";
export function Network() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    sort: "name",
    terms: [] as string[],
    includeInactive: false,
    projectId: "",
  });
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({
    ...filters,
    terms: filters.terms.join(","),
    includeInactive: String(filters.includeInactive),
    page: String(page),
  });
  const { data, error, loading } = useData<Page<Profile>>(
    `/resources?${params}`,
  );
  const { data: terms } = useData<Term[]>("/terms");
  return (
    <>
      <Heading eyebrow="People & possibility" title="Resource network">
        <Link className="button" href="/invitations">
          Invite a resource ↗
        </Link>
      </Heading>
      <section className="hero-strip">
        <div>
          <h2>Expertise for what comes next.</h2>
          <p>Discover the people who can move your next project forward.</p>
        </div>
        <div>
          <span className="metric">{data?.total ?? "—"}</span>
          <br />
          <small style={{ color: "#afc0cc" }}>matching resources</small>
        </div>
      </section>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...filters, q: query });
          setPage(1);
        }}
      >
        <div className="filters">
          <label className="search">
            Search the network
            <input
              type="search"
              placeholder="Name, expertise, location…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Availability
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPage(1);
              }}
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
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            >
              <option value="name">Name A–Z</option>
              <option value="recent">Recently updated</option>
            </select>
          </label>
          <button>Search</button>
        </div>
        <details>
          <summary>
            Filter by field, industry, skill or expertise{" "}
            {filters.terms.length > 0 && `(${filters.terms.length})`}
          </summary>
          <div className="term-picker">
            {terms?.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={filters.terms.includes(t.id)}
                onClick={() => {
                  setFilters({
                    ...filters,
                    terms: filters.terms.includes(t.id)
                      ? filters.terms.filter((id) => id !== t.id)
                      : [...filters.terms, t.id],
                  });
                  setPage(1);
                }}
              >
                {t.kind} · {t.name}
              </button>
            ))}
          </div>
          <p className="muted">
            <small>Results match every selected area.</small>
          </p>
          <RecordFilter
            kind="projects"
            value={filters.projectId}
            onChange={(projectId) => {
              setFilters({ ...filters, projectId });
              setPage(1);
            }}
          />
          <label className="check-label">
            <input
              type="checkbox"
              checked={filters.includeInactive}
              onChange={(e) => {
                setFilters({ ...filters, includeInactive: e.target.checked });
                setPage(1);
              }}
            />
            Include deactivated resources
          </label>
        </details>
      </form>
      <Notice error={error} />
      {loading && <Loading />}
      {data && (
        <>
          <div className="row between">
            <p className="muted">
              {data.total} resources · Your professional network
            </p>
            <button
              className="text-button"
              onClick={() => {
                setQuery("");
                setFilters({
                  q: "",
                  status: "",
                  sort: "name",
                  terms: [],
                  includeInactive: false,
                  projectId: "",
                });
                setPage(1);
              }}
            >
              Clear filters
            </button>
          </div>
          {data.items.length === 0 ? (
            <Empty>
              No resources match these filters. Try a broader search or invite
              someone to the network.
            </Empty>
          ) : (
            <div className="grid three">
              {data.items.map((p) => (
                <article className="card resource-card" key={p.id}>
                  <div className="row between">
                    <span className="avatar" aria-hidden="true">
                      {p.name
                        .split(" ")
                        .map((x) => x[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <Badge>{p.active ? p.status : "Deactivated"}</Badge>
                  </div>
                  <div>
                    <h2>{p.name}</h2>
                    <p className="muted">
                      {p.headline || "Profile in progress"}
                    </p>
                  </div>
                  <small>{p.location || "Location not added"}</small>
                  <div className="tag-list">
                    {p.terms.slice(0, 4).map((t) => (
                      <Badge key={t.termId}>{t.name}</Badge>
                    ))}
                    {p.terms.length > 4 && <Badge>+{p.terms.length - 4}</Badge>}
                  </div>
                  <Link href={`/network/${p.id}`} className="card-link">
                    View profile <span aria-hidden="true">↗</span>
                  </Link>
                </article>
              ))}
            </div>
          )}
          <Pager data={data} onPage={setPage} />
        </>
      )}
    </>
  );
}
