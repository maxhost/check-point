import { useRef } from "react";
import {
  CatalogTourProvider,
  useCatalogTour,
} from "../../../apps/merchant/src/app/backoffice/catalog/catalog-tour-context";
function Probe() {
  const tour = useCatalogTour()!;
  const pending = useRef<ReturnType<typeof tour.ticket> | null>(null);
  return (
    <>
      <button
        onClick={() => {
          tour.start("edit-product", false);
          tour.notify({ type: "selected", id: "one" });
        }}
      >
        Primero
      </button>
      <button
        onClick={() => {
          pending.current = tour.ticket();
        }}
      >
        Capturar
      </button>
      <button
        onClick={() => {
          tour.stop();
          tour.start("edit-product", false);
          tour.notify({ type: "selected", id: "two" });
        }}
      >
        Segundo
      </button>
      <button
        onClick={() =>
          pending.current?.({ type: "saved", id: "two", task: "edit-product" })
        }
      >
        Resolver
      </button>
      <output>
        {tour.session?.entityId}:{tour.session?.phase}
      </output>
    </>
  );
}
export function CatalogTicketProbe() {
  return (
    <CatalogTourProvider>
      <Probe />
    </CatalogTourProvider>
  );
}
