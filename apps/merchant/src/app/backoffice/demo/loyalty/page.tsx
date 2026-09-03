"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type DemoState, read, save } from "../../../demo";
import {
  normalizedLoyaltyProgram,
  validateLoyaltyProgram,
} from "../../../loyalty";
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { ModuleHeader, Toast } from "../../../components/ui";
import { ACCEPTED_IMAGE_ACCEPT_ATTR } from "../../../../lib/image-formats";

type ProgramType = "points" | "stamps";

export default function LoyaltyPage() {
  const [data, setData] = useState<DemoState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [stampPreview, setStampPreview] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setData(read());
  }, []);

  useEffect(() => {
    if (!stampPreview) return;
    return () => URL.revokeObjectURL(stampPreview);
  }, [stampPreview]);

  if (!data) {
    return (
      <main className="merchant-shell">
        <div className="module-placeholder">
          <h1>Primero completa el onboarding</h1>
          <Link className="button" href="/onboarding">
            Ir al onboarding
          </Link>
        </div>
      </main>
    );
  }

  const program = data.loyaltyProgram;
  const isActive = program.status === "active" && program.type !== null;
  const chosenType = program.type;
  const updateProgram = (next: Partial<DemoState["loyaltyProgram"]>) =>
    setData((current) =>
      current
        ? {
            ...current,
            loyaltyProgram: { ...current.loyaltyProgram, ...next },
          }
        : current,
    );

  const activate = () => {
    if (!chosenType) {
      setError("Elige Puntos o Sellos para continuar.");
      return;
    }
    const nextProgram = normalizedLoyaltyProgram({
      ...program,
      status: "active",
      type: chosenType,
    });
    const validation = validateLoyaltyProgram(nextProgram, chosenType);
    if (validation) {
      setError(validation);
      return;
    }
    const nextData = { ...data, loyaltyProgram: nextProgram };
    setData(nextData);
    save(nextData);
    setError(null);
    setToast("Programa de fidelización activado.");
  };

  const saveProgram = () => {
    if (!program.type) return;
    const nextProgram = normalizedLoyaltyProgram(program);
    const validation = validateLoyaltyProgram(nextProgram, program.type);
    if (validation) {
      setError(validation);
      return;
    }
    const nextData = { ...data, loyaltyProgram: nextProgram };
    setData(nextData);
    save(nextData);
    setError(null);
    setToast("Programa guardado.");
  };

  const deactivate = () => {
    const nextData = {
      ...data,
      loyaltyProgram: { ...program, status: "inactive" as const, type: null },
    };
    setData(nextData);
    setConfirmDeactivate(false);
    save(nextData);
    setToast("Programa de fidelización desactivado.");
  };

  const chooseType = (type: ProgramType) => {
    updateProgram({ type });
    setError(null);
  };

  return (
    <main className="merchant-shell">
      <div className="brand-page loyalty-page">
        <Toast message={toast} onDismiss={() => setToast(null)} />
        <ModuleHeader
          eyebrow="Programa de fidelización"
          title={isActive ? "Tu programa está activo" : "Premia a tus clientes"}
          description={
            isActive
              ? "Edita su configuración o desactívalo antes de cambiar de modalidad."
              : "Elige una única forma de acumular beneficios en tu negocio."
          }
          closeHref="/backoffice/demo"
        />

        {!isActive && (
          <section
            className="panel loyalty-panel"
            aria-labelledby="loyalty-choice-title"
          >
            <h2 id="loyalty-choice-title">Elige tu programa</h2>
            <div
              className="loyalty-types"
              role="radiogroup"
              aria-labelledby="loyalty-choice-title"
            >
              <label
                className={`plan ${chosenType === "points" ? "selected" : ""}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="loyalty-program-type"
                  value="points"
                  checked={chosenType === "points"}
                  onChange={() => chooseType("points")}
                />
                <span className="loyalty-choice-content">
                  <strong>Puntos</strong>
                  <span>
                    Acumula una unidad flexible y canjéala por premios.
                  </span>
                </span>
              </label>
              <label
                className={`plan ${chosenType === "stamps" ? "selected" : ""}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="loyalty-program-type"
                  value="stamps"
                  checked={chosenType === "stamps"}
                  onChange={() => chooseType("stamps")}
                />
                <span className="loyalty-choice-content">
                  <strong>Sellos</strong>
                  <span>Completa una tarjeta para desbloquear un premio.</span>
                </span>
              </label>
            </div>
          </section>
        )}

        {(chosenType || isActive) && (
          <section className="panel loyalty-panel">
            {chosenType === "points" && (
              <>
                <h2>Configura tus puntos</h2>
                <label>
                  Nombre singular
                  <input
                    value={program.pointUnitSingular}
                    onChange={(event) =>
                      updateProgram({ pointUnitSingular: event.target.value })
                    }
                    placeholder="Ej. Punto"
                  />
                </label>
                <label>
                  Nombre plural
                  <input
                    value={program.pointUnitPlural}
                    onChange={(event) =>
                      updateProgram({ pointUnitPlural: event.target.value })
                    }
                    placeholder="Ej. Puntos"
                  />
                </label>
              </>
            )}

            {chosenType === "stamps" && (
              <>
                <h2>Configura tu tarjeta de sellos</h2>
                <label>
                  Nombre del sello
                  <input
                    value={program.stampUnitName}
                    onChange={(event) =>
                      updateProgram({ stampUnitName: event.target.value })
                    }
                    placeholder="Ej. Sello"
                  />
                </label>
                <label>
                  Sellos para completar la tarjeta
                  <input
                    type="number"
                    min="2"
                    max="50"
                    inputMode="numeric"
                    value={program.stampTarget}
                    onChange={(event) =>
                      updateProgram({ stampTarget: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Diseño del sello
                  <input
                    ref={imageInput}
                    type="file"
                    accept={ACCEPTED_IMAGE_ACCEPT_ATTR}
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      if (!selected) return;
                      updateProgram({ stampImageName: selected.name });
                      setStampPreview(URL.createObjectURL(selected));
                    }}
                  />
                </label>
                {(stampPreview || program.stampImageName) && (
                  <div className="stamp-preview">
                    {stampPreview ? (
                      <img src={stampPreview} alt="Vista previa del sello" />
                    ) : (
                      <span>{program.stampImageName}</span>
                    )}
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => {
                        updateProgram({ stampImageName: "" });
                        setStampPreview(null);
                        if (imageInput.current) imageInput.current.value = "";
                      }}
                    >
                      Quitar diseño
                    </button>
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button"
              type="button"
              onClick={isActive ? saveProgram : activate}
            >
              {isActive ? "Guardar programa" : "Activar programa"}
            </button>
            {isActive && (
              <button
                className="small-button danger-button"
                type="button"
                onClick={() => setConfirmDeactivate(true)}
              >
                Desactivar programa
              </button>
            )}
          </section>
        )}
      </div>
      <ConfirmDialog
        open={confirmDeactivate}
        title="¿Desactivar el programa?"
        description="Dejará de estar activo. La configuración demo se conserva, pero no se convierten beneficios."
        confirmLabel="Desactivar"
        cancelLabel="Mantener activo"
        onCancel={() => setConfirmDeactivate(false)}
        onConfirm={deactivate}
      />
    </main>
  );
}
