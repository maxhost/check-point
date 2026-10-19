import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "../../../apps/merchant/src/ui";
import { MeasuredConsoleContent } from "../../../apps/merchant/src/modules/pos/ui/measured-console";
import { createPosClient } from "../../../apps/merchant/src/modules/pos/ui/pos-context";
let identity = "A";
const client = createPosClient(
  () => ({ identity, scopeKey: identity.toLowerCase().repeat(64) }),
  { contractVersion: 2 },
);
function Harness() {
  const [key, setKey] = useState(identity);
  useEffect(() => {
    const change = () => {
      identity = "B";
      setKey(identity);
    };
    window.addEventListener("connected-context-change", change);
    return () => window.removeEventListener("connected-context-change", change);
  }, []);
  return (
    <>
      <Button
        variant="quiet"
        onPress={() => {
          identity = "B";
          setKey(identity);
        }}
      >
        Cambiar identidad
      </Button>
      <MeasuredConsoleContent
        key={key}
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
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
