import { StrictMode, Suspense, use, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  BackofficeInitialContext,
  BackofficeModulesResult,
  BackofficeModulesSeed,
} from "../../../apps/merchant/src/backoffice-context-contract";
import {
  BackofficeProvider,
  BackofficeBusinessName,
  BackofficeModulesSeedConsumer,
  useBackofficeContext,
} from "../../../apps/merchant/src/app/backoffice/backoffice-context";
import { BackofficeNavigation } from "../../../apps/merchant/src/app/backoffice/backoffice-navigation";
import { TrialNotice } from "../../../apps/merchant/src/app/backoffice/subscription/trial-notice";
import { DashboardSummary } from "../../../apps/merchant/src/app/backoffice/analytics/dashboard-summary";
import { AnalyticsInbox } from "../../../apps/merchant/src/app/backoffice/analytics/inbox";
import { fixtureBackofficeCore } from "./backoffice-seed-fixture";
import { businessModules } from "./modules-fixture";
import { createBackofficeContextController } from "../../../apps/merchant/src/app/backoffice/backoffice-context-controller";
import { panelRequest } from "../../../apps/merchant/src/app/backoffice/panel-request";
import { getOnboardingChecklist } from "../../../apps/merchant/src/app/backoffice/onboarding/onboarding-api";
import { OnboardingChecklist } from "../../../apps/merchant/src/app/backoffice/onboarding/onboarding-checklist";
import { captureOnboardingTourIntent } from "../../../apps/merchant/src/app/backoffice/onboarding/onboarding-tour-persistence";
import { ONBOARDING_TOUR_ENDED_EVENT } from "../../../apps/merchant/src/app/backoffice/onboarding/onboarding-tour";
import { BusinessSettings } from "../../../apps/merchant/src/app/backoffice/business/business-settings";
import { readModules } from "../../../apps/merchant/src/app/backoffice/settings/module-request";

