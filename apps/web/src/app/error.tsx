"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="public">
      <h1>Something went wrong</h1>
      <p>Your changes may not have been saved. Please try again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
