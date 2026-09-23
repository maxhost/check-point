"use client";

import { HelpCircle, Xmark } from "iconoir-react";
import { useEffect, useRef, useState } from "react";
import { startOnboardingTour } from "../onboarding/onboarding-tour";
import {
  locationsHelpStart,
  locationsOnboardingStart,
  wantsLocationsOnboardingTour,
  type LocationsHelpTour,
} from "./locations-tour-definitions";

const HELP: Array<{
  id: LocationsHelpTour;
  title: string;
  body: string;
  needsCapacity?: boolean;
  needsLocation?: boolean;
}> = [
  {
    id: "limit",
    title: "¿Por qué no puedo añadir locales?",
    body: "Revisá cuántos locales activos incluye tu plan.",
  },
  {
    id: "create",
    title: "Añadir un nuevo local",
    body: "Completá el nombre y la dirección de una sucursal.",
    needsCapacity: true,
  },
  {
    id: "edit",
    title: "Editar un local",
    body: "Actualizá el nombre o la dirección de un local activo.",
    needsLocation: true,
  },
  {
    id: "archive",
    title: "Archivar un local",
    body: "Retirá un local de la operación sin borrar su historial.",
    needsLocation: true,
  },
];

export function LocationsTourController({
  canAdd,
  planAllowsMultiple,
  hasActiveLocations,
}: {
  canAdd: boolean;
  planAllowsMultiple: boolean;
  hasActiveLocations: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!wantsLocationsOnboardingTour(window.location.search)) return;
    started.current = true;
    startOnboardingTour(locationsOnboardingStart(canAdd));
  }, [canAdd]);

  function startHelp(id: LocationsHelpTour) {
    setHelpOpen(false);
    requestAnimationFrame(() => startOnboardingTour(locationsHelpStart(id)));
  }

  return (
    <>
      <button
        className="staff-help-button"
        type="button"
        onClick={() => setHelpOpen(true)}
      >
        <HelpCircle aria-hidden="true" />
        Ayuda
      </button>
      {helpOpen && (
        <div className="staff-help-layer">
          <button
            aria-label="Cerrar ayuda"
            className="staff-modal-scrim"
            onClick={() => setHelpOpen(false)}
          />
          <section
            className="staff-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="locations-help-title"
          >
            <header>
              <div>
                <p className="eyebrow">Ayuda</p>
                <h2 id="locations-help-title">¿Qué querés hacer?</h2>
              </div>
              <button aria-label="Cerrar" onClick={() => setHelpOpen(false)}>
                <Xmark aria-hidden="true" />
              </button>
            </header>
            <div className="staff-help-options">
              {HELP.map((item) => {
                const disabled =
                  (item.needsCapacity && (!canAdd || !planAllowsMultiple)) ||
                  (item.needsLocation && !hasActiveLocations);
                return (
                  <button
                    disabled={disabled}
                    key={item.id}
                    onClick={() => startHelp(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                    {item.needsCapacity && (!canAdd || !planAllowsMultiple) && (
                      <small>
                        Tu plan debe permitir más de un local y tener cupo
                        disponible.
                      </small>
                    )}
                    {item.needsLocation && !hasActiveLocations && (
                      <small>Primero añadí un local activo.</small>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
