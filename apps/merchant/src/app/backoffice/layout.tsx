import { requireBackofficeSession } from "../../server/auth-guards";
import { BackofficeNavigation } from "./backoffice-navigation";
import { OnboardingChecklist } from "./onboarding/onboarding-checklist";

export default async function BackofficeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Spec 0189 §D4 (H1 de la revision): el layout envuelve tambien `/backoffice/subscription`, la
  // UNICA pantalla de un owner sin acceso. Si el layout aplicara el rebote de cobro, mandaria a
  // esa misma URL en bucle. El corte queda en el guard de CADA pagina (`layout-guard.test.ts`
  // fija que todas lo llaman y que solo la de suscripcion lo hace con `allowBlocked`).
  const session = await requireBackofficeSession({ allowBlocked: true });

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
