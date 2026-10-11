"use client";
import { useState } from "react";
import Link from "next/link";
import { api, date, message } from "@/lib/api";
import type { Page, Project } from "@/lib/types";
import type { SelectedResource } from "./resource-selection";
import { Dialog } from "./entity-ui";
import { Badge, Empty, Loading, Notice, Pager, useData } from "./ui";
import { useFeedback } from "./feedback";

type Outcome = SelectedResource & { error?: string };
export function AssignResourcesDialog({
  resources,
  onClose,
  onAssigned,
}: {
  resources: SelectedResource[];
  onClose: () => void;
  onAssigned: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [project, setProject] = useState<Project | null>(null);
  const [role, setRole] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [error, setError] = useState("");
  const notify = useFeedback();
  const {
    data,
    error: loadError,
    loading,
    reload,
  } = useData<Page<Project>>(
    `/projects?eligible=true&q=${encodeURIComponent(query)}&page=${page}`,
  );
  const failures = outcomes.filter((x) => x.error);
  const pending = outcomes.length ? failures : resources;
  const complete = outcomes.length > 0 && failures.length === 0;
  return (
    <Dialog title="Add resources to project" onClose={onClose} busy={busy}>
      <p>
        {resources.length} selected{" "}
        {resources.length === 1 ? "resource" : "resources"}. Each assignment
        uses the role and dates below. Existing overlapping assignments are
        preserved.
      </p>
      <details>
        <summary>Selected resources ({resources.length})</summary>
        <ul>
          {resources.map((x) => (
            <li key={x.id}>{x.name}</li>
          ))}
        </ul>
      </details>
      <form
        className="stack"
        aria-label="Assign selected resources"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!project || busy || complete) return;
          setBusy(true);
          setError("");
          setProgress(0);
          const results: Outcome[] = [];
          try {
            for (const resource of pending) {
              try {
                await api(`/projects/${project.id}/assignments`, "POST", {
                  resourceId: resource.id,
                  roleDescription: role,
                  startDate: start,
                  endDate: end || null,
                  version: 0,
                });
                results.push({ id: resource.id, name: resource.name });
              } catch (error) {
                results.push({
                  id: resource.id,
                  name: resource.name,
                  error: message(error),
                });
              }
              setProgress(results.length);
            }
            const successful = results.filter((x) => !x.error).map((x) => x.id);
            setOutcomes((current) => [
              ...current.filter((x) => !x.error),
              ...results,
            ]);
            if (successful.length) {
              onAssigned(successful);
              notify(
                `${successful.length} ${successful.length === 1 ? "resource" : "resources"} assigned to ${project.name}.`,
              );
            }
          } catch (error) {
            setError(message(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || complete} className="stack">
          <legend>Choose a project</legend>
          <div className="filters">
            <label>
              Find project
              <input
                type="search"
                disabled={outcomes.length > 0}
                maxLength={100}
                placeholder="Project name or code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setQuery(search);
                    setPage(1);
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="secondary"
              disabled={outcomes.length > 0}
              onClick={() => {
                setQuery(search);
                setPage(1);
              }}
            >
              Find project
            </button>
          </div>
          <Notice error={loadError} />
          {loadError && (
            <button type="button" className="secondary" onClick={reload}>
              Reload projects
            </button>
          )}
          {loading ? (
            <Loading />
          ) : (
            data && (
              <>
                {data.items.length ? (
                  <div className="project-options">
                    {data.items.map((p) => (
                      <label className="project-option" key={p.id}>
                        <input
                          type="radio"
                          disabled={outcomes.length > 0}
                          name="assignment-project"
                          checked={project?.id === p.id}
                          onChange={() => {
                            setProject(p);
                            setStart(date(p.startDate));
                            setEnd(date(p.endDate));
                          }}
                        />
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {p.code} · {date(p.startDate)} –{" "}
                            {date(p.endDate) || "Open ended"}
                          </small>
                        </span>
                        <Badge>{p.status}</Badge>
                      </label>
                    ))}
                  </div>
                ) : (
                  <Empty>
                    No eligible projects match. Choose a broader search or
                    create a planned or active project.
                  </Empty>
                )}
                <Pager
                  data={data}
                  onPage={setPage}
                  label="Eligible projects pagination"
                  disabled={busy || outcomes.length > 0}
                />
              </>
            )
          )}
          {project && (
            <p className="selection-summary">
              Selected project: <strong>{project.name}</strong>
            </p>
          )}
          <label>
            Assignment role
            <input
              required
              maxLength={160}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Systems engineer"
            />
          </label>
          <div className="form-grid">
            <label>
              Assignment start
              <input
                type="date"
                required
                min={project ? date(project.startDate) : undefined}
                max={date(project?.endDate) || undefined}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Assignment end{project?.endDate ? " (required)" : " (optional)"}
              <input
                type="date"
                required={!!project?.endDate}
                min={start}
                max={date(project?.endDate) || undefined}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
        </fieldset>
        <Notice error={error} />
        {busy && (
          <p role="status">
            Assigning resources… {progress} of {pending.length}
          </p>
        )}
        {outcomes.length > 0 && (
          <section
            className="assignment-results"
            aria-label="Assignment results"
          >
            <Notice
              success={`${outcomes.filter((x) => !x.error).length} of ${resources.length} resources assigned to ${project?.name}.`}
            />
            <Notice
              error={
                failures.length
                  ? `${failures.length} assignments need attention. Successful assignments are saved; retry affects only the unsuccessful resources.`
                  : undefined
              }
            />
            {failures.length > 0 && (
              <ul>
                {failures.map((x) => (
                  <li key={x.id}>
                    <strong>{x.name}:</strong> {x.error}
                  </li>
                ))}
              </ul>
            )}
            {project && (
              <Link href={`/projects/${project.id}`}>View project team</Link>
            )}
          </section>
        )}
        <div className="row">
          <button type="submit" disabled={busy || !project || complete}>
            {busy
              ? "Assigning…"
              : outcomes.length
                ? "Retry unsuccessful assignments"
                : `Assign ${resources.length} ${resources.length === 1 ? "resource" : "resources"}`}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            {outcomes.length ? "Done" : "Cancel"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
