"use client";
import { useState } from "react";
import Link from "next/link";
import { api, date, message } from "@/lib/api";
import type {
  Profile,
  ProfileInput,
  Term,
  Page,
  Assignment,
} from "@/lib/types";
import { ProfileFields } from "./profile-fields";
import { Badge, Heading, Loading, Notice, Pager, useData } from "./ui";

export function ProfileEditor({ id }: { id: string }) {
  const { data, error, reload } = useData<Profile>(`/resources/${id}`);
  const { data: terms } = useData<Term[]>("/terms");
  const [page, setPage] = useState(1);
  const [saved, setSaved] = useState(false);
  const {
    data: assignments,
    loading: assignmentsLoading,
    error: assignmentsError,
  } = useData<Page<Assignment>>(`/assignments?resourceId=${id}&page=${page}`);
  if (!data)
    return (
      <>
        {!error && <Loading />}
        <Notice error={error} />
      </>
    );
  return (
    <>
      <Heading eyebrow="Resource profile" title={data.name}>
        <Link href="/network">← Resource network</Link>
      </Heading>
      <div className="hero-strip">
        <div>
          <h2>{data.headline || "Complete your profile"}</h2>
          <p>
            {data.email} · {data.location || "Add your location"}
          </p>
        </div>
        <div>
          <Badge>{data.reviewStatus}</Badge>
          <p>{data.completeness}% complete</p>
          <progress
            className="progress"
            value={data.completeness}
            max={100}
            aria-label="Profile completeness"
          />
        </div>
      </div>
      {data.reviewNote && (
        <Notice success={`Review feedback: ${data.reviewNote}`} />
      )}
      {saved && (
        <Notice success="Profile details have been saved and submitted for review." />
      )}
      <Editor
        key={`${data.id}-${data.version}`}
        profile={data}
        terms={terms || []}
        onSaved={() => {
          setSaved(true);
          reload();
        }}
      />
      <Review profile={data} onSaved={reload} />
      <section className="card">
        <h2>Project history</h2>
        <Notice error={assignmentsError} />
        {assignmentsLoading ? (
          <Loading />
        ) : assignmentsError ? null : assignments?.items.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Assignment</th>
                    <th>Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.items.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/projects/${a.projectId}`}>
                          {a.projectName}
                        </Link>
                      </td>
                      <td>{a.roleDescription}</td>
                      <td>
                        {date(a.startDate)} – {date(a.endDate) || "Ongoing"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager data={assignments} onPage={setPage} />
          </>
        ) : (
          <p className="muted">
            No project assignments yet. Your expertise is available for future
            opportunities.
          </p>
        )}
      </section>
    </>
  );
}
function Editor({
  profile,
  terms,
  onSaved,
}: {
  profile: Profile;
  terms: Term[];
  onSaved: () => void;
}) {
  const [value, setValue] = useState<ProfileInput>(profile);
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
          await api(`/resources/${profile.id}`, "PUT", value);
          onSaved();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Professional details</h2>
      <ProfileFields value={value} onChange={setValue} terms={terms} />
      <Notice error={error} />
      <div>
        <button disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
      </div>
    </form>
  );
}
function Review({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(profile.reviewStatus);
  const [note, setNote] = useState(profile.reviewNote);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api(`/resources/${profile.id}/review`, "PUT", {
            status,
            note,
            version: profile.version,
          });
          setSuccess("Review saved.");
          onSaved();
        } catch (e) {
          setError(message(e));
        }
      }}
    >
      <h2>Profile review</h2>
      <p className="muted">
        Review records the team’s assessment of the profile. It does not verify
        identity or qualifications. Feedback is visible to the resource.
      </p>
      <label>
        Review status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {["Pending", "Verified", "NeedsChanges"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        Feedback
        <textarea
          maxLength={1000}
          required={status === "NeedsChanges"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <Notice error={error} success={success} />
      <div>
        <button>Save review</button>
      </div>
    </form>
  );
}
