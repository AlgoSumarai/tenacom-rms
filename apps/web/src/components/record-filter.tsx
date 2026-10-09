"use client";
import { useState } from "react";
import type { Page } from "@/lib/types";
import { Loading, Notice, useData } from "./ui";

export function RecordFilter({
  kind,
  value,
  onChange,
  label: suppliedLabel,
  placeholder,
  required = false,
  includeInactive = false,
}: {
  kind: "resources" | "projects";
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  includeInactive?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    null,
  );
  const { data, error, loading, reload } = useData<
    Page<{ id: string; name: string }>
  >(
    `/${kind}?q=${encodeURIComponent(query)}${kind === "resources" && includeInactive ? "&includeInactive=true" : ""}`,
  );
  const label = kind === "resources" ? "Resource" : "Project";
  return (
    <div className="stack">
      <div className="filters">
        <label>
          Find {label.toLowerCase()}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => setQuery(search)}
        >
          Find {label.toLowerCase()}
        </button>
      </div>
      <label>
        {suppliedLabel || `${label} filter`}
        <select
          aria-label={suppliedLabel || `${label} filter`}
          required={required}
          disabled={loading || !!error}
          value={value}
          onChange={(e) => {
            setSelected(
              data?.items.find((x) => x.id === e.target.value) || null,
            );
            onChange(e.target.value);
          }}
        >
          <option value="">{placeholder || `All ${kind}`}</option>
          {selected && !data?.items.some((x) => x.id === selected.id) && (
            <option value={selected.id}>{selected.name}</option>
          )}
          {data?.items.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <small>Search to narrow the first 20 matches.</small>
      {loading && <Loading />}
      <Notice error={error} />
      {error && (
        <button type="button" className="secondary" onClick={reload}>
          Reload {kind}
        </button>
      )}
    </div>
  );
}
