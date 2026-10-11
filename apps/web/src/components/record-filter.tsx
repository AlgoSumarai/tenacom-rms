"use client";
import { useState } from "react";
import type { Page } from "@/lib/types";
import { Loading, Notice, Pager, useData } from "./ui";

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
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    null,
  );
  const { data, error, loading, reload } = useData<
    Page<{ id: string; name: string }>
  >(
    `/${kind}?q=${encodeURIComponent(query)}&page=${page}${kind === "resources" && includeInactive ? "&includeInactive=true" : ""}`,
  );
  const { data: currentSelection } = useData<{ id: string; name: string }>(
    value && !data?.items.some((x) => x.id === value)
      ? `/${kind}/${value}`
      : null,
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setQuery(search);
                setPage(1);
              }
            }}
            maxLength={100}
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setQuery(search);
            setPage(1);
          }}
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
          {currentSelection &&
            currentSelection.id !== selected?.id &&
            !data?.items.some((x) => x.id === currentSelection.id) && (
              <option value={currentSelection.id}>
                {currentSelection.name}
              </option>
            )}
          {data?.items.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      {data && (
        <Pager
          data={data}
          onPage={setPage}
          label={`${suppliedLabel || label} choices pagination`}
        />
      )}
      <small>Search or browse pages to find a {label.toLowerCase()}.</small>
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
