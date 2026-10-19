"use client";

import {
  CheckCircle,
  Clock,
  Lock,
  Mail,
  NavArrowDown,
  Sparks,
  Xmark,
} from "iconoir-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../ui";
import { useBackofficeContext } from "../backoffice-context";
import {
  AVAILABLE_ONBOARDING_ANCHORS,
  ONBOARDING_TOUR_HREFS,
  onboardingStepState,
} from "./onboarding-view";
import {
  ONBOARDING_TOUR_STARTED_EVENT,
  ONBOARDING_TOUR_ENDED_EVENT,
} from "./onboarding-tour";
import {
  ONBOARDING_CHECKLIST_OPEN_EVENT,
  isOnboardingChecklistClosed,
  setOnboardingChecklistClosed,
} from "./onboarding-checklist-visibility";

type SendState = "idle" | "sending" | "sent" | "error";

export function OnboardingChecklist() {
  const router = useRouter();
  const { state, acquireChecklist, refreshChecklist, verifyChecklistEmail } =
    useBackofficeContext();
  const items = state.checklist.data?.items ?? null;
  const loadFailed = ["unavailable", "restricted"].includes(
    state.checklist.status,
  );
  const [expanded, setExpanded] = useState(true);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [hiddenForTour, setHiddenForTour] = useState(false);
  const [closed, setClosed] = useState(false);

  // Se lee despues del montaje (no en el `useState`) para no desincronizar la hidratacion; el
  // panel igual no se pinta hasta que llega el checklist, asi que no hay parpadeo.
  useEffect(() => {
    setClosed(isOnboardingChecklistClosed());
    const reopen = () => {
      setClosed(false);
      setExpanded(true);
    };
    window.addEventListener(ONBOARDING_CHECKLIST_OPEN_EVENT, reopen);
    return () =>
      window.removeEventListener(ONBOARDING_CHECKLIST_OPEN_EVENT, reopen);
  }, []);

  function close() {
    setOnboardingChecklistClosed(true);
    setClosed(true);
  }

  useEffect(() => {
    const hide = () => setHiddenForTour(true);
    const restore = () => {
      setHiddenForTour(false);
    };
    window.addEventListener(ONBOARDING_TOUR_STARTED_EVENT, hide);
    window.addEventListener(ONBOARDING_TOUR_ENDED_EVENT, restore);
    return () => {
      window.removeEventListener(ONBOARDING_TOUR_STARTED_EVENT, hide);
      window.removeEventListener(ONBOARDING_TOUR_ENDED_EVENT, restore);
    };
  }, []);

  useEffect(() => {
    return acquireChecklist();
  }, [acquireChecklist]);

  async function sendVerification() {
    setSendState("sending");
    const result = await verifyChecklistEmail();
    if (result === "obsolete") return;
    setSendState(result === "verified" ? "idle" : result);
  }

  if (loadFailed)
    return (
      <section className="onboarding-zone is-error" role="alert">
        <div className="onboarding-zone-mark">
          <Mail aria-hidden="true" width={25} height={25} strokeWidth={1.7} />
        </div>
        <div className="onboarding-error-copy">
          <p className="eyebrow">Configuración pendiente</p>
          <h2>No pudimos cargar los pasos de configuración</h2>
          <p>Revisa la conexión con la base de datos e inténtalo nuevamente.</p>
        </div>
        <button
          className="onboarding-primary-action"
          onClick={refreshChecklist}
          type="button"
        >
          Reintentar
        </button>
      </section>
    );

  if (closed || hiddenForTour || !items || items.every((item) => item.done))
    return null;

  const completed = items.filter((item) => item.done).length;
  const percent = Math.round((completed / items.length) * 100);

  return (
    <section aria-labelledby="onboarding-title" className="onboarding-zone">
      <div className="flex items-center">
        <button
          aria-controls="onboarding-steps"
          aria-expanded={expanded}
          className="onboarding-summary min-w-0 flex-1"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <span className="onboarding-zone-mark">
            <Sparks
              aria-hidden="true"
              width={24}
              height={24}
              strokeWidth={1.7}
            />
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
        <Button
          aria-label="Cerrar la guía de inicio"
          className="mr-1.5 shrink-0"
          onPress={close}
          variant="quiet"
        >
          <Xmark aria-hidden="true" width={20} height={20} />
        </Button>
      </div>

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
                        const destino = ONBOARDING_TOUR_HREFS[item.anchor];
                        if (destino) {
                          setHiddenForTour(true);
                          router.push(destino);
                          return;
                        }
                        void sendVerification();
                      }}
                      type="button"
                    >
                      {ONBOARDING_TOUR_HREFS[item.anchor] ? (
                        <Sparks aria-hidden="true" width={18} height={18} />
                      ) : (
                        <Mail aria-hidden="true" width={18} height={18} />
                      )}
                      {ONBOARDING_TOUR_HREFS[item.anchor]
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
