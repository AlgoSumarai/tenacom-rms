"use client";
import { useState } from "react";
import { api, message } from "@/lib/api";
import type { User } from "@/lib/types";
import { Notice } from "./ui";
export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const data = new FormData(e.currentTarget);
        try {
          await api<User>("/auth/login", "POST", {
            email: data.get("email"),
            password: data.get("password"),
          });
          window.location.assign("/network");
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      <Notice error={error} />
      <button disabled={busy}>
        {busy ? "Signing in…" : "Sign in to your workspace →"}
      </button>
      <p className="muted">
        <small>
          Staff access is for Admins and Managers. Resources provide their
          details through the invitation link or QR code shared by their Tenacom
          contact. For account help, contact your administrator.
        </small>
      </p>
    </form>
  );
}
