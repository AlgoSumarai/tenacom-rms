"use client";
import { useState } from "react";
import { api, message } from "@/lib/api";
import type { Page, Role, User } from "@/lib/types";
import { useUser } from "./session";
import { Badge, Heading, Loading, Notice, Pager, useData } from "./ui";
export function Users() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const { data, error, loading, reload } = useData<Page<User>>(
    `/users?q=${encodeURIComponent(search)}&page=${page}`,
  );
  return (
    <>
      <Heading eyebrow="People & access" title="Manage people & access">
        <button
          onClick={() => {
            setEdit(null);
            setShow(!show);
          }}
        >
          {show ? "Close form" : "+ Create person"}
        </button>
      </Heading>
      {show && (
        <UserForm
          key={edit?.id || "new"}
          value={edit}
          onSaved={() => {
            reload();
            setShow(false);
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
          Find a person
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or email address"
          />
        </label>
        <button>Search</button>
      </form>
      <Notice error={error} />
      {loading && <Loading />}
      {data && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Access</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>
                      <Badge>{u.active ? "Active" : "Deactivated"}</Badge>
                    </td>
                    <td>
                      {u.role === "Resource" ? "Profile only" : "Staff sign-in"}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => {
                          setEdit(u);
                          setShow(true);
                        }}
                      >
                        Edit person
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager data={data} onPage={setPage} />
        </div>
      )}
    </>
  );
}
function UserForm({
  value,
  onSaved,
}: {
  value: User | null;
  onSaved: () => void;
}) {
  const actor = useUser();
  const [name, setName] = useState(value?.name || "");
  const [email, setEmail] = useState(value?.email || "");
  const [role, setRole] = useState<Role>(value?.role || "Resource");
  const [active, setActive] = useState(value?.active ?? true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          value?.active &&
          !active &&
          !window.confirm(
            value.role === "Resource"
              ? "Deactivate this resource profile? Project and time history will be retained."
              : "Deactivate this staff account? They will be signed out immediately. Project and time history will be retained.",
          )
        )
          return;
        setBusy(true);
        setError("");
        try {
          await api(
            `/users${value ? `/${value.id}` : ""}`,
            value ? "PUT" : "POST",
            {
              name,
              email,
              role,
              active,
              password: role === "Resource" ? undefined : password,
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
      <h2>{value ? "Edit person" : "Create person"}</h2>
      <div className="form-grid">
        <label>
          Full name
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Role
          <select
            aria-label="Role"
            value={role}
            disabled={value?.role === "Resource"}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {(actor.role === "Admin"
              ? value && value.role !== "Resource"
                ? ["Admin", "Manager"]
                : ["Resource", "Manager", "Admin"]
              : ["Resource"]
            ).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {!value && role !== "Resource" && (
          <label>
            Initial password
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <small>
              Share securely. The user can change it from their account page.
            </small>
          </label>
        )}
        {value && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={active}
              disabled={value.id === actor.id}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
        )}
      </div>
      {role === "Resource" && (
        <p className="muted">
          Resource profiles have no password or system sign-in. Admins and
          Managers maintain their details and record project hours.
        </p>
      )}
      <Notice error={error} />
      <div>
        <button disabled={busy}>{busy ? "Saving…" : "Save person"}</button>
      </div>
    </form>
  );
}
