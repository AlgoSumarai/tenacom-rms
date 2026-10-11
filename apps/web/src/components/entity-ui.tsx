"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { message } from "@/lib/api";
import { Notice } from "./ui";

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 && <span aria-hidden="true"> / </span>}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// The native link remains the keyboard target and supports opening in a new tab.
// Clicking another cell is a convenience; controls inside the row keep their own behaviour.
export function LinkedRow({
  href,
  selected,
  children,
}: {
  href: string;
  selected?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      className={`linked-row${selected ? " selected-row" : ""}`}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (
          target.closest(
            "a,button,input,select,textarea,label,summary,.actions-menu",
          ) ||
          window.getSelection()?.toString()
        )
          return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}

export type ContextAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
};
export function ActionsMenu({
  label,
  actions,
}: {
  label: string;
  actions: ContextAction[];
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    root.current
      ?.querySelector<HTMLElement>(
        ".actions-popover a, .actions-popover button:not(:disabled)",
      )
      ?.focus({ preventScroll: true });
    const align = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
        setOpen(false);
        return;
      }
      setPosition({
        top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 180)),
        left: Math.max(8, Math.min(rect.right - 190, window.innerWidth - 198)),
      });
    };
    window.addEventListener("scroll", align, true);
    window.addEventListener("resize", align);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", align, true);
      window.removeEventListener("resize", align);
    };
  }, [open]);
  return (
    <div
      className="actions-menu"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="secondary icon-button"
        aria-label={`Actions for ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          const rect = trigger.current!.getBoundingClientRect();
          setPosition({
            top: Math.max(
              8,
              Math.min(rect.bottom + 4, window.innerHeight - 180),
            ),
            left: Math.max(
              8,
              Math.min(rect.right - 190, window.innerWidth - 198),
            ),
          });
          setOpen(!open);
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div
          id={id}
          className="actions-popover"
          style={position}
          aria-label={`Actions for ${label}`}
        >
          {actions.map((action) =>
            action.href ? (
              <Link
                key={action.label}
                href={action.href}
                onClick={() => setOpen(false)}
              >
                {action.label}
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                className={action.danger ? "danger" : "text-button"}
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                  action.onClick?.();
                }}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function Dialog({
  title,
  onClose,
  busy = false,
  children,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="app-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="row between dialog-heading">
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="secondary icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog title={title} busy={busy} onClose={onClose}>
      {children}
      <Notice error={error} />
      <div className="row">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await onConfirm();
              onClose();
            } catch (error) {
              setError(message(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
