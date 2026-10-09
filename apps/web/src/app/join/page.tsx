import { Onboarding } from "@/components/onboarding";
import { BrandLogo } from "@/components/brand-logo";
export default function Join() {
  return (
    <>
      <header className="public-header">
        <div className="brand">
          <BrandLogo />
        </div>
        <span className="badge">Professional network</span>
      </header>
      <main id="main" className="onboard">
        <Onboarding />
      </main>
    </>
  );
}
