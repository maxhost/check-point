import { useSyncExternalStore } from "react";
import { MeasuredEditorCustomer } from "../../../apps/merchant/src/modules/pos/ui/measured-editor-customer";
import { MeasuredEditorSession } from "../../../apps/merchant/src/modules/pos/ui/measured-editor-model";
import { createPosClient } from "../../../apps/merchant/src/modules/pos/ui/pos-context";
import { PosCache } from "../../../apps/merchant/src/modules/pos/ui/pos-cache";
import { staffDefaultPermissions } from "../../../apps/merchant/src/app/backoffice/staff/staff-contract";
import { TrialNotice } from "../../../apps/merchant/src/app/backoffice/subscription/trial-notice";
import { TicketSettings } from "../../../apps/merchant/src/modules/pos/ui/ticket-settings";
import { operationModules } from "./modules-fixture";
import { renderBackofficeSeedFixture } from "./backoffice-seed-fixture";
import { MeasuredConsole } from "../../../apps/merchant/src/modules/pos/ui/measured-console";
import { ModuleConfiguration } from "../../../apps/merchant/src/app/backoffice/settings/module-configuration";
import { BackofficeNavigation } from "../../../apps/merchant/src/app/backoffice/backoffice-navigation";
import { PermissionPicker } from "../../../apps/merchant/src/app/backoffice/staff/permission-picker";
// Exercise the real QrScanner lifecycle with a deterministic camera stream.
const camera = window as unknown as {
  posCameraToken: string | null;
  posCameraStarts: number;
  posCameraStops: number;
};
camera.posCameraToken = null;
camera.posCameraStarts = 0;
camera.posCameraStops = 0;
Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
  configurable: true,
  get: () => null,
  set: () => {},
});
Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
  configurable: true,
  get: () => 2,
});
HTMLMediaElement.prototype.play = () => Promise.resolve();
Object.defineProperty(navigator, "mediaDevices", {
  configurable: true,
  value: {
    getUserMedia: async () => {
      camera.posCameraStarts += 1;
      let stopped = false;
      const track = {
        stop: () => {
          if (!stopped) {
            stopped = true;
            camera.posCameraStops += 1;
          }
        },
      };
      return { getTracks: () => [track] };
    },
  },
});
Object.defineProperty(window, "BarcodeDetector", {
  configurable: true,
  value: class {
    async detect() {
      return camera.posCameraToken
        ? [
            { rawValue: camera.posCameraToken },
            { rawValue: camera.posCameraToken },
          ]
        : [];
    }
  },
});

const customerClient = createPosClient(
  () => ({ identity: "test", scopeKey: "a".repeat(64) }),
  { contractVersion: 2 },
);
const customerCache = new PosCache(undefined, customerClient.request);
customerCache.bind("test");
const customerSession = new MeasuredEditorSession(
  {
    identity: "test",
    locations: [{ id: "north", name: "Norte" }],
    currencyCode: "USD",
    saleTypes: ["counter"],
    tablesEnabled: false,
  },
  customerCache,
  customerClient,
  null,
);
function CustomerFixture() {
  useSyncExternalStore(
    customerSession.subscribe,
    customerSession.getSnapshot,
    customerSession.getSnapshot,
  );
  return <MeasuredEditorCustomer session={customerSession} />;
}

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");
// El menú usa el mismo rol y permisos que la sesión simulada.
const settingsOwner = params.get("role") !== "staff";
const fixturePermissions =
  params.get("permissions")?.split(",") ??
  (settingsOwner ? ["pos", "staff", "counter"] : ["pos"]);
void renderBackofficeSeedFixture(
  <div className="backoffice-layout print:block">
    <BackofficeNavigation />
    <div className="backoffice-content print:m-0 print:p-0">
      {params.has("trial") && <TrialNotice />}
      {mode === "navigation" ? null : mode === "customer" ? (
        <CustomerFixture />
      ) : mode === "settings" ? (
        <ModuleConfiguration
          panels={[{ moduleId: "pos", content: <TicketSettings /> }]}
        />
      ) : mode === "permissions-off" || mode === "permissions-on" ? (
        <PermissionPicker
          value={staffDefaultPermissions(
            operationModules(mode === "permissions-on", false),
          )}
          onChange={() => {}}
          isOwner
          modules={operationModules(mode === "permissions-on", false)}
        />
      ) : (
        <MeasuredConsole
          locations={[
            { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", name: "Centro" },
            { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", name: "Norte" },
          ]}
        />
      )}
    </div>
  </div>,
  {
    businessName: "Café de prueba",
    isOwner: params.has("trial") || settingsOwner,
    permissions: fixturePermissions,
  },
);
