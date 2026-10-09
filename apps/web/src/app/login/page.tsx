import { LoginForm } from "@/components/login-form";
import { BrandLogo } from "@/components/brand-logo";
export default function Login() {
  return (
    <main id="main" className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <BrandLogo />
        </div>
        <p className="eyebrow">The Tenacom resource network</p>
        <h1>
          The right people.
          <br />
          The next possibility.
        </h1>
        <p>
          A shared home for professional expertise, project collaboration, and
          work that makes a difference.
        </p>
        <footer>CONNECTED EXPERTISE · SOUTH AFRICA</footer>
      </section>
      <section className="auth-form">
        <p className="eyebrow">Welcome back</p>
        <h1>Your network. Connected.</h1>
        <p className="muted">Sign in to continue to your workspace.</p>
        <LoginForm />
      </section>
    </main>
  );
}
