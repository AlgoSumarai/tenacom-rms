"use client";
import { useEffect, useRef, useState } from "react";
import { api, message } from "@/lib/api";
import type { Term } from "@/lib/types";
import { blankProfile, ProfileFields } from "./profile-fields";
import { Notice, useData } from "./ui";
export function Onboarding() {
  const { data: terms, error: loadError } = useData<Term[]>("/terms");
  const [profile, setProfile] = useState(blankProfile);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const successHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (done) {
      window.scrollTo({ top: 0, behavior: "instant" });
      successHeading.current?.focus();
    }
  }, [done]);
  if (done)
    return (
      <section
        className="card submission-success"
        aria-labelledby="submission-thank-you"
      >
        <span className="submission-check" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none">
            <path
              d="M17 33L27 43L48 22"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 id="submission-thank-you" ref={successHeading} tabIndex={-1}>
          Thank you!
        </h1>
        <p>Thank you for providing your details.</p>
        <p>
          Your information has been saved to Tenacom’s resource network. Our
          team will contact you when a suitable opportunity comes along.
        </p>
      </section>
    );
  return (
    <>
      <p className="eyebrow">A connection worth keeping</p>
      <h1>
        Bring your expertise.
        <br />
        Discover what’s next.
      </h1>
      <p className="muted">
        Share your professional details with Tenacom. Start with the essentials
        and add any other information you would like us to know.
      </p>
      <div className="steps" aria-label="Registration progress">
        {["About you", "Your expertise", "Review & submit"].map((x, i) => (
          <span
            key={x}
            className={step === i ? "active" : ""}
            aria-current={step === i ? "step" : undefined}
          >
            0{i + 1} · {x}
          </span>
        ))}
      </div>
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (step < 2) {
            setStep(step + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
          setBusy(true);
          try {
            const token = window.location.hash.slice(1);
            await api("/onboarding", "POST", {
              token,
              email,
              consent,
              profile,
              website: "",
            });
            window.history.replaceState(null, "", "/join");
            setDone(true);
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {step === 0 && (
          <>
            <ProfileFields
              value={profile}
              onChange={setProfile}
              terms={terms || []}
              section="basics"
            />
            <label>
              Email address
              <input
                type="email"
                required
                value={email}
                maxLength={254}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </>
        )}
        {step === 1 && (
          <ProfileFields
            value={profile}
            onChange={setProfile}
            terms={terms || []}
            section="expertise"
          />
        )}
        {step === 2 && (
          <>
            <h2>Looking good, {profile.name.split(" ")[0]}.</h2>
            <dl>
              <dt>Name</dt>
              <dd>{profile.name}</dd>
              <dt>Professional headline</dt>
              <dd>{profile.headline}</dd>
              <dt>Email</dt>
              <dd>{email}</dd>
              <dt>Expertise</dt>
              <dd>
                {profile.terms
                  .map((t) => terms?.find((x) => x.id === t.termId)?.name)
                  .join(" · ") || "No areas selected"}
              </dd>
            </dl>
            <p className="muted">
              Tenacom’s authorised team will use your contact and professional
              information to maintain its resource network and consider you for
              projects. Submitting your details does not guarantee work. Your
              profile is not visible to other resources. Contact the Tenacom
              person who invited you to request correction or removal.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I agree that Tenacom may retain and use my information for this
              purpose.
            </label>
          </>
        )}
        <Notice error={error || loadError} />
        <div className="row between">
          {step > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          <button disabled={busy}>
            {busy
              ? "Submitting your details…"
              : step === 2
                ? "Submit details →"
                : "Continue →"}
          </button>
        </div>
      </form>
    </>
  );
}
