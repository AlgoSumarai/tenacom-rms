"use client";
import { useState } from "react";
import { api, date, hours, message, today } from "@/lib/api";
import type { Assignment, HoursReport, Page, TimeEntry } from "@/lib/types";
import { RecordFilter } from "./record-filter";
import { Empty, Heading, Loading, Notice, Pager, useData } from "./ui";

export function HoursScreen() {
  const [page, setPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [range, setRange] = useState({ start: "", end: "" });
  const [resourceId, setResourceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [edit, setEdit] = useState<TimeEntry | null>(null);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const filters = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ ...range, resourceId, projectId }).filter(([, v]) => v),
    ),
  );
  const entries = useData<Page<TimeEntry>>(
    `/time-entries?${filters}&page=${page}`,
  );
  const report = useData<HoursReport>(
    `/reports/hours?${filters}&page=${reportPage}`,
  );
  const refresh = () => {
    entries.reload();
    report.reload();
    setShow(false);
    setSuccess("Time saved.");
  };
  return (
    <>
      <Heading eyebrow="Every contribution counts" title="Tracked hours">
        <button
          onClick={() => {
            setEdit(null);
            setShow(!show);
          }}
        >
          {show ? "Close form" : "+ Record time"}
        </button>
      </Heading>
      {show && (
        <TimeForm key={edit?.id || "new"} value={edit} onSaved={refresh} />
      )}
      <div className="card filters">
        <label>
          From date
          <input
            type="date"
            value={range.start}
            onChange={(e) => {
              setRange({ ...range, start: e.target.value });
              setPage(1);
              setReportPage(1);
            }}
          />
        </label>
        <label>
          To date
          <input
            type="date"
            min={range.start}
            value={range.end}
            onChange={(e) => {
              setRange({ ...range, end: e.target.value });
              setPage(1);
              setReportPage(1);
            }}
          />
        </label>
        <button
          className="secondary"
          onClick={() => setRange({ start: "", end: "" })}
        >
          All dates
        </button>
      </div>
      <details className="card">
        <summary>Filter by resource or project</summary>
        <div className="grid">
          <RecordFilter
            kind="resources"
            includeInactive
            value={resourceId}
            onChange={(id) => {
              setResourceId(id);
              setPage(1);
              setReportPage(1);
            }}
          />
          <RecordFilter
            kind="projects"
            value={projectId}
            onChange={(id) => {
              setProjectId(id);
              setPage(1);
              setReportPage(1);
            }}
          />
        </div>
      </details>
      <Notice
        error={error || entries.error || report.error}
        success={success}
      />
      <section className="card">
        <h2>Hours by resource & project</h2>
        {report.data && !report.loading && (
          <p>
            <strong className="metric">
              {hours(report.data.totalMinutes)}
            </strong>{" "}
            hours total for the selected filters
          </p>
        )}
        <p className="muted">
          Totals for the selected dates, including historical assignments.
        </p>
        {report.loading ? (
          <Loading />
        ) : report.error ? null : report.data?.items.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Project</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.items.map((r) => (
                    <tr key={`${r.resourceId}-${r.projectId}`}>
                      <td>{r.resourceName}</td>
                      <td>{r.projectName}</td>
                      <td>
                        <strong>{hours(r.minutes)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager data={report.data} onPage={setReportPage} />
          </>
        ) : (
          <Empty>No recorded hours for these dates.</Empty>
        )}
      </section>
      <section className="card">
        <h2>Time entries</h2>
        {entries.loading ? (
          <Loading />
        ) : entries.error ? null : entries.data?.items.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Resource / project</th>
                    <th>Hours</th>
                    <th>Notes</th>
                    <th>Recorded by</th>
                    <th>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.data.items.map((t) => (
                    <tr key={t.id}>
                      <td>{date(t.workDate)}</td>
                      <td>
                        {t.resourceName}
                        <br />
                        <small>{t.projectName}</small>
                      </td>
                      <td>{hours(t.minutes)}</td>
                      <td>{t.notes || "—"}</td>
                      <td>{t.createdByName}</td>
                      <td>
                        <div className="row">
                          <button
                            className="text-button"
                            onClick={() => {
                              setEdit(t);
                              setShow(true);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="text-button"
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  "Remove this time entry? The change will be retained in the audit history.",
                                )
                              )
                                return;
                              try {
                                setError("");
                                await api(
                                  `/time-entries/${t.id}?version=${t.version}`,
                                  "DELETE",
                                );
                                entries.reload();
                                report.reload();
                                setSuccess("Time entry removed.");
                              } catch (e) {
                                setError(message(e));
                              }
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager data={entries.data} onPage={setPage} />
          </>
        ) : (
          <Empty>
            Record a resource’s hours after assigning them to a project.
          </Empty>
        )}
      </section>
    </>
  );
}
function TimeForm({
  value,
  onSaved,
}: {
  value: TimeEntry | null;
  onSaved: () => void;
}) {
  const [assignmentId, setAssignmentId] = useState(value?.assignmentId || "");
  const [resourceId, setResourceId] = useState(value?.resourceId || "");
  const [workDate, setWorkDate] = useState(date(value?.workDate) || today());
  const [minutes, setMinutes] = useState(value?.minutes || 60);
  const [notes, setNotes] = useState(value?.notes || "");
  const [page, setPage] = useState(1);
  const assignmentRequest = useData<Page<Assignment>>(
    value || !resourceId
      ? null
      : `/assignments?resourceId=${resourceId}&page=${page}`,
  );
  const assignments = assignmentRequest.data;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card stack"
      aria-label={value ? "Edit time entry" : "Record resource hours"}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api(
            `/time-entries${value ? `/${value.id}` : ""}`,
            value ? "PUT" : "POST",
            {
              assignmentId,
              workDate,
              minutes,
              notes,
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
      <h2>{value ? "Edit time entry" : "Record resource hours"}</h2>
      {value ? (
        <p>
          {value.resourceName} · {value.projectName}
        </p>
      ) : (
        <>
          <RecordFilter
            kind="resources"
            label="Resource"
            placeholder="Choose a resource"
            required
            includeInactive
            value={resourceId}
            onChange={(id) => {
              setResourceId(id);
              setAssignmentId("");
              setPage(1);
            }}
          />
          {resourceId && assignmentRequest.loading && <Loading />}
          <Notice error={assignmentRequest.error} />
          {assignmentRequest.error && (
            <button
              type="button"
              className="secondary"
              onClick={assignmentRequest.reload}
            >
              Reload assignments
            </button>
          )}
          {resourceId &&
            !assignmentRequest.loading &&
            !assignmentRequest.error &&
            assignments?.total === 0 && (
              <Empty>
                This resource has no project assignments yet. An Admin must
                assign them to a project before time can be recorded.
              </Empty>
            )}
          <label>
            Project assignment
            <select
              required
              aria-label="Project assignment"
              disabled={
                !resourceId ||
                assignmentRequest.loading ||
                !!assignmentRequest.error
              }
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
            >
              <option value="">Choose an assignment</option>
              {assignments?.items
                .filter((a) => a.resourceId === resourceId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.projectName} · {a.roleDescription} ({date(a.startDate)} –{" "}
                    {date(a.endDate) || "ongoing"})
                  </option>
                ))}
            </select>
          </label>
          {assignments && assignments.total > 50 && (
            <Pager
              data={assignments}
              onPage={(nextPage) => {
                setPage(nextPage);
                setAssignmentId("");
              }}
            />
          )}
        </>
      )}
      <div className="form-grid">
        <label>
          Work date
          <input
            type="date"
            required
            max={today()}
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
          />
        </label>
        <label>
          Time worked (minutes)
          <input
            type="number"
            required
            min={1}
            max={1440}
            step={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
          <small>
            {hours(minutes)} hours · maximum 24 hours per day across all
            projects
          </small>
        </label>
      </div>
      <label>
        Work notes (optional)
        <textarea
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <Notice error={error} />
      <div>
        <button
          disabled={
            busy ||
            (!value &&
              (assignmentRequest.loading ||
                !!assignmentRequest.error ||
                !assignmentId))
          }
        >
          {busy ? "Saving…" : "Save time"}
        </button>
      </div>
    </form>
  );
}
