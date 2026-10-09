import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Tenacom · Resource network", template: "%s · Tenacom" },
  description: "Connect expertise to opportunity with Tenacom.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-ZA">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
