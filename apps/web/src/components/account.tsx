"use client";
import { useState } from "react";
import { api, message } from "@/lib/api";
import { Heading, Notice } from "./ui";
export function Account() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Heading title="Your account" />
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = new FormData(e.currentTarget);
          try {
            await api("/auth/password", "POST", {
              currentPassword: form.get("current"),
              newPassword: form.get("new"),
            });
            window.location.assign("/login");
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Change password</h2>
        <p className="muted">
          Changing your password signs you out of all devices.
        </p>
        <label>
          Current password
          <input
            name="current"
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
          />
        </label>
        <label>
          New password
          <input
            name="new"
            type="password"
            minLength={12}
            maxLength={128}
            required
            autoComplete="new-password"
          />
        </label>
        <Notice error={error} />
        <div>
          <button disabled={busy}>
            {busy ? "Updating…" : "Change password"}
          </button>
        </div>
      </form>
    </>
  );
}
