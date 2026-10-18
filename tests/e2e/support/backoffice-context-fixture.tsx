import { StrictMode, Suspense, use, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  BackofficeInitialContext,
  BackofficeModulesResult,
  BackofficeModulesSeed,
} from "../../../apps/merchant/src/backoffice-context-contract";
import {
  BackofficeProvider,
  BackofficeModulesSeedConsumer,
  useBackofficeContext,
} from "../../../apps/merchant/src/app/backoffice/backoffice-context";
import { BackofficeNavigation } from "../../../apps/merchant/src/app/backoffice/backoffice-navigation";
import { TrialNotice } from "../../../apps/merchant/src/app/backoffice/subscription/trial-notice";
import { AnalyticsInbox } from "../../../apps/merchant/src/app/backoffice/analytics/inbox";
import { fixtureBackofficeCore } from "./backoffice-seed-fixture";
import { businessModules } from "./modules-fixture";
import { createBackofficeContextController } from "../../../apps/merchant/src/app/backoffice/backoffice-context-controller";
import { panelRequest } from "../../../apps/merchant/src/app/backoffice/panel-request";
import { getOnboardingChecklist } from "../../../apps/merchant/src/app/backoffice/onboarding/onboarding-api";
import { OnboardingChecklist } from "../../../apps/merchant/src/app/backoffice/onboarding/onboarding-checklist";
import { captureOnboardingTourIntent } from "../../../apps/merchant/src/app/backoffice/onboarding/onboarding-tour-persistence";
import { ONBOARDING_TOUR_ENDED_EVENT } from "../../../apps/merchant/src/app/backoffice/onboarding/onboarding-tour";
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
  setInboxReaders: (count: number) => void;
  setChecklistReaders: (count: number) => void;
  persistTour: () => Promise<boolean>;
};
const query = new URLSearchParams(location.search);
const core = fixtureBackofficeCore(
  {
    businessName: "Comercio sintético",
    isOwner: true,
    permissions: ["analytics", "stock"],
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
  setInboxReaders: () => {},
  setChecklistReaders: () => {},
  persistTour: async () => false,
};
const controller = createBackofficeContextController(core, {
  readSession: (signal) =>
    panelRequest("/api/merchant/session", "GET", undefined, { signal }),
  readModules: (signal, ticket) =>
    readModules({ signal, scopeKey: ticket.scopeKey }),
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
