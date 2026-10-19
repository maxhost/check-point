import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MeasuredConsoleContent } from "../../../apps/merchant/src/modules/pos/ui/measured-console";
import { createPosClient } from "../../../apps/merchant/src/modules/pos/ui/pos-context";
let identity = "a";
const client = createPosClient(
  () => ({ identity, scopeKey: identity.repeat(64) }),
  { contractVersion: 2 },
);
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
  const [key, setKey] = useState(identity);
  const [mount, setMount] = useState(0);
  useEffect(() => {
    const change = () => {
      identity = "b";
      setKey(identity);
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
    <MeasuredConsoleContent
      key={`${key}:${mount}`}
      client={client}
      timeZone="America/Guayaquil"
      context={{
        identity: key,
        locations: [{ id: "north", name: "Local Norte" }],
        currencyCode: "USD",
        saleTypes: ["counter", "pickup", "delivery", "table"],
        tablesEnabled: false,
      }}
    />
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
