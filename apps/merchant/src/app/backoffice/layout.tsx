import { requireBackofficeSession } from "../../server/auth-guards";
import { BackofficeNavigation } from "./backoffice-navigation";
import { OnboardingChecklist } from "./onboarding/onboarding-checklist";

export default async function BackofficeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireBackofficeSession();

  return (
    <div className="backoffice-layout">
      <BackofficeNavigation
        businessName={session.business.name}
        isOwner={session.membership.role === "owner"}
      />
      {session.membership.role === "owner" && <OnboardingChecklist />}
      <div className="backoffice-content">{children}</div>
    </div>
  );
}
