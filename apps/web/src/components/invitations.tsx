"use client";
import { useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { api, date, message } from "@/lib/api";
import type { Invitation, Term } from "@/lib/types";
import { Badge, Empty, Heading, Loading, Notice, useData } from "./ui";
import { ConfirmDialog } from "./entity-ui";
import { useFeedback } from "./feedback";
export function Invitations() {
  const {
    data,
    error: loadError,
    loading,
    reload,
  } = useData<Invitation[]>("/invitations");
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const notify = useFeedback();
  return (
    <>
      <Heading eyebrow="Grow the network" title="A simple introduction" />
      <p className="muted">
        Create a secure link for a business card, a conversation, or an upcoming
        event.
      </p>
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const result = await api<{ token: string }>(
              "/invitations",
              "POST",
              {
                label: form.get("label"),
                days: Number(form.get("days")),
                maxUses: Number(form.get("maxUses")),
              },
            );
            const link = `${window.location.origin}/join#${result.token}`;
            setUrl(link);
            setQr(
              await QRCode.toDataURL(link, {
                width: 280,
                margin: 2,
                errorCorrectionLevel: "M",
                color: { dark: "#07111b", light: "#ffffff" },
              }),
            );
            reload();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Create invitation</h2>
        <div className="form-grid">
          <label className="full">
            Label
            <input
              name="label"
              required
              maxLength={120}
              placeholder="e.g. Director business card · October"
            />
          </label>
          <label>
            Valid for (days)
            <input
              name="days"
              type="number"
              min={1}
              max={365}
              defaultValue={90}
              required
            />
          </label>
          <label>
            Maximum registrations
            <input
              name="maxUses"
              type="number"
              min={1}
              max={10000}
              defaultValue={100}
              required
            />
          </label>
        </div>
        <div>
          <button disabled={busy}>
            {busy ? "Creating…" : "Create invitation & QR code"}
          </button>
        </div>
      </form>
      <Notice error={error || loadError} />
      {url && (
        <section className="card">
          <h2>Your invitation is ready</h2>
          <p>
            Save this link now. For security, it is only shown once. Anyone with
            the link can submit their professional details until the invitation
            expires or is revoked.
          </p>
          <label>
            Invitation link
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <div className="row" style={{ marginTop: 20 }}>
            {qr && (
              <Image
                unoptimized
                className="qr"
                src={qr}
                width={240}
                height={240}
                alt="QR code for the new Tenacom resource invitation"
              />
            )}
            <a
              className="button secondary"
              href={qr}
              download="tenacom-invitation.png"
            >
              Download QR code
            </a>
          </div>
        </section>
      )}
      <section className="card">
        <h2>Recent invitations</h2>
        {loading && <Loading />}
        {loadError && (
          <button className="secondary" onClick={reload}>
            Reload invitations
          </button>
        )}
        {!loading && data?.length === 0 && (
          <Empty>
            No invitations yet. Create a link above to invite your first
            resource.
          </Empty>
        )}
        {!!data?.length && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Expires</th>
                  <th>Registrations</th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((i) => (
                  <tr key={i.id}>
                    <td>{i.label}</td>
                    <td>{date(i.expiresAt)}</td>
                    <td>
                      {i.uses} / {i.maxUses}
                    </td>
                    <td>
                      <Badge>
                        {i.revoked
                          ? "Revoked"
                          : new Date(i.expiresAt + "Z") < new Date()
                            ? "Expired"
                            : i.uses >= i.maxUses
                              ? "Used up"
                              : "Active"}
                      </Badge>
                    </td>
                    <td>
                      {!i.revoked && (
                        <button
                          className="text-button"
                          onClick={() => setRevoking(i)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <small>Showing the 100 most recent invitations.</small>
      </section>
      <Taxonomy />
      {revoking && (
        <ConfirmDialog
          title="Revoke invitation?"
          confirmLabel="Revoke invitation"
          onClose={() => setRevoking(null)}
          onConfirm={async () => {
            await api(`/invitations/${revoking.id}`, "DELETE");
            reload();
            notify(`Invitation ${revoking.label} revoked.`);
          }}
        >
          <p>
            The link and QR code for {revoking.label} will stop accepting new
            submissions. Existing resource profiles remain available.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
function Taxonomy() {
  const { data, reload } = useData<Term[]>("/terms");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const values = new FormData(form);
        setError("");
        try {
          await api("/terms", "POST", {
            kind: values.get("kind"),
            name: values.get("name"),
          });
          setSuccess(
            "Area added. Resources can now select it in their profiles.",
          );
          form.reset();
          reload();
        } catch (e) {
          setError(message(e));
        }
      }}
    >
      <h2>Grow the expertise vocabulary</h2>
      <p className="muted">
        Add new disciplines as your network expands. Check existing terms first
        to avoid duplicates.
      </p>
      <div className="filters">
        <label>
          Type
          <select name="kind">
            {["Field", "Industry", "Skill", "Expertise"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Name
          <input name="name" required maxLength={100} />
        </label>
        <button>Add area</button>
      </div>
      <Notice error={error} success={success} />
      <details>
        <summary>Existing areas ({data?.length || 0})</summary>
        <div className="tag-list">
          {data?.map((t) => (
            <Badge key={t.id}>
              {t.kind} · {t.name}
            </Badge>
          ))}
        </div>
      </details>
    </form>
  );
}
