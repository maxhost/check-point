import { requireBackofficeSession } from "../../server/auth-guards";
import { BackofficeNavigation } from "./backoffice-navigation";
import { OnboardingChecklist } from "./onboarding/onboarding-checklist";
import { readBusinessBilling } from "../../server/billing-gate";
import { SignOutButton } from "../components/sign-out-button";
import { Text } from "../../ui";
import { TrialNotice } from "./subscription/trial-notice";

export default async function BackofficeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Spec 0189 §D4 (H1 de la revision): el layout envuelve tambien `/backoffice/subscription`, la
  // UNICA pantalla de un owner sin acceso. Si el layout aplicara el rebote de cobro, mandaria a
  // esa misma URL en bucle. El corte queda en el guard de CADA pagina (`layout-guard.test.ts`
  // fija que todas lo llaman y que solo la de suscripcion lo hace con `allowBlocked`).
  const session = await requireBackofficeSession({ allowBlocked: true });
  const billing = await readBusinessBilling(session.business.id);
  if (billing.access === "blocked" && session.business.status === "active") {
    return (
      <div className="merchant-shell">
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <Text variant="label">CheckPass · {session.business.name}</Text>
          <SignOutButton />
        </div>
        {children}
      </div>
    );
  }

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
      <div className="backoffice-content print:m-0 print:p-0">
        {session.membership.role === "owner" && billing.access === "trial" && (
          <TrialNotice />
        )}
        {children}
      </div>
    </div>
  );
}
