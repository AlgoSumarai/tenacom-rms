"use client";
import { useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const changeEvent = "tenacom-list-query";
function subscribe(callback: () => void) {
  window.addEventListener(changeEvent, callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener(changeEvent, callback);
    window.removeEventListener("popstate", callback);
  };
}
const currentSearch = () => window.location.search;

export function useListQuery() {
  const routeParams = useSearchParams();
  const pathname = usePathname();
  const search = useSyncExternalStore(subscribe, currentSearch, () =>
    routeParams.size ? `?${routeParams}` : "",
  );
  const params = new URLSearchParams(search);
  const update = (values: Record<string, string | number | boolean>) => {
    // Read the current URL so rapid changes and the two people tables cannot overwrite each other.
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(values)) {
      if (value === "" || value === false || value === 1) next.delete(key);
      else next.set(key, String(value));
    }
    window.history.replaceState(
      null,
      "",
      `${pathname}${next.size ? `?${next}` : ""}`,
    );
    window.dispatchEvent(new Event(changeEvent));
  };
  return {
    params,
    update,
    href: `${pathname}${params.size ? `?${params}` : ""}`,
  };
}

export function returnPath(value: string | null, fallback: string) {
  if (!value) return fallback;
  try {
    const parsed = new URL(value, "http://local.invalid");
    return parsed.origin === "http://local.invalid" &&
      (["/network", "/users", "/projects"].includes(parsed.pathname) ||
        /^\/projects\/[0-9a-f-]{36}$/i.test(parsed.pathname))
      ? parsed.pathname + parsed.search
      : fallback;
  } catch {
    return fallback;
  }
}

export function detailHref(
  kind: "network" | "users",
  id: string,
  back: string,
  edit = false,
) {
  return `/${kind}/${id}${edit ? "/edit" : ""}?from=${encodeURIComponent(back)}`;
}
