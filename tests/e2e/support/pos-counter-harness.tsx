import { TrialNotice } from "../../../apps/merchant/src/app/backoffice/subscription/trial-notice";
import { TicketSettings } from "../../../apps/merchant/src/modules/pos/ui/ticket-settings";
import { operationModules } from "./modules-fixture";
import { createRoot } from "react-dom/client";
import { PosConsole } from "../../../apps/merchant/src/modules/pos/ui/pos-console";
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
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");
// El menú usa el mismo rol y permisos que la sesión simulada.
const settingsOwner = mode === "settings" && params.get("role") !== "staff";
createRoot(document.getElementById("root")!).render(
  <div className="backoffice-layout print:block">
    <BackofficeNavigation
      businessName="Café de prueba"
      isOwner={settingsOwner}
      permissions={settingsOwner ? ["pos", "staff"] : ["pos"]}
    />
    <div className="backoffice-content print:m-0 print:p-0">
      {params.has("trial") && <TrialNotice />}
      {mode === "settings" ? (
        <ModuleConfiguration
          panels={[{ moduleId: "pos", content: <TicketSettings /> }]}
        />
      ) : mode === "permissions-off" || mode === "permissions-on" ? (
        <PermissionPicker
          value={[]}
          onChange={() => {}}
          isOwner
          modules={operationModules(mode === "permissions-on", false)}
        />
      ) : (
        <PosConsole
          locations={[
            { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", name: "Centro" },
            { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", name: "Norte" },
          ]}
        />
      )}
    </div>
  </div>,
);
