"use client";
import { useState } from "react";
import Link from "next/link";
import type { Page, User } from "@/lib/types";
import { useUser } from "./session";
import { Badge, Empty, Heading, Loading, Notice, Pager, useData } from "./ui";
import { UserForm } from "./user-form";
import { LinkedRow } from "./entity-ui";
import { PersonActions } from "./person-actions";
import { detailHref, useListQuery } from "./list-state";

export function Users() {
  const actor = useUser();
  const [show, setShow] = useState(false);
  const [revision, setRevision] = useState(0);
  const [success, setSuccess] = useState("");
  return (
    <>
      <Heading eyebrow="People & access" title="Manage people & access">
        <button onClick={() => setShow(!show)}>
          {show ? "Close form" : "+ Create person"}
        </button>
      </Heading>
      <p className="page-intro">
        Staff accounts sign in to manage the workspace. Resources have
        professional profiles and project history, without sign-in access.
      </p>
      {show && (
        <UserForm
          value={null}
          onCancel={() => setShow(false)}
          onSaved={() => {
            setShow(false);
            setRevision((x) => x + 1);
            setSuccess("Person created.");
          }}
        />
      )}
      <Notice success={success} />
      {actor.role === "Admin" ? (
        <PeopleTable kind="staff" revision={revision} />
      ) : (
        <section className="card" aria-label="Staff accounts">
          <h2>Staff accounts</h2>
          <p className="muted">
            Administrators manage staff accounts and sign-in access.
          </p>
        </section>
      )}
      <PeopleTable kind="resources" revision={revision} />
    </>
  );
}
function PeopleTable({
  kind,
  revision,
}: {
  kind: "staff" | "resources";
  revision: number;
}) {
  const { params, update, href } = useListQuery();
  const key = (field: string) => `${kind}_${field}`;
  const [query, setQuery] = useState(params.get(key("q")) || "");
  const page = Math.max(1, Number(params.get(key("page"))) || 1);
  const title = kind === "staff" ? "Staff accounts" : "Resources";
  const request = new URLSearchParams({
    kind,
    q: params.get(key("q")) || "",
    status: params.get(key("status")) || "",
    sort: params.get(key("sort")) || "name",
    page: String(page),
    revision: String(revision),
  });
  const { data, error, loading, reload } = useData<Page<User>>(
    `/users?${request}`,
  );
  const clear = () => {
    setQuery("");
    update({
      [key("q")]: "",
      [key("status")]: "",
      [key("sort")]: "",
      [key("page")]: 1,
    });
  };
  return (
    <section className="card data-card" aria-label={title}>
      <div className="table-heading">
        <h2>{title}</h2>
        <span className="muted">
          {data?.total ?? "—"}{" "}
          {kind === "staff" ? "staff accounts" : "resource profiles"}
        </span>
      </div>
      <form
        className="filters table-filters"
        aria-label={`${title} filters`}
        onSubmit={(e) => {
          e.preventDefault();
          update({ [key("q")]: query, [key("page")]: 1 });
        }}
      >
        <label>
          Find {kind === "staff" ? "staff" : "resource"}
          <input
            type="search"
            maxLength={100}
            value={query}
            placeholder="Name or email address"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          {title} status
          <select
            value={params.get(key("status")) || ""}
            onChange={(e) =>
              update({ [key("status")]: e.target.value, [key("page")]: 1 })
            }
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </select>
        </label>
        <label>
          Sort {kind}
          <select
            value={params.get(key("sort")) || "name"}
            onChange={(e) =>
              update({ [key("sort")]: e.target.value, [key("page")]: 1 })
            }
          >
            <option value="name">Name A–Z</option>
            <option value="email">Email A–Z</option>
            {kind === "staff" && <option value="role">Role</option>}
          </select>
        </label>
        <button>Search</button>
        <button type="button" className="secondary" onClick={clear}>
          Clear filters
        </button>
      </form>
      <Notice error={error} />
      {error && (
        <button className="secondary" onClick={reload}>
          Reload {kind}
        </button>
      )}
      {loading && <Loading />}
      {data && (
        <>
          {data.items.length ? (
            <div className="table-wrap">
              <table>
                <caption className="visually-hidden">{title}</caption>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    {kind === "staff" && <th>Role</th>}
                    <th>Status</th>
                    <th>Access</th>
                    <th>
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <LinkedRow
                      key={u.id}
                      href={detailHref(
                        kind === "staff" ? "users" : "network",
                        u.id,
                        href,
                      )}
                    >
                      <td>
                        <Link
                          className="entity-name"
                          href={detailHref(
                            kind === "staff" ? "users" : "network",
                            u.id,
                            href,
                          )}
                        >
                          {u.name}
                        </Link>
                      </td>
                      <td>{u.email}</td>
                      {kind === "staff" && (
                        <td>
                          <Badge>{u.role}</Badge>
                        </td>
                      )}
                      <td>
                        <Badge>{u.active ? "Active" : "Deactivated"}</Badge>
                      </td>
                      <td>
                        {kind === "staff" ? "Staff sign-in" : "Profile only"}
                      </td>
                      <td>
                        <PersonActions
                          person={u}
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
              No {kind === "staff" ? "staff accounts" : "resources"} match these
              filters.
              <div className="empty-actions">
                <button className="secondary" onClick={clear}>
                  Clear filters
                </button>
              </div>
            </Empty>
          )}
          <Pager
            data={data}
            onPage={(page) => update({ [key("page")]: page })}
            label={`${title} pagination`}
          />
        </>
      )}
    </section>
  );
}
