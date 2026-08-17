"use client";

import Link from "next/link";
import { useState } from "react";
import { saveDemoReward } from "../../demo";

type State = "idle" | "locating" | "validating" | "success" | "error";

export default function DemoCheckinPage() {
  const [state, setState] = useState<State>("idle");
  const start = () => {
    if (!("geolocation" in navigator)) return setState("error");
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      () => {
        setState("validating");
        window.setTimeout(() => {
          saveDemoReward(window.sessionStorage);
          setState("success");
        }, 1100);
      },
      () => setState("error"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };
  return (
    <main className="screen">
      <section className="card">
        <div className="hero">
          <h1>Bar Demo</h1>
        </div>
        <div className="content">
          {state === "success" ? (
            <>
              <p className="eyebrow">CheckPass Club</p>
              <h2>¡Listo! Ganaste 10 puntos</h2>
              <p>
                Tu visita y beneficios quedaron guardados temporalmente en este
                teléfono.
              </p>
              <Link className="button" href="/wallet/demo">
                Ver mis beneficios
              </Link>
            </>
          ) : (
            <>
              <p className="eyebrow">Estás en Bar Demo</p>
              <h2>Registra tu visita</h2>
              <p>Haz check-in y recibe:</p>
              <div className="checkin-rewards">
                <span>10 puntos</span>
                <span>1 sello</span>
                <span>Cupón 2x1</span>
              </div>
              {state === "error" && (
                <p className="notice">
                  No pudimos obtener tu ubicación. Revisa el permiso e inténtalo
                  otra vez.
                </p>
              )}
              {state === "validating" ? (
                <button disabled>Validando tu visita…</button>
              ) : (
                <button onClick={start} disabled={state === "locating"}>
                  {state === "locating"
                    ? "Solicitando ubicación…"
                    : "Hacer check-in"}
                </button>
              )}
              <p className="permission-copy">
                Usaremos tu ubicación sólo para confirmar esta visita.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
