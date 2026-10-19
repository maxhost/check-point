import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MeasuredConsole } from "../../../apps/merchant/src/modules/pos/ui/measured-console";
import { BackofficeProvider } from "../../../apps/merchant/src/app/backoffice/backoffice-context";
import { createBackofficeContextController } from "../../../apps/merchant/src/app/backoffice/backoffice-context-controller";
import { actionCore, actionModule } from "./pos-console-actions-fixture";
function context(scope = "a") {
  const core = actionCore(scope);
  const controller = createBackofficeContextController(core, {
    readSession: async () => {
      throw new Error("Unexpected session read");
    },
    readModules: async () => {
      throw new Error("Unexpected modules read");
    },
    readSummary: async () => {
      throw new Error("Unexpected summary read");
    },
    requestRefresh: () => {},
    navigate: () => {},
  });
  controller.applyModulesSeed({
    bootId: core.bootId,
    scopeKey: core.scopeKey,
    result: { state: "ready", modules: [actionModule] },
  });
  return { core, controller };
}
declare global {
  interface Window {
    consoleActions: {
      choices: number;
      writes: number;
      browsers: number;
      delay: number;
      fail: boolean;
      chooseFail: boolean;
    };
  }
}
const probe = (window.consoleActions = {
  choices: 0,
  writes: 0,
  browsers: 0,
  delay: 0,
  fail: false,
  chooseFail: false,
});
window.print = () => {
  probe.browsers++;
};
Object.defineProperty(navigator, "serial", {
  configurable: true,
  value: undefined,
});
Object.defineProperty(navigator, "bluetooth", {
  configurable: true,
  value: {
    async requestDevice() {
      probe.choices++;
      if (probe.delay)
        await new Promise((resolve) => setTimeout(resolve, probe.delay));
      if (probe.chooseFail) throw new Error("selection failed");
      return {
        name: "Console fixture",
        gatt: {
          async connect() {
            return {
              async getPrimaryService() {
                return {
                  async getCharacteristics() {
                    return [
                      {
                        properties: {
                          write: true,
                          writeWithoutResponse: false,
                        },
                        async writeValueWithResponse() {
                          if (probe.fail) throw new Error("write failed");
                          probe.writes++;
                        },
                      },
                    ];
                  },
                };
              },
            };
          },
          disconnect() {},
        },
      };
    },
  },
});
function Harness() {
  const [current, setCurrent] = useState(() => context());
  const [mount, setMount] = useState(0);
  useEffect(() => {
    const change = () => {
      setCurrent(context("b"));
    };
    const remount = () => setMount((n) => n + 1);
    window.addEventListener("actions-identity", change);
    window.addEventListener("actions-remount", remount);
    return () => {
      window.removeEventListener("actions-identity", change);
      window.removeEventListener("actions-remount", remount);
    };
  }, []);
  return (
    <BackofficeProvider
      key={current.core.scopeKey}
      initialContext={current.core}
      controller={current.controller}
    >
      <MeasuredConsole
        key={mount}
        locations={[{ id: "north", name: "Local Norte" }]}
      />
    </BackofficeProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
