import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Text } from "../../../apps/merchant/src/ui";
import { MeasuredPosEditor } from "../../../apps/merchant/src/modules/pos/ui/measured-pos-editor";
import { MeasuredEditorSession } from "../../../apps/merchant/src/modules/pos/ui/measured-editor-model";
import { PosCache } from "../../../apps/merchant/src/modules/pos/ui/pos-cache";
import { createPosClient } from "../../../apps/merchant/src/modules/pos/ui/pos-context";
import { editorOrder } from "./pos-measured-editor-fixture";
const params = new URLSearchParams(location.search);
let identity = "identity-a";
const client = createPosClient(
  () => ({
    identity,
    scopeKey: identity === "identity-a" ? "a".repeat(64) : "b".repeat(64),
  }),
  {
    contractVersion: 2,
  },
);
const cache = new PosCache(undefined, client.request);
cache.bind(identity);
const session = new MeasuredEditorSession(
  {
    identity,
    locations: [
      { id: "north", name: "Local Norte" },
      { id: "south", name: "Local Sur" },
    ],
    currencyCode: params.has("cop") ? "COP" : "USD",
    saleTypes: ["counter", "table", "pickup", "delivery"],
    tablesEnabled: params.has("tables"),
  },
  cache,
  client,
  params.has("existing") ? editorOrder : null,
);
function Harness() {
  const [key, setKey] = useState(0);
  const [saved, setSaved] = useState("");
  const [prepared, setPrepared] = useState("");
  const [exit, setExit] = useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-2 p-4">
        <Button variant="secondary" onPress={() => setKey(key + 1)}>
          Volver a montar vista
        </Button>
        <Button
          variant="secondary"
          onPress={() => {
            identity = "identity-b";
            session.retireIdentity();
            cache.bind(identity);
          }}
        >
          Cambiar identidad
        </Button>
      </div>
      {!exit && (
        <MeasuredPosEditor
          key={key}
          session={session}
          onExit={() => setExit(true)}
          onSaved={(order) => setSaved(JSON.stringify(order))}
          onPrepare={(order) => setPrepared(JSON.stringify(order))}
        />
      )}
      <div role="status" aria-label="Guardado">
        <Text>{saved}</Text>
      </div>
      <div role="status" aria-label="Cobro preparado">
        <Text>{prepared}</Text>
      </div>
      {exit && <Text>Editor cerrado</Text>}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
