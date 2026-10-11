"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";
import { Breadcrumbs } from "./entity-ui";
import { PersonActions } from "./person-actions";
import { detailHref, returnPath, useListQuery } from "./list-state";
import { UserForm } from "./user-form";
import { Badge, Heading, Loading, Notice, useData } from "./ui";

export function UserDetail({
  id,
  editing = false,
}: {
  id: string;
  editing?: boolean;
}) {
  const router = useRouter();
  const { params } = useListQuery();
  const back = returnPath(params.get("from"), "/users");
  const detail = detailHref("users", id, back);
  const { data, error, reload } = useData<User>(`/users/${id}`);
  if (!data)
    return (
      <>
        <Link href={back}>← People & access</Link>
        {!error && <Loading />}
        <Notice error={error} />
        {error && (
          <button className="secondary" onClick={reload}>
            Retry
          </button>
        )}
      </>
    );
  if (data.role === "Resource")
    return (
      <>
        <Heading title={data.name} />
        <Link href={detailHref("network", id, back, editing)}>
          Open resource {editing ? "editor" : "profile"}
        </Link>
      </>
    );
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "People & access", href: back },
          ...(editing
            ? [{ label: data.name, href: detail }, { label: "Edit" }]
            : [{ label: data.name }]),
        ]}
      />
      <Heading
        eyebrow={editing ? "Edit staff account" : "Staff account"}
        title={editing ? `Edit ${data.name}` : data.name}
      >
        <div className="row">
          <Link href={editing ? detail : back}>
            {editing ? "Cancel editing" : "← People & access"}
          </Link>
          {!editing && (
            <PersonActions person={data} back={back} onChanged={reload} />
          )}
        </div>
      </Heading>
      {editing ? (
        <UserForm
          key={data.version}
          value={data}
          onCancel={() => router.push(detail)}
          onSaved={() => router.push(`${detail}&saved=account`)}
        />
      ) : (
        <>
          <Notice
            success={params.get("saved") ? "Staff account saved." : undefined}
          />
          <section className="card">
            <h2>Account information</h2>
            <dl className="detail-list">
              <div>
                <dt>Full name</dt>
                <dd>{data.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${data.email}`}>{data.email}</a>
                </dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>
                  <Badge>{data.role}</Badge>
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge>{data.active ? "Active" : "Deactivated"}</Badge>
                </dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>Staff sign-in</dd>
              </div>
            </dl>
            <p className="muted">
              {data.role === "Admin"
                ? "Manages people, projects, assignments and recorded hours."
                : "Maintains resource profiles, invitations and recorded hours."}{" "}
              Project assignments are available for Resource profiles.
            </p>
          </section>
        </>
      )}
    </>
  );
}
