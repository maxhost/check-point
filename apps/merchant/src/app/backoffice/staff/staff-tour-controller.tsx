"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle, Xmark } from "iconoir-react";
import { startOnboardingTour } from "../onboarding/onboarding-tour";
import { staffTourSteps, type StaffHelpTour } from "./staff-tour-definitions";

const HELP: Array<{
  id: StaffHelpTour;
  title: string;
  body: string;
  needsMember?: boolean;
}> = [
  {
    id: "create",
    title: "Añadir un miembro del staff",
    body: "Nombre, permisos, alta y entrega de credenciales.",
  },
  {
    id: "regenerate-pin",
    title: "Regenerar un PIN",
    body: "Rotar el PIN y compartir la credencial nueva.",
    needsMember: true,
  },
  {
    id: "edit-permissions",
    title: "Editar nombre o permisos",
    body: "Actualizar los datos y accesos de un integrante.",
    needsMember: true,
  },
  {
    id: "disable",
    title: "Dar de baja un miembro",
    body: "Cortar su acceso de forma reversible.",
    needsMember: true,
  },
];

export function StaffTourController({
  loading,
  hasMembers,
}: {
  loading: boolean;
  hasMembers: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (loading || started.current) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("tour") !== "onboarding") return;
    started.current = true;
    startOnboardingTour({
      tourId: "staff",
      steps: staffTourSteps("onboarding"),
      showSkipOnFirstStep: true,
    });
  }, [loading]);

  function startHelp(id: StaffHelpTour) {
    setHelpOpen(false);
    requestAnimationFrame(() =>
      startOnboardingTour({
        tourId: "staff",
        steps: staffTourSteps(id),
        persist: false,
      }),
    );
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
            aria-labelledby="staff-help-title"
          >
            <header>
              <div>
                <p className="eyebrow">Ayuda</p>
                <h2 id="staff-help-title">¿Qué querés hacer?</h2>
              </div>
              <button aria-label="Cerrar" onClick={() => setHelpOpen(false)}>
                <Xmark aria-hidden="true" />
              </button>
            </header>
            <div className="staff-help-options">
              {HELP.map((item) => (
                <button
                  disabled={item.needsMember && !hasMembers}
                  key={item.id}
                  onClick={() => startHelp(item.id)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                  {item.needsMember && !hasMembers && (
                    <small>Primero añadí un integrante.</small>
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
