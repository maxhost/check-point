"use client";

import {
  CheckCircle,
  Clock,
  Lock,
  Mail,
  NavArrowDown,
  Sparks,
} from "iconoir-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOnboardingChecklist, type OnboardingItem } from "./onboarding-api";
import {
  AVAILABLE_ONBOARDING_ANCHORS,
  onboardingStepState,
} from "./onboarding-view";
import { STAFF_ONBOARDING_TOUR_HREF } from "../staff/staff-tour-definitions";
import { ONBOARDING_TOUR_STARTED_EVENT } from "./onboarding-tour";

type SendState = "idle" | "sending" | "sent" | "error";

export function OnboardingChecklist() {
  const router = useRouter();
  const [items, setItems] = useState<OnboardingItem[] | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [hiddenForTour, setHiddenForTour] = useState(false);

  useEffect(() => {
    const hide = () => setHiddenForTour(true);
    window.addEventListener(ONBOARDING_TOUR_STARTED_EVENT, hide);
    return () =>
      window.removeEventListener(ONBOARDING_TOUR_STARTED_EVENT, hide);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadFailed(false);
    void getOnboardingChecklist(controller.signal)
      .then((checklist) => {
        setItems(checklist.items);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setLoadFailed(true);
      });
    return () => controller.abort();
  }, [reloadKey]);

  async function sendVerification() {
    setSendState("sending");
    try {
      const response = await fetch("/api/merchant/auth/verify-email", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("verify-email-failed");
      const result = (await response.json()) as {
        sent?: boolean;
        verified?: boolean;
      };
      if (result.verified) {
        setItems(
          (current) =>
            current?.map((item) =>
              item.anchor === "verify-email" ? { ...item, done: true } : item,
            ) ?? null,
        );
        return;
      }
      if (!result.sent) throw new Error("verify-email-invalid-response");
      setSendState("sent");
    } catch {
      setSendState("error");
    }
  }

  if (loadFailed)
    return (
      <section className="onboarding-zone is-error" role="alert">
        <div className="onboarding-zone-mark">
          <Mail aria-hidden="true" width={25} height={25} strokeWidth={1.7} />
        </div>
        <div className="onboarding-error-copy">
          <p className="eyebrow">Configuración pendiente</p>
          <h2>No pudimos cargar tu onboarding</h2>
          <p>Revisa la conexión con la base de datos e inténtalo nuevamente.</p>
        </div>
        <button
          className="onboarding-primary-action"
          onClick={() => setReloadKey((current) => current + 1)}
          type="button"
        >
          Reintentar
        </button>
      </section>
    );

  if (hiddenForTour || !items || items.every((item) => item.done)) return null;

  const completed = items.filter((item) => item.done).length;
  const percent = Math.round((completed / items.length) * 100);

  return (
    <section aria-labelledby="onboarding-title" className="onboarding-zone">
      <button
        aria-controls="onboarding-steps"
        aria-expanded={expanded}
        className="onboarding-summary"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className="onboarding-zone-mark">
          <Sparks aria-hidden="true" width={24} height={24} strokeWidth={1.7} />
        </span>
        <span className="onboarding-summary-copy">
          <small>Guía de inicio</small>
          <strong id="onboarding-title">Pon tu negocio en marcha</strong>
        </span>
        <span className="onboarding-summary-progress">
          {completed} de {items.length}
        </span>
        <NavArrowDown
          aria-hidden="true"
          className="onboarding-chevron"
          width={22}
          height={22}
        />
      </button>

      <div
        aria-label={`${completed} de ${items.length} pasos completados`}
        aria-valuemax={items.length}
        aria-valuemin={0}
        aria-valuenow={completed}
        className="onboarding-progress"
        role="progressbar"
      >
        <span style={{ width: `${percent}%` }} />
      </div>

      {expanded && (
        <div className="onboarding-steps" id="onboarding-steps">
          <p className="onboarding-intro">
            Completa estos pasos para aprovechar todas las herramientas de
            CheckPass.
          </p>
          <ol>
            {items.map((item, index) => {
              const state = onboardingStepState(item, items);
              const blocked = state === "blocked";
              const available = AVAILABLE_ONBOARDING_ANCHORS.has(item.anchor);
              const current = state === "current";
              return (
                <li
                  className="onboarding-step"
                  data-state={state}
                  data-onboarding-anchor={item.anchor}
                  key={item.id}
                >
                  <span className="onboarding-step-status">
                    {item.done ? (
                      <CheckCircle aria-hidden="true" width={22} height={22} />
                    ) : blocked ? (
                      <Lock aria-hidden="true" width={19} height={19} />
                    ) : available ? (
                      index + 1
                    ) : (
                      <Clock aria-hidden="true" width={19} height={19} />
                    )}
                  </span>
                  <div className="onboarding-step-copy">
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    {blocked && (
                      <small>Completa primero el paso obligatorio.</small>
                    )}
                    {!blocked && !available && <small>Próximamente</small>}
                    {item.anchor === "verify-email" && sendState === "sent" && (
                      <small className="is-success" role="status">
                        Te enviamos el enlace. Revisa tu correo para continuar.
                      </small>
                    )}
                    {item.anchor === "verify-email" &&
                      sendState === "error" && (
                        <small className="is-error" role="alert">
                          No pudimos enviarlo. Espera un momento e inténtalo
                          otra vez.
                        </small>
                      )}
                  </div>
                  {current && (
                    <button
                      className="onboarding-primary-action"
                      disabled={sendState === "sending"}
                      onClick={() => {
                        if (item.anchor === "staff") {
                          setHiddenForTour(true);
                          router.push(STAFF_ONBOARDING_TOUR_HREF);
                          return;
                        }
                        void sendVerification();
                      }}
                      type="button"
                    >
                      {item.anchor === "staff" ? (
                        <Sparks aria-hidden="true" width={18} height={18} />
                      ) : (
                        <Mail aria-hidden="true" width={18} height={18} />
                      )}
                      {item.anchor === "staff"
                        ? "Empezar"
                        : sendState === "sending"
                          ? "Enviando…"
                          : sendState === "sent"
                            ? "Reenviar enlace"
                            : "Verificar mi email"}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
