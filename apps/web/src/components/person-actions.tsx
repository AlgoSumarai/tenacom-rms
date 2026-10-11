"use client";
import { useState } from "react";
import { api, message } from "@/lib/api";
import type { User } from "@/lib/types";
import { ActionsMenu, Dialog } from "./entity-ui";
import { AssignResourcesDialog } from "./assign-resources-dialog";
import { detailHref } from "./list-state";
import { Notice } from "./ui";
import { useUser } from "./session";
import { useResourceSelection } from "./resource-selection";
import { useFeedback } from "./feedback";

export function PersonActions({
  person,
  back,
  onChanged,
}: {
  person: Pick<User, "id" | "name" | "role" | "active">;
  back: string;
  onChanged: () => void;
}) {
  const actor = useUser();
  const selection = useResourceSelection();
  const [assign, setAssign] = useState(false);
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notify = useFeedback();
  const resource = person.role === "Resource";
  const canManage = actor.role === "Admin" || resource;
  if (!canManage) return null;
  return (
    <>
      <ActionsMenu
        label={person.name}
        actions={[
          {
            label: "Edit",
            href: detailHref(
              resource ? "network" : "users",
              person.id,
              back,
              true,
            ),
          },
          ...(resource && actor.role === "Admin"
            ? [
                {
                  label: "Add to Project",
                  disabled: !person.active,
                  onClick: () => setAssign(true),
                },
              ]
            : []),
          {
            label: "Remove",
            danger: true,
            disabled: !person.active || person.id === actor.id,
            onClick: () => {
              setError("");
              setRemove(true);
            },
          },
        ]}
      />
      {assign && (
        <AssignResourcesDialog
          resources={[{ id: person.id, name: person.name }]}
          onClose={() => setAssign(false)}
          onAssigned={(ids) => {
            selection.remove(ids);
            onChanged();
          }}
        />
      )}
      {remove && (
        <Dialog
          title={`Remove ${person.name}?`}
          onClose={() => setRemove(false)}
          busy={busy}
        >
          <p>
            This deactivates{" "}
            {resource
              ? "the resource profile and prevents new project assignments"
              : "the staff account and immediately revokes sign-in access"}
            . Project assignments and recorded time remain available. An
            authorised team member can reactivate the person from their editor.
          </p>
          <p>
            Removing a person does not delete their project history or remove a
            specific project association.
          </p>
          <Notice error={error} />
          <div className="row">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setRemove(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const current = await api<User>(`/users/${person.id}`);
                  await api(`/users/${person.id}`, "PUT", {
                    ...current,
                    active: false,
                  });
                  selection.remove([person.id]);
                  notify(
                    `${person.name} was deactivated. History has been retained.`,
                  );
                  setRemove(false);
                  onChanged();
                } catch (error) {
                  setError(message(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Removing…" : "Deactivate person"}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
