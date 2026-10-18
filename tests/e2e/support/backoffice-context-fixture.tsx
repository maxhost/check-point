import { Suspense, use, useEffect } from "react";
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

export type BackofficeFixtureApi = {
  ready: boolean;
  resolveModules: (state: BackofficeModulesResult["state"]) => void;
  rejectModules: () => void;
  retire: () => void;
  lateSeed: () => void;
  changeIdentity: () => void;
};
const query = new URLSearchParams(location.search);
const core = fixtureBackofficeCore(
  {
    businessName: "Comercio sintético",
    isOwner: true,
    permissions: ["analytics", "stock"],
  },
  { billing: { access: "trial", trialDaysLeft: 10, trialEndsAt: null } },
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
};
(
  window as unknown as { backofficeFixture: BackofficeFixtureApi }
).backofficeFixture = fixture;
function Bridge() {
  const { state, retire, applyModulesSeed } = useBackofficeContext();
  useEffect(() => {
    fixture.retire = retire;
    fixture.lateSeed = () =>
      applyModulesSeed(
        initialSeed({ state: "ready", modules: businessModules(true, false) }),
      );
    fixture.ready = true;
  }, [retire, applyModulesSeed]);
  return <output aria-label="Estado módulos">{state.modules.state}</output>;
}
function StreamedSeed() {
  return <BackofficeModulesSeedConsumer seed={use(stream)} />;
}
function Fixture({ initial }: { initial: BackofficeInitialContext }) {
  return (
    <BackofficeProvider initialContext={initial}>
      <Suspense fallback={null}>
        <StreamedSeed />
      </Suspense>
      <Bridge />
      <div className="backoffice-layout">
        <BackofficeNavigation />
        <div className="backoffice-content">
          <TrialNotice />
          <p>Contenido privado sintético</p>
          <AnalyticsInbox />
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
root.render(<Fixture initial={core} />);
