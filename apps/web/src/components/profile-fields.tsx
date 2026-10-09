"use client";
import { useState } from "react";
import type { ProfileInput, Term } from "@/lib/types";
export const blankProfile: ProfileInput = {
  name: "",
  headline: "",
  summary: "",
  phone: "",
  location: "",
  status: "Available",
  terms: [],
  version: 1,
};
export function ProfileFields({
  value,
  onChange,
  terms,
  section = "all",
}: {
  value: ProfileInput;
  onChange: (v: ProfileInput) => void;
  terms: Term[];
  section?: "basics" | "expertise" | "all";
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(section !== "basics");
  const field = (key: keyof ProfileInput, text: string) =>
    onChange({ ...value, [key]: text });
  return (
    <>
      {section !== "expertise" && (
        <div className="form-grid">
          <label>
            Full name
            <input
              required
              value={value.name}
              maxLength={120}
              autoComplete="name"
              onChange={(e) => field("name", e.target.value)}
            />
          </label>
          <label>
            Professional headline
            <input
              required
              value={value.headline}
              maxLength={160}
              placeholder="e.g. Mechanical engineer & product designer"
              onChange={(e) => field("headline", e.target.value)}
            />
          </label>
          {section === "basics" && (
            <button
              type="button"
              className="secondary full"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded
                ? "Hide optional details"
                : "Add location and more (optional)"}
            </button>
          )}
          {expanded && (
            <>
              <label>
                City or region
                <input
                  value={value.location}
                  maxLength={120}
                  autoComplete="address-level2"
                  onChange={(e) => field("location", e.target.value)}
                />
              </label>
              <label>
                Phone (optional)
                <input
                  type="tel"
                  value={value.phone}
                  maxLength={40}
                  autoComplete="tel"
                  onChange={(e) => field("phone", e.target.value)}
                />
              </label>
              <label className="full">
                A little about your work
                <textarea
                  value={value.summary}
                  maxLength={3000}
                  placeholder="Your experience, interests, and the problems you enjoy solving."
                  onChange={(e) => field("summary", e.target.value)}
                />
              </label>
              <label>
                Availability
                <select
                  value={value.status}
                  onChange={(e) => field("status", e.target.value)}
                >
                  {["Available", "Limited", "Unavailable"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      )}
      {section !== "basics" && (
        <section className="stack">
          <div>
            <h2 className="section-label">Your expertise</h2>
            <p className="muted">
              Choose the fields, industries, skills and areas of expertise that
              best describe your professional experience.
            </p>
            <label>
              Find an area
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fields and skills…"
              />
            </label>
          </div>
          {["Field", "Industry", "Skill", "Expertise"].map((kind) => (
            <fieldset key={kind}>
              <legend>
                {kind === "Expertise" ? "Areas of expertise" : `${kind}s`}
              </legend>
              <div className="term-picker">
                {terms
                  .filter(
                    (t) =>
                      t.kind === kind &&
                      t.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((term) => {
                    const selected = value.terms.some(
                      (t) => t.termId === term.id,
                    );
                    return (
                      <button
                        key={term.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          onChange({
                            ...value,
                            terms: selected
                              ? value.terms.filter((t) => t.termId !== term.id)
                              : [
                                  ...value.terms,
                                  {
                                    termId: term.id,
                                    proficiency: "Practitioner",
                                    years: null,
                                  },
                                ],
                          })
                        }
                      >
                        {selected ? "✓ " : "+ "}
                        {term.name}
                      </button>
                    );
                  })}
              </div>
            </fieldset>
          ))}
          {terms.length === 0 && (
            <p className="muted">
              Your professional summary is a good place to describe your
              expertise while Tenacom prepares its categories.
            </p>
          )}
          <details>
            <summary>Experience level (optional)</summary>
            {value.terms.map((term) => (
              <div className="term-details" key={term.termId}>
                <span>{terms.find((x) => x.id === term.termId)?.name}</span>
                <label>
                  Proficiency
                  <select
                    value={term.proficiency}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        terms: value.terms.map((t) =>
                          t.termId === term.termId
                            ? { ...t, proficiency: e.target.value }
                            : t,
                        ),
                      })
                    }
                  >
                    {["Learning", "Practitioner", "Advanced", "Expert"].map(
                      (x) => (
                        <option key={x}>{x}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Years
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={term.years ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        terms: value.terms.map((t) =>
                          t.termId === term.termId
                            ? {
                                ...t,
                                years:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              }
                            : t,
                        ),
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </details>
          <small>
            Missing a specialist area? Mention it in your summary so the Tenacom
            team can add it to the network.
          </small>
        </section>
      )}
    </>
  );
}
