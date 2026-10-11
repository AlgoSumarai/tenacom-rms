"use client";
import { useState } from "react";
import { api, message } from "@/lib/api";
import type { Role, User } from "@/lib/types";
import { useUser } from "./session";
import { Notice } from "./ui";
import { useResourceSelection } from "./resource-selection";
import { ConfirmDialog } from "./entity-ui";
export function UserForm({
  value,
  onSaved,
  onCancel,
  includeName = true,
  onDirty,
  onBusy,
}: {
  value: User | null;
  onSaved: () => void;
  onCancel?: () => void;
  includeName?: boolean;
  onDirty?: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const actor = useUser();
  const selection = useResourceSelection();
  const [name, setName] = useState(value?.name || "");
  const [email, setEmail] = useState(value?.email || "");
  const [role, setRole] = useState<Role>(value?.role || "Resource");
  const [active, setActive] = useState(value?.active ?? true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    onBusy?.(true);
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
      if (value?.role === "Resource") {
        if (!active) selection.remove([value.id]);
        else selection.rename(value.id, name);
      }
      onSaved();
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };
  return (
    <form
      className="card stack"
      onChange={onDirty}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        if (value?.active && !active) {
          setConfirmDeactivate(true);
          return;
        }
        try {
          await save();
        } catch (e) {
          setError(message(e));
        }
      }}
    >
      <h2>
        {value
          ? includeName
            ? "Edit person"
            : "Contact & account settings"
          : "Create person"}
      </h2>
      <fieldset className="form-grid" disabled={busy}>
        {includeName && (
          <label>
            Full name
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
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
            disabled={value?.role === "Resource" || value?.id === actor.id}
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
      </fieldset>
      {role === "Resource" && (
        <p className="muted">
          Resource profiles have no password or system sign-in. Admins and
          Managers maintain their details and record project hours.
        </p>
      )}
      <Notice error={error} />
      <div>
        <button disabled={busy}>{busy ? "Saving…" : "Save person"}</button>
        {onCancel && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
      {confirmDeactivate && (
        <ConfirmDialog
          title="Deactivate person?"
          confirmLabel="Deactivate person"
          onConfirm={save}
          onClose={() => setConfirmDeactivate(false)}
        >
          <p>
            {value?.role === "Resource"
              ? "Deactivate this resource profile?"
              : "Deactivate this staff account? They will be signed out immediately."}{" "}
            Project and time history will be retained.
          </p>
        </ConfirmDialog>
      )}
    </form>
  );
}
