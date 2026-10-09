"use client";
import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, message } from "@/lib/api";
import type { User } from "@/lib/types";
import { useData, Loading, Notice } from "./ui";
import { BrandLogo } from "./brand-logo";

const Session = createContext<User | null>(null);
export function useUser() {
  const user = useContext(Session);
  if (!user) throw new Error("Session is unavailable");
  return user;
}
export function Workspace({ children }: { children: React.ReactNode }) {
  const { data: user, error } = useData<User>("/auth/me");
  const path = usePathname();
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  if (!user)
    return (
      <main id="main" className="public">
        {!error && <Loading />}
        <Notice error={error} />
      </main>
    );
  const links = [
    ["/network", "Resource network"],
    ["/projects", "Projects"],
    ["/hours", "Tracked hours"],
    ["/users", "People & access"],
    ["/invitations", "Invite resources"],
  ];
  return (
    <Session.Provider value={user}>
      <div className="workspace">
        <aside className="sidebar">
          <Link href={links[0][0]} className="brand">
            <BrandLogo />
            <span className="brand-sub">RESOURCE NETWORK</span>
          </Link>
          <p className="nav-label">WORKSPACE</p>
          <nav aria-label="Workspace">
            {links.map(([href, text], i) => (
              <Link
                key={href}
                href={href}
                aria-current={path.startsWith(href) ? "page" : undefined}
              >
                <span aria-hidden="true" className="nav-number">
                  0{i + 1}
                </span>
                {text}
              </Link>
            ))}
          </nav>
          <div className="sidebar-footer">
            <span className="status-dot" /> Connected expertise.
            <br />
            Meaningful work.
          </div>
        </aside>
        <div className="main-column">
          <header className="topbar">
            <span className="muted">Tenacom / Resource management</span>
            <div className="account">
              <Link href="/account">{user.name}</Link>
              <span className="badge">{user.role}</span>
              <button
                className="text-button"
                disabled={signingOut}
                onClick={async () => {
                  setSigningOut(true);
                  try {
                    await api("/auth/logout", "POST");
                    window.location.assign("/login");
                  } catch (e) {
                    setSignOutError(message(e));
                    setSigningOut(false);
                  }
                }}
              >
                Sign out
              </button>
            </div>
          </header>
          <main id="main" className="main-content">
            <Notice error={signOutError} />
            {children}
          </main>
          <footer className="app-footer">
            TENACOM <span>People. Expertise. Possibility.</span>
          </footer>
        </div>
      </div>
    </Session.Provider>
  );
}