export type BackofficeFixtureApi = {
  ready: boolean;
  resolveModules: (state: BackofficeModulesResult["state"]) => void;
  rejectModules: () => void;
  retire: () => void;
  lateSeed: () => void;
  changeIdentity: () => void;
  invalidateInbox: () => void;
  navigations: string[];
  refreshes: number;
  ackBoot: (bootId: string) => void;
  setInboxReaders: (count: number) => void;
  setChecklistReaders: (count: number) => void;
  persistTour: () => Promise<boolean>;
};
const query = new URLSearchParams(location.search);
const core = fixtureBackofficeCore(
  {
    businessName: "Comercio sintético",
    isOwner: !query.has("form"),
    permissions: query.has("form")
      ? ["business", "analytics", "stock"]
      : ["analytics", "stock"],
  },
  {
    user: { emailVerified: !query.has("unverified") },
    billing: { access: "trial", trialDaysLeft: 10, trialEndsAt: null },
  },
);
const initialSeed = (
  result: BackofficeModulesResult,
): BackofficeModulesSeed => ({
  bootId: core.bootId,
  scopeKey: core.scopeKey,
  result,
});
let resolve!: (seed: BackofficeModulesSeed) => void;
let reject!: (error: Error) => void;
const stream = new Promise<BackofficeModulesSeed>((done, fail) => {
  resolve = done;
  reject = fail;
}).catch(() => initialSeed({ state: "unavailable" }));
const fixture: BackofficeFixtureApi = {
  ready: false,
  resolveModules: (state) =>
    resolve(
      initialSeed(
        state === "ready"
          ? { state, modules: businessModules(true, false) }
          : { state },
      ),
    ),
  rejectModules: () => reject(new Error("synthetic modules rejection")),
  retire: () => {},
  lateSeed: () => {},
  changeIdentity: () => {},
  invalidateInbox: () => controller.invalidate(["inbox"]),
  navigations: [],
  refreshes: 0,
  ackBoot: () => {},
  setInboxReaders: () => {},
  setChecklistReaders: () => {},
  persistTour: async () => false,
};
const controller = createBackofficeContextController(core, {
  readSession: (signal) =>
    panelRequest("/api/merchant/session", "GET", undefined, { signal }),
  readModules: (signal, ticket) =>
    readModules({ signal, scopeKey: ticket.scopeKey }),
  readSummary: (signal, ticket) =>
    panelRequest("/api/analytics/summary", "GET", undefined, {
      signal,
      scopeKey: ticket.scopeKey,
    }),
  readInbox: (signal, ticket) =>
    panelRequest("/api/analytics/inbox", "GET", undefined, {
      signal,
      scopeKey: ticket.scopeKey,
    }),
  decideInbox: (command, ticket) =>
    panelRequest(
      `/api/analytics/inbox/${command.cardId}/${command.decision}`,
      "POST",
      command.body,
      { scopeKey: ticket.scopeKey },
    ),
  readChecklist: (signal, ticket) =>
    getOnboardingChecklist(signal, { scopeKey: ticket.scopeKey }),
  verifyEmail: async () => {
    const response = await fetch("/api/merchant/auth/verify-email", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("verify-email-failed");
    return response.json();
  },
  requestRefresh: () => {
    fixture.refreshes += 1;
  },
  navigate: (href) => {
    fixture.navigations.push(href);
  },
});
(
  window as unknown as { backofficeFixture: BackofficeFixtureApi }
).backofficeFixture = fixture;
function Bridge() {
  const { state, retire, applyModulesSeed, captureTicket, invalidate } =
    useBackofficeContext();
  useEffect(() => {
    fixture.retire = retire;
    fixture.lateSeed = () =>
      applyModulesSeed(
        initialSeed({ state: "ready", modules: businessModules(true, false) }),
      );
    fixture.persistTour = async () => {
      const intent = captureOnboardingTourIntent("brand", {
        captureTicket,
        invalidate,
        retire,
      });
      if (!intent) return false;
      const pending = intent.persistProgress("completed");
      window.dispatchEvent(new Event(ONBOARDING_TOUR_ENDED_EVENT));
      const saved = await pending;
      if (saved) window.dispatchEvent(new Event(ONBOARDING_TOUR_ENDED_EVENT));
      return saved;
    };
    fixture.ready = true;
  }, [retire, applyModulesSeed, captureTicket, invalidate]);
  return (
    <>
      <output aria-label="Estado módulos">{state.modules.state}</output>
      <output aria-label="Boot observado">
        {state.observedBootIds.at(-1)}
      </output>
      {query.has("checklist") && (
        <output aria-label="Estado checklist">
          {state.checklist.status}:
          {state.checklist.data?.items.filter((item) => item.done).length ?? 0}
        </output>
      )}
    </>
  );
}
function StreamedSeed() {
  return <BackofficeModulesSeedConsumer seed={use(stream)} />;
}
function InboxReaders() {
  const [readers, setReaders] = useState(Number(query.get("readers") ?? "1"));
  useEffect(() => {
    fixture.setInboxReaders = setReaders;
  }, []);
  return (
    <>
      {Array.from({ length: readers }, (_, index) => (
        <AnalyticsInbox key={index} />
      ))}
    </>
  );
}
function ChecklistReaders() {
  const [readers, setReaders] = useState(
    Number(query.get("checklistReaders") ?? "1"),
  );
  useEffect(() => {
    fixture.setChecklistReaders = setReaders;
  }, []);
  return (
    <>
      {Array.from({ length: readers }, (_, index) => (
        <OnboardingChecklist key={index} />
      ))}
    </>
  );
}
function Fixture({ initial }: { initial: BackofficeInitialContext }) {
  return (
    <BackofficeProvider initialContext={initial} controller={controller}>
      <Suspense fallback={null}>
        <StreamedSeed />
      </Suspense>
      <Bridge />
      <div className="backoffice-layout">
        <BackofficeNavigation />
        <div className="backoffice-content">
          <TrialNotice />
          <p>Contenido privado sintético</p>
          {query.has("live-name") && (
            <output aria-label="Nombre negocio actual">
              <BackofficeBusinessName />
            </output>
          )}
          {query.has("form") && (
            <BusinessSettings
              initialRegional={{
                timezone: "America/Guayaquil",
                currencyCode: "USD",
                revision: 1,
              }}
              initialFiscal={{
                chargesVat: true,
                saleVatRate: initial.bootId === core.bootId ? "12" : "5",
                recoversPurchaseVat: false,
                revision: 1,
              }}
              onCurrencyChange={() => {}}
              onAccessDenied={() => {}}
            />
          )}
          {query.has("summary") && <DashboardSummary />}
          <InboxReaders />
          {query.has("checklist") && <ChecklistReaders />}
        </div>
      </div>
    </BackofficeProvider>
  );
}
const root = createRoot(document.getElementById("root")!);
fixture.changeIdentity = () =>
  root.render(
    <Fixture
      initial={{
        ...core,
        bootId: "other-boot",
        scopeKey: "b".repeat(64),
        userId: "other-user",
      }}
    />,
  );
fixture.ackBoot = (bootId) => {
  const component = <Fixture initial={{ ...core, bootId }} />;
  root.render(
    query.has("strict") ? <StrictMode>{component}</StrictMode> : component,
  );
};
if (query.get("modules") === "ready") fixture.resolveModules("ready");
root.render(
  query.has("strict") ? (
    <StrictMode>
      <Fixture initial={core} />
    </StrictMode>
  ) : (
    <Fixture initial={core} />
  ),
);
