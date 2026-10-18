import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Text } from "../../../apps/merchant/src/ui";
import { BackofficeProvider } from "../../../apps/merchant/src/app/backoffice/backoffice-context";
import { createBackofficeContextController } from "../../../apps/merchant/src/app/backoffice/backoffice-context-controller";
import { fixtureBackofficeCore } from "./backoffice-seed-fixture";
import { PosConsole } from "../../../apps/merchant/src/modules/pos/ui/pos-console";
import { TicketSettings } from "../../../apps/merchant/src/modules/pos/ui/ticket-settings";

const core = fixtureBackofficeCore({
  businessName: "Scope A",
  isOwner: true,
  permissions: ["pos", "business"],
});
const module = {
  id: "pos",
  enabled: true,
  name: "POS",
  description: "",
  requires: [],
  suggested: false,
  navigation: [],
  permissions: [],
};
const ready = {
  bootId: core.bootId,
  scopeKey: core.scopeKey,
  result: { state: "ready" as const, modules: [module] },
};
function makeController(initial = core) {
  const controller = createBackofficeContextController(initial, {
    readSession: async () => {
      throw Error("Unexpected session read");
    },
    readModules: async () => {
      throw Error("Unexpected modules read");
    },
    requestRefresh: () => {},
    navigate: () => window.dispatchEvent(new Event("fixture:retired")),
  });
  if (!new URLSearchParams(location.search).has("loading"))
    controller.applyModulesSeed({
      ...ready,
      bootId: initial.bootId,
      scopeKey: initial.scopeKey,
    });
  return controller;
}
function Fixture() {
  const [current, setCurrent] = useState(() => ({
    core,
    controller: makeController(),
  }));
  const { controller } = current;
  const [updated, setUpdated] = useState(false);
  const [retired, setRetired] = useState(false);
  useEffect(() => {
    const retire = () => setRetired(true);
    window.addEventListener("fixture:retired", retire);
    return () => window.removeEventListener("fixture:retired", retire);
  }, []);
  return (
    <>
      <Button onPress={() => controller.applyModulesSeed(ready)}>
        Entregar módulos
      </Button>
      <Button onPress={() => controller.retire()}>Retirar ámbito</Button>
      <Button
        onPress={() => {
          const ticket = controller.captureTicket("modules");
          if (ticket)
            setUpdated(
              controller.applyConfirmedModule(ticket, {
                ...module,
                description: "Actualizado",
              }),
            );
        }}
      >
        Actualizar mismo ámbito
      </Button>
      <Button
        onPress={() => {
          const next = {
            ...core,
            bootId: "fixture-B",
            scopeKey: "b".repeat(64),
          };
          setCurrent({ core: next, controller: makeController(next) });
        }}
      >
        Cambiar a B
      </Button>
      {updated && <Text>Contexto actualizado</Text>}
      {retired && <Text>Ámbito retirado</Text>}
      <BackofficeProvider
        key={current.core.scopeKey}
        initialContext={current.core}
        controller={controller}
      >
        <PosConsole locations={[]} />
        <TicketSettings />
      </BackofficeProvider>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
