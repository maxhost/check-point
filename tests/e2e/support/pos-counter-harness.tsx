import { createRoot } from "react-dom/client";
import { PosConsole } from "../../../apps/merchant/src/app/backoffice/pos/pos-console";
import { PosSettings } from "../../../apps/merchant/src/app/backoffice/settings/pos-settings";
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
const mode = new URLSearchParams(window.location.search).get("mode");
createRoot(document.getElementById("root")!).render(
  <div className="backoffice-layout print:block">
    <BackofficeNavigation
      businessName="Café de prueba"
      isOwner={mode === "settings"}
      permissions={mode === "settings" ? ["pos", "staff"] : ["pos"]}
    />
    <div className="backoffice-content print:m-0 print:p-0">
      {mode === "settings" ? (
        <PosSettings />
      ) : mode === "permissions-off" || mode === "permissions-on" ? (
        <PermissionPicker
          value={[]}
          onChange={() => {}}
          isOwner
          posEnabled={mode === "permissions-on"}
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
