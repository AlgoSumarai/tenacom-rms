"use client";
import { useState } from "react";
import Link from "next/link";
import { api, date, message } from "@/lib/api";
import type { Assignment, Page, Project } from "@/lib/types";
import { useUser } from "./session";
import { Empty, Loading, Notice, Pager, useData } from "./ui";
import { ActionsMenu, LinkedRow } from "./entity-ui";
import { detailHref } from "./list-state";
import { RecordFilter } from "./record-filter";
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
        {user.role === "Admin" &&
          ["Planned", "Active"].includes(project.status) && (
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
      {error && (
        <button className="secondary" onClick={reload}>
          Reload assignments
        </button>
      )}
      {show && (
        <AssignmentForm
          key={edit?.id || "new"}
          project={project}
          value={edit}
          onSaved={() => {
            reload();
            setShow(false);
          }}
          onCancel={() => setShow(false)}
        />
      )}
      {loading && <Loading />}
      {data && !loading && (
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
                    <LinkedRow
                      key={a.id}
                      href={detailHref(
                        "network",
                        a.resourceId,
                        `/projects/${project.id}`,
                      )}
                    >
                      <td>
                        <Link
                          href={detailHref(
                            "network",
                            a.resourceId,
                            `/projects/${project.id}`,
                          )}
                        >
                          {a.resourceName}
                        </Link>
                      </td>
                      <td>{a.roleDescription}</td>
                      <td>{date(a.startDate)}</td>
                      <td>{date(a.endDate) || "Ongoing"}</td>
                      {user.role === "Admin" && (
                        <td>
                          <ActionsMenu
                            label={`${a.resourceName}’s assignment`}
                            actions={[
                              {
                                label: "Edit assignment",
                                disabled: !["Planned", "Active"].includes(
                                  project.status,
                                ),
                                onClick: () => {
                                  setEdit(a);
                                  setShow(true);
                                },
                              },
                            ]}
                          />
                        </td>
                      )}
                    </LinkedRow>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No resources assigned yet.</Empty>
          )}
          <Pager data={data} onPage={setPage} label="Project team pagination" />
        </>
      )}
    </section>
  );
}
function AssignmentForm({
  project,
  value,
  onSaved,
  onCancel,
}: {
  project: Project;
  value: Assignment | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [resource, setResource] = useState(value?.resourceId || "");
  const [role, setRole] = useState(value?.roleDescription || "");
  const [start, setStart] = useState(
    date(value?.startDate || project.startDate),
  );
  const [end, setEnd] = useState(date(value?.endDate || project.endDate));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
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
        <RecordFilter
          kind="resources"
          value={resource}
          onChange={setResource}
          label="Resource"
          placeholder="Choose a resource"
          required
        />
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
      <Notice error={error} />
      <div>
        <button disabled={busy}>{busy ? "Saving…" : "Save assignment"}</button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
