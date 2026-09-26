import { useRef } from "react";
import {
  BrandTourProvider,
  useBrandTour,
} from "../../../apps/merchant/src/app/backoffice/brand/brand-tour-context";
import type { BrandTourEvent } from "../../../apps/merchant/src/app/backoffice/brand/brand-tour-state";
function Probe() {
  const tour = useBrandTour();
  const ticket = useRef<((event: BrandTourEvent) => void) | null>(null);
  return (
    <>
      <button
        onClick={() => {
          tour.start("change-name");
          tour.notify({ type: "next" });
          tour.notify({ type: "next" });
        }}
      >
        Primero
      </button>
      <button
        onClick={() => {
          ticket.current = tour.ticket();
        }}
      >
        Capturar
      </button>
      <button
        onClick={() => {
          tour.stop();
          tour.start("change-currency");
          tour.notify({ type: "next" });
        }}
      >
        Segundo
      </button>
      <button onClick={() => ticket.current?.({ type: "saved" })}>
        Resolver
      </button>
      <output>
        {tour.session?.task}:{tour.session?.phase}
      </output>
    </>
  );
}
export function BrandTicketProbe() {
  return (
    <BrandTourProvider>
      <Probe />
    </BrandTourProvider>
  );
}
