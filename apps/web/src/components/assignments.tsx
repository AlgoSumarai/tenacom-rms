"use client";
import { useState } from "react";
import Link from "next/link";
import { api, date, message } from "@/lib/api";
import type { Assignment, Page, Profile, Project } from "@/lib/types";
import { useUser } from "./session";
import { Empty, Loading, Notice, Pager, useData } from "./ui";
export function Assignments({ project }: { project: Project }) {
  const user = useUser();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useData<Page<Assignment>>(
    `/assignments?projectId=${project.id}&page=${page}`,
  );
  const [edit, setEdit] = useState<Assignment | null>(null);
  const [show, setShow] = useState(false);
  return (
    <section className="card">
      <div className="row between">
        <h2>Project team</h2>
        {user.role === "Admin" && (
          <button
            onClick={() => {
              setEdit(null);
              setShow(!show);
            }}
          >
            {show ? "Close form" : "+ Assign resource"}
          </button>
        )}
      </div>
      <Notice error={error} />
      {show && (
        <AssignmentForm
          key={edit?.id || "new"}
          project={project}
          value={edit}
          onSaved={() => {
            reload();
            setShow(false);
          }}
        />
      )}
      {loading && <Loading />}
      {data && (
        <>
          {data.items.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Role</th>
                    <th>From</th>
                    <th>Until</th>
                    {user.role === "Admin" && <th>Manage</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/network/${a.resourceId}`}>
                          {a.resourceName}
                        </Link>
                      </td>
                      <td>{a.roleDescription}</td>
                      <td>{date(a.startDate)}</td>
                      <td>{date(a.endDate) || "Ongoing"}</td>
                      {user.role === "Admin" && (
                        <td>
                          <button
                            className="text-button"
                            onClick={() => {
                              setEdit(a);
                              setShow(true);
                            }}
                          >
                            Edit assignment
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No resources assigned yet.</Empty>
          )}
          <Pager data={data} onPage={setPage} />
        </>
      )}
    </section>
  );
}
function AssignmentForm({
  project,
  value,
  onSaved,
}: {
  project: Project;
  value: Assignment | null;
  onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [resource, setResource] = useState(value?.resourceId || "");
  const [role, setRole] = useState(value?.roleDescription || "");
  const [start, setStart] = useState(
    date(value?.startDate || project.startDate),
  );
  const [end, setEnd] = useState(date(value?.endDate || project.endDate));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, error: searchError } = useData<Page<Profile>>(
    value ? null : `/resources?q=${encodeURIComponent(search)}`,
  );
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api(
            `/projects/${project.id}/assignments${value ? `/${value.id}` : ""}`,
            value ? "PUT" : "POST",
            {
              resourceId: resource,
              roleDescription: role,
              startDate: start,
              endDate: end || null,
              version: value?.version || 0,
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
      <h3>
        {value
          ? `Edit ${value.resourceName}’s assignment`
          : "Connect a resource to this project"}
      </h3>
      {!value && (
        <>
          <div className="filters">
            <label>
              Find resource
              <input value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <button
              className="secondary"
              type="button"
              onClick={() => setSearch(q)}
            >
              Find
            </button>
          </div>
          <label>
            Resource
            <select
              required
              aria-label="Resource"
              aria-describedby="assignment-resource-help"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
            >
              <option value="">Choose a resource</option>
              {data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.headline}
                </option>
              ))}
            </select>
          </label>
          <small id="assignment-resource-help">
            Showing up to 20 matches. Refine the search to find a specific
            person.
          </small>
        </>
      )}
      <label>
        Assignment role
        <input
          required
          maxLength={160}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </label>
      <div className="form-grid">
        <label>
          Assignment start
          <input
            type="date"
            required
            min={date(project.startDate)}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Assignment end
          <input
            type="date"
            min={start}
            max={date(project.endDate) || undefined}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <Notice error={error || searchError} />
      <div>
        <button disabled={busy}>{busy ? "Saving…" : "Save assignment"}</button>
      </div>
    </form>
  );
}
