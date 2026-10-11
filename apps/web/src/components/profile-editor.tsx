"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, message } from "@/lib/api";
import type { Profile, ProfileInput, Term, User } from "@/lib/types";
import { ProfileFields } from "./profile-fields";
import { Breadcrumbs, ConfirmDialog } from "./entity-ui";
import { detailHref, returnPath, useListQuery } from "./list-state";
import { Heading, Loading, Notice, useData } from "./ui";
import { UserForm } from "./user-form";
import { useResourceSelection } from "./resource-selection";

const sections = {
  profile: "Professional details",
  account: "Contact & account",
  review: "Profile review",
};

export function ProfileEditor({ id }: { id: string }) {
  const router = useRouter();
  const { params } = useListQuery();
  const back = returnPath(params.get("from"), "/network");
  const detail = detailHref("network", id, back);
  const [section, setSection] = useState<keyof typeof sections>("profile");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const leave = (action: () => void) => {
    if (busy) return;
    if (dirty) setPending(() => action);
    else action();
  };
  const cancel = () => leave(() => router.push(detail));
  const { data, error, reload } = useData<Profile>(`/resources/${id}`);
  const {
    data: account,
    error: accountError,
    reload: reloadAccount,
  } = useData<User>(`/users/${id}`);
  const {
    data: terms,
    error: termsError,
    loading: termsLoading,
    reload: reloadTerms,
  } = useData<Term[]>("/terms");
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
  const saved = (kind: string) => router.push(`${detail}&saved=${kind}`);
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
          { label: data.name, href: detail },
          { label: "Edit" },
        ]}
      />
      <Heading eyebrow="Edit resource" title={`Edit ${data.name}`}>
        <Link
          className="button secondary"
          href={detail}
          aria-disabled={busy}
          onClick={(event) => {
            event.preventDefault();
            cancel();
          }}
        >
          Cancel editing
        </Link>
      </Heading>
      <p className="page-intro">
        Choose a section to edit. Updating professional details resets the
        profile review to Pending.
      </p>
      <nav className="row" aria-label="Edit section">
        {(Object.keys(sections) as (keyof typeof sections)[]).map((key) => (
          <button
            key={key}
            type="button"
            className={section === key ? "" : "secondary"}
            aria-pressed={section === key}
            disabled={busy}
            onClick={() => {
              if (section !== key)
                leave(() => {
                  setSection(key);
                  setDirty(false);
                });
            }}
          >
            {sections[key]}
          </button>
        ))}
      </nav>
      {section === "profile" && (
        <>
          <Notice error={termsError} />
          {termsLoading && <Loading />}
          {termsError && (
            <button className="secondary" onClick={reloadTerms}>
              Reload expertise areas
            </button>
          )}
        </>
      )}
      {section === "profile" && terms && (
        <Editor
          key={data.version}
          profile={data}
          terms={terms}
          onSaved={() => saved("profile")}
          onCancel={cancel}
          onDirty={() => setDirty(true)}
          onBusy={setBusy}
        />
      )}
      {section === "account" && account && (
        <UserForm
          key={account.version}
          value={account}
          includeName={false}
          onSaved={() => saved("account")}
          onCancel={cancel}
          onDirty={() => setDirty(true)}
          onBusy={setBusy}
        />
      )}
      {section === "account" && <Notice error={accountError} />}
      {section === "account" && !account && !accountError && <Loading />}
      {section === "account" && accountError && (
        <button className="secondary" onClick={reloadAccount}>
          Reload account settings
        </button>
      )}
      {section === "review" && (
        <Review
          key={`review-${data.version}`}
          profile={data}
          onSaved={() => saved("review")}
          onDirty={() => setDirty(true)}
          onBusy={setBusy}
        />
      )}
      {pending && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          confirmLabel="Discard changes"
          onClose={() => setPending(null)}
          onConfirm={async () => {
            setDirty(false);
            pending();
          }}
        >
          <p>
            Your changes in {sections[section].toLowerCase()} have not been
            saved.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
function Editor({
  profile,
  terms,
  onSaved,
  onCancel,
  onDirty,
  onBusy,
}: {
  profile: Profile;
  terms: Term[];
  onSaved: () => void;
  onCancel: () => void;
  onDirty: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [value, setValue] = useState<ProfileInput>(profile);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selection = useResourceSelection();
  return (
    <form
      className="card stack"
      aria-label="Edit professional details"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        onBusy(true);
        setError("");
        try {
          await api(`/resources/${profile.id}`, "PUT", value);
          selection.rename(profile.id, value.name);
          onSaved();
        } catch (error) {
          setError(message(error));
        } finally {
          setBusy(false);
          onBusy(false);
        }
      }}
    >
      <h2>Professional details</h2>
      <fieldset disabled={busy}>
        <ProfileFields
          value={value}
          onChange={(next) => {
            setValue(next);
            onDirty();
          }}
          terms={terms}
        />
      </fieldset>
      <Notice error={error} />
      <div className="row">
        <button disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
function Review({
  profile,
  onSaved,
  onDirty,
  onBusy,
}: {
  profile: Profile;
  onSaved: () => void;
  onDirty: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [status, setStatus] = useState(profile.reviewStatus);
  const [note, setNote] = useState(profile.reviewNote);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card stack"
      aria-label="Edit profile review"
      onChange={onDirty}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        onBusy(true);
        setError("");
        try {
          await api(`/resources/${profile.id}/review`, "PUT", {
            status,
            note,
            version: profile.version,
          });
          onSaved();
        } catch (error) {
          setError(message(error));
        } finally {
          setBusy(false);
          onBusy(false);
        }
      }}
    >
      <h2>Profile review</h2>
      <p className="muted">
        An internal assessment of professional details. This does not verify
        identity or qualifications.
      </p>
      <label>
        Review status
        <select
          disabled={busy}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["Pending", "Verified", "NeedsChanges"].map((x) => (
            <option key={x} value={x}>
              {x === "NeedsChanges" ? "Needs changes" : x}
            </option>
          ))}
        </select>
      </label>
      <label>
        Feedback
        <textarea
          disabled={busy}
          maxLength={1000}
          required={status === "NeedsChanges"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <Notice error={error} />
      <div>
        <button disabled={busy}>{busy ? "Saving…" : "Save review"}</button>
      </div>
    </form>
  );
}
