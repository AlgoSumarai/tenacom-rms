"use client";
import { useEffect, useState, useCallback } from "react";
import { api, ApiError, message } from "@/lib/api";
import type { Page } from "@/lib/types";

export function useData<T>(path: string | null) {
  const [result, setResult] = useState<{ path: string; value: T } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((x) => x + 1), []);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    if (!path) return;
    setLoading(true);
    setError("");
    api<T>(path, "GET", undefined, controller.signal)
      .then((value) => {
        if (current) {
          setResult({ path, value });
          setError("");
        }
      })
      .catch((e) => {
        if (current) {
          setError(message(e));
          setResult(null);
          if (e instanceof ApiError && e.status === 401)
            window.location.assign("/login");
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [path, revision]);
  const data = path && result?.path === path ? result.value : null;
  return {
    data,
    error,
    loading: !!path && (loading || (!data && !error)),
    reload,
  };
}
export function Notice({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  return (
    <>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="notice success" role="status">
          {success}
        </p>
      )}
    </>
  );
}
export function Heading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow || "Resource workspace"}</p>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Loading() {
  return (
    <p className="loading" role="status">
      Loading your workspace…
    </p>
  );
}
export function Pager<T>({
  data,
  onPage,
  label = "Pagination",
  disabled = false,
}: {
  data: Page<T>;
  onPage: (page: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <nav className="pager" aria-label={label}>
      <span>
        {data.total} results · Page {data.pageNumber} of{" "}
        {Math.max(1, Math.ceil(data.total / data.pageSize))}
      </span>
      <button
        type="button"
        className="secondary"
        disabled={disabled || data.pageNumber <= 1}
        onClick={() => onPage(data.pageNumber - 1)}
      >
        Previous
      </button>
      <button
        type="button"
        className="secondary"
        disabled={disabled || data.pageNumber * data.pageSize >= data.total}
        onClick={() => onPage(data.pageNumber + 1)}
      >
        Next
      </button>
    </nav>
  );
}
export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}
