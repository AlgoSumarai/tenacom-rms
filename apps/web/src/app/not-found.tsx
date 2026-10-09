import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="public">
      <h1>Page not found</h1>
      <p>This page may have moved or you may not have access.</p>
      <Link href="/login">Return to sign in</Link>
    </main>
  );
}
