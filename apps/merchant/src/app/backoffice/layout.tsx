import { requireBackofficeSession } from "../../server/auth-guards";
import { Suspense } from "react";
import { BackofficeNavigation } from "./backoffice-navigation";
import { BackofficeShell } from "./backoffice-shell";
import { OnboardingChecklist } from "./onboarding/onboarding-checklist";
import { readBackofficeInitialCore } from "../../server/backoffice-initial-context";
import { SignOutButton } from "../components/sign-out-button";
import { Text } from "../../ui";
import { TrialNotice } from "./subscription/trial-notice";
import {
  BackofficeProvider,
  BackofficeBusinessName,
} from "./backoffice-context";
import { BackofficeModulesSeed } from "./backoffice-modules-seed";

export default async function BackofficeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Spec 0189 §D4 (H1 de la revision): el layout envuelve tambien `/backoffice/subscription`, la
  // UNICA pantalla de un owner sin acceso. Si el layout aplicara el rebote de cobro, mandaria a
  // esa misma URL en bucle. El corte queda en el guard de CADA pagina (`layout-guard.test.ts`
  // fija que todas lo llaman y que solo la de suscripcion lo hace con `allowBlocked`).
  await requireBackofficeSession({ allowBlocked: true });
  const core = await readBackofficeInitialCore();
  const { business, billing } = core;
  const blocked = billing.access === "blocked" && business.status === "active";
  return (
    <BackofficeProvider initialContext={core}>
      <Suspense fallback={null}>
        <BackofficeModulesSeed bootId={core.bootId} scopeKey={core.scopeKey} />
      </Suspense>
      {blocked ? (
        <div className="merchant-shell">
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <Text variant="label">
              CheckPass · <BackofficeBusinessName />
            </Text>
            <SignOutButton />
          </div>
          {children}
        </div>
      ) : (
        <BackofficeShell>
          <BackofficeNavigation />
          {core.membership.role === "owner" && (
            <div className="contents print:hidden">
              <OnboardingChecklist />
            </div>
          )}
          <div className="backoffice-content print:m-0 print:p-0">
            <TrialNotice />
            {children}
          </div>
        </BackofficeShell>
      )}
    </BackofficeProvider>
  );
}
