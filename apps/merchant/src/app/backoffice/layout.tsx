import { requireBackofficeSession } from "../../server/auth-guards";
import { BackofficeNavigation } from "./backoffice-navigation";
import { OnboardingChecklist } from "./onboarding/onboarding-checklist";

export default async function BackofficeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireBackofficeSession();

  return (
    <div className="backoffice-layout print:block">
      <BackofficeNavigation
        businessName={session.business.name}
        isOwner={session.membership.role === "owner"}
        permissions={session.membership.permissions}
      />
      {session.membership.role === "owner" && (
        <div className="contents print:hidden">
          <OnboardingChecklist />
        </div>
      )}
      <div className="backoffice-content print:m-0 print:p-0">{children}</div>
    </div>
  );
}
