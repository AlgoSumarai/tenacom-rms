"use client";
import { createContext, useContext, useState } from "react";

export type SelectedResource = { id: string; name: string };
type Selection = {
  selected: SelectedResource[];
  toggle: (resource: SelectedResource) => void;
  selectPage: (resources: SelectedResource[], checked: boolean) => void;
  remove: (ids: string[]) => void;
  clear: () => void;
  rename: (id: string, name: string) => void;
};
const Context = createContext<Selection | null>(null);
export function ResourceSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<SelectedResource[]>([]);
  return (
    <Context.Provider
      value={{
        selected,
        toggle: (resource) =>
          setSelected((current) =>
            current.some((x) => x.id === resource.id)
              ? current.filter((x) => x.id !== resource.id)
              : [...current, resource],
          ),
        selectPage: (resources, checked) =>
          setSelected((current) =>
            checked
              ? [
                  ...current,
                  ...resources.filter(
                    (x) => !current.some((r) => r.id === x.id),
                  ),
                ]
              : current.filter((x) => !resources.some((r) => r.id === x.id)),
          ),
        remove: (ids) =>
          setSelected((current) => current.filter((x) => !ids.includes(x.id))),
        clear: () => setSelected([]),
        rename: (id, name) =>
          setSelected((current) =>
            current.map((x) => (x.id === id ? { ...x, name } : x)),
          ),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useResourceSelection() {
  const value = useContext(Context);
  if (!value) throw new Error("Resource selection is unavailable.");
  return value;
}
