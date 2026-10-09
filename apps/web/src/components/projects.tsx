"use client";
import { useState } from "react";
import Link from "next/link";
import { api, date, message, today } from "@/lib/api";
import type { Page, Project } from "@/lib/types";
import { useUser } from "./session";
import { Badge, Empty, Heading, Loading, Notice, Pager, useData } from "./ui";
import { Assignments } from "./assignments";

const emptyProject: Project = {
  id: "",
  code: "",
  name: "",
  description: "",
  status: "Planned",
  startDate: today(),
  endDate: null,
  version: 0,
};
export function Projects() {
  const user = useUser();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [create, setCreate] = useState(false);
  const { data, error, loading, reload } = useData<Page<Project>>(
    `/projects?q=${encodeURIComponent(search)}&page=${page}`,
  );
  return (
    <>
      <Heading eyebrow="Deliver together" title="Projects">
        {user.role === "Admin" && (
          <button onClick={() => setCreate(!create)}>
            {create ? "Close form" : "+ Create project"}
          </button>
        )}
      </Heading>
      {create && (
        <ProjectForm
          value={emptyProject}
          onSaved={() => {
            reload();
            setCreate(false);
          }}
        />
      )}
      <form
        className="card filters"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q);
          setPage(1);
        }}
      >
        <label>
          Find a project
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or project code"
          />
        </label>
        <button>Search</button>
      </form>
      <Notice error={error} />
      {loading && <Loading />}
      {data && (
        <>
          {data.items.length ? (
            <div className="grid">
              {data.items.map((p) => (
                <article className="card resource-card" key={p.id}>
                  <div className="row between">
                    <span className="eyebrow">{p.code}</span>
                    <Badge>{p.status}</Badge>
                  </div>
                  <h2>{p.name}</h2>
                  <p className="muted">
                    {p.description.slice(0, 170) ||
                      "Project details will appear here."}
                  </p>
                  <small>
                    {date(p.startDate)} – {date(p.endDate) || "Open ended"}
                  </small>
                  <Link className="card-link" href={`/projects/${p.id}`}>
                    Open project <span>↗</span>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <Empty>No projects to show yet.</Empty>
          )}
          <Pager data={data} onPage={setPage} />
        </>
      )}
    </>
  );
}
export function ProjectDetail({ id }: { id: string }) {
  const user = useUser();
  const { data, error, reload } = useData<Project>(`/projects/${id}`);
  const [edit, setEdit] = useState(false);
  if (!data)
    return (
      <>
        {!error && <Loading />}
        <Notice error={error} />
      </>
    );
  return (
    <>
      <Heading eyebrow={data.code} title={data.name}>
        <Link href="/projects">← Projects</Link>
      </Heading>
      <div className="card">
        <div className="row between">
          <Badge>{data.status}</Badge>
          {user.role === "Admin" && (
            <button className="secondary" onClick={() => setEdit(!edit)}>
              {edit ? "Close editor" : "Edit project"}
            </button>
          )}
        </div>
        <p>{data.description}</p>
        <p className="muted">
          {date(data.startDate)} – {date(data.endDate) || "Open ended"}
        </p>
      </div>
      {edit && (
        <ProjectForm
          key={data.version}
          value={data}
          onSaved={() => {
            reload();
            setEdit(false);
          }}
        />
      )}
      <Assignments project={data} />
    </>
  );
}
function ProjectForm({
  value,
  onSaved,
}: {
  value: Project;
  onSaved: () => void;
}) {
  const [p, setP] = useState(value);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api(
            `/projects${p.id ? `/${p.id}` : ""}`,
            p.id ? "PUT" : "POST",
            {
              ...p,
              startDate: date(p.startDate),
              endDate: date(p.endDate) || null,
            },
          );
          onSaved();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{p.id ? "Edit project" : "A new project"}</h2>
      <div className="form-grid">
        <label>
          Project code
          <input
            required
            maxLength={30}
            value={p.code}
            onChange={(e) => setP({ ...p, code: e.target.value })}
            placeholder="e.g. TNC-001"
          />
        </label>
        <label>
          Project name
          <input
            required
            maxLength={160}
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
        </label>
        <label className="full">
          Description
          <textarea
            maxLength={5000}
            value={p.description}
            onChange={(e) => setP({ ...p, description: e.target.value })}
          />
        </label>
        <label>
          Start date
          <input
            type="date"
            required
            value={date(p.startDate)}
            onChange={(e) => setP({ ...p, startDate: e.target.value })}
          />
        </label>
        <label>
          End date (optional)
          <input
            type="date"
            min={date(p.startDate)}
            value={date(p.endDate)}
            onChange={(e) => setP({ ...p, endDate: e.target.value || null })}
          />
        </label>
        <label>
          Status
          <select
            value={p.status}
            onChange={(e) => setP({ ...p, status: e.target.value })}
          >
            {["Planned", "Active", "Completed", "Archived"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <Notice error={error} />
      <div>
        <button disabled={busy}>{busy ? "Saving…" : "Save project"}</button>
      </div>
    </form>
  );
}
