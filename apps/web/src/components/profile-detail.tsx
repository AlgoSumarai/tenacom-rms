"use client";
import { useState } from "react";
import Link from "next/link";
import { date } from "@/lib/api";
import type { Profile, Page, Assignment } from "@/lib/types";
import { Breadcrumbs, LinkedRow } from "./entity-ui";
import { PersonActions } from "./person-actions";
import { returnPath, useListQuery } from "./list-state";
import { Badge, Empty, Heading, Loading, Notice, Pager, useData } from "./ui";
import { useUser } from "./session";

export function ProfileDetail({ id }: { id: string }) {
  const { params } = useListQuery();
  const back = returnPath(params.get("from"), "/network");
  const { data, error, reload } = useData<Profile>(`/resources/${id}`);
  const [revision, setRevision] = useState(0);
  if (!data)
    return (
      <>
        <Link href={back}>← Back to list</Link>
        {!error && <Loading />}
        <Notice error={error} />
        {error && (
          <button className="secondary" onClick={reload}>
            Retry
          </button>
        )}
      </>
    );
  const success = {
    profile: "Profile details have been saved and submitted for review.",
    review: "Review saved.",
    account: "Contact and account settings saved.",
  }[params.get("saved") || ""];
  return (
    <>
      <Breadcrumbs
        items={[
          {
            label: back.startsWith("/users")
              ? "People & access"
              : back.startsWith("/projects")
                ? "Project"
                : "Resource network",
            href: back,
          },
          { label: data.name },
        ]}
      />
      <Heading eyebrow="Resource profile" title={data.name}>
        <div className="row">
          <Link href={back}>← Back to list</Link>
          <PersonActions
            person={{ ...data, role: "Resource" }}
            back={back}
            onChanged={() => {
              reload();
              setRevision((x) => x + 1);
            }}
          />
        </div>
      </Heading>
      <Notice success={success} />
      <section className="hero-strip">
        <div>
          <h2>{data.headline || "Profile in progress"}</h2>
          <p>{data.location || "Location not added"}</p>
          <div className="tag-list">
            <Badge>{data.active ? data.status : "Deactivated"}</Badge>
            <Badge>
              {data.reviewStatus === "NeedsChanges"
                ? "Needs changes"
                : data.reviewStatus}
            </Badge>
          </div>
        </div>
        <div className="profile-completeness">
          <strong>{data.completeness}% complete</strong>
          <progress
            className="progress"
            value={data.completeness}
            max={100}
            aria-label="Profile completeness"
          />
        </div>
      </section>
      <div className="grid">
        <section className="card">
          <h2>Professional summary</h2>
          <p className="preserve-lines">
            {data.summary || "No professional summary has been added."}
          </p>
        </section>
        <section className="card">
          <h2>Contact & profile information</h2>
          <dl className="detail-list">
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${data.email}`}>{data.email}</a>
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{data.phone || "Not added"}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{data.location || "Not added"}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>Resource profile · No sign-in</dd>
            </div>
          </dl>
        </section>
      </div>
      <section className="card">
        <h2>Expertise & experience</h2>
        {data.terms.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Type</th>
                  <th>Proficiency</th>
                  <th>Experience</th>
                </tr>
              </thead>
              <tbody>
                {data.terms.map((t) => (
                  <tr key={t.termId}>
                    <td>
                      <strong>{t.name}</strong>
                    </td>
                    <td>{t.kind}</td>
                    <td>{t.proficiency}</td>
                    <td>
                      {t.years === null ? "Not provided" : `${t.years} years`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No expertise areas have been added.</p>
        )}
      </section>
      {data.reviewNote && (
        <section className="card">
          <h2>Review feedback</h2>
          <p className="preserve-lines">{data.reviewNote}</p>
        </section>
      )}
      <ResourceProjects id={id} revision={revision} />
    </>
  );
}
function ResourceProjects({ id, revision }: { id: string; revision: number }) {
  const actor = useUser();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useData<Page<Assignment>>(
    `/assignments?resourceId=${id}&page=${page}&revision=${revision}`,
  );
  return (
    <section className="card data-card" aria-label="Resource projects">
      <div className="table-heading">
        <h2>Project history</h2>
        <span className="muted">{data?.total ?? "—"} assignments</span>
      </div>
      <Notice error={error} />
      {error && (
        <button className="secondary" onClick={reload}>
          Reload assignments
        </button>
      )}
      {loading && <Loading />}
      {data && !loading && (
        <>
          {data.items.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Assignment role</th>
                    <th>Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((a) => (
                    <LinkedRow key={a.id} href={`/projects/${a.projectId}`}>
                      <td>
                        <Link href={`/projects/${a.projectId}`}>
                          {a.projectName}
                        </Link>
                      </td>
                      <td>{a.roleDescription}</td>
                      <td>
                        {date(a.startDate)} – {date(a.endDate) || "Ongoing"}
                      </td>
                    </LinkedRow>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              No project assignments yet.{" "}
              {actor.role === "Admin"
                ? "Use the actions menu to add this resource to a project."
                : "An administrator can add this resource to a project."}
            </Empty>
          )}
          <Pager
            data={data}
            onPage={setPage}
            label="Resource project history pagination"
          />
        </>
      )}
    </section>
  );
}
