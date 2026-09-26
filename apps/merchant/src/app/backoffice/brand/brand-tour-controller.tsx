"use client";
import { useEffect, useRef, useState } from "react";
import type { Driver } from "driver.js";
import { HelpCircle } from "iconoir-react";
import { StaffFormModal } from "../staff/staff-form-modal";
import {
  disposeOnboardingTour,
  ONBOARDING_TOUR_ENDED_EVENT,
  startOnboardingTour,
} from "../onboarding/onboarding-tour";
import {
  recordOnboardingTour,
  type OnboardingTourStatus,
} from "../onboarding/onboarding-api";
import {
  BRAND_HELP,
  BRAND_TOUR_QUERY_KEY,
  brandHelpStep,
  brandOnboardingStart,
  wantsBrandOnboardingTour,
} from "./brand-tour-definitions";
import { useBrandTour } from "./brand-tour-context";
import { brandTourKeyboard } from "./brand-tour-focus";

export function BrandTourController({
  isOwner,
  blocked,
  accessDenied,
  needsReview,
  hasLogo,
  onNotice,
}: {
  isOwner: boolean;
  blocked: boolean;
  accessDenied: boolean;
  needsReview: boolean;
  hasLogo: boolean;
  onNotice: (message: string) => void;
}) {
  const context = useBrandTour();
  const { session, stop, notify, start } = context;
  const latest = useRef(context);
  latest.current = context;
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState<OnboardingTourStatus | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [orienting, setOrienting] = useState(false);
  const orientation = useRef<Driver | null>(null);
  const helpDriver = useRef<Driver | null>(null);
  const requested = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (orientation.current) disposeOnboardingTour(orientation.current);
    };
  }, []);
  useEffect(() => {
    if (accessDenied && orientation.current)
      disposeOnboardingTour(orientation.current);
  }, [accessDenied]);
  useEffect(() => {
    if (
      requested.current ||
      !isOwner ||
      blocked ||
      accessDenied ||
      session ||
      !wantsBrandOnboardingTour(window.location.search)
    )
      return;
    const frame = requestAnimationFrame(() => {
      requested.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete(BRAND_TOUR_QUERY_KEY);
      window.history.replaceState(window.history.state, "", url);
      setOrienting(true);
      orientation.current = startOnboardingTour({
        ...brandOnboardingStart(),
        onClosed: () => {
          if (alive.current) setOrienting(false);
        },
        onSaveError: (status) => {
          if (alive.current) setSaveFailed(status);
        },
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [isOwner, blocked, accessDenied, session]);
  useEffect(() => {
    if (!session) return;
    const keyboard = (event: KeyboardEvent) => brandTourKeyboard(event, stop);
    document.addEventListener("keydown", keyboard, true);
    return () => document.removeEventListener("keydown", keyboard, true);
  }, [session?.instance, stop]);
  useEffect(() => {
    if (!session) return;
    let cleaning = false;
    const instance = session.instance;
    const frame = requestAnimationFrame(() => {
      const current = latest.current.session;
      if (!current || current.instance !== instance) return;
      helpDriver.current = startOnboardingTour({
        tourId: "brand",
        persist: false,
        showProgress: false,
        allowKeyboardControl: false,
        steps: [
          brandHelpStep(
            current,
            () => latest.current.notify({ type: "next" }),
            () => latest.current.stop(),
          ),
        ],
        onClosed: () => {
          if (!cleaning) latest.current.stop();
        },
      });
    });
    return () => {
      cleaning = true;
      cancelAnimationFrame(frame);
      if (helpDriver.current) disposeOnboardingTour(helpDriver.current);
      helpDriver.current = null;
      if (alive.current)
        document
          .querySelector<HTMLButtonElement>('[data-tour="brand-help"]')
          ?.focus();
    };
  }, [session?.instance]);
  useEffect(() => {
    if (!session) return;
    const frame = requestAnimationFrame(() => {
      const current = latest.current.session;
      const tour = helpDriver.current;
      if (!tour?.isActive() || current?.instance !== session.instance) return;
      const step = brandHelpStep(current, () => notify({ type: "next" }), stop);
      if (needsReview) {
        step.element = '[data-tour="brand-recovery"]';
        step.popover = {
          ...step.popover,
          title: "Revisá la versión guardada",
          description:
            "Tu borrador se conserva. Consultá la marca actual. Usar la versión guardada requiere confirmar el descarte del borrador.",
        };
      }
      // The deferred cropper can take a moment to mount; keep the logo spotlight until then.
      if (current.phase === "crop" && !document.querySelector(".image-cropper"))
        return;
      tour.highlight(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [session, notify, stop, needsReview]);
  useEffect(() => {
    if (session?.phase !== "crop") return;
    const refresh = () => {
      const current = latest.current.session;
      if (
        current?.phase === "crop" &&
        document.querySelector(".image-cropper")
      ) {
        observer.disconnect();
        helpDriver.current?.highlight(
          brandHelpStep(
            current,
            () => latest.current.notify({ type: "next" }),
            stop,
          ),
        );
      }
    };
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    refresh();
    return () => observer.disconnect();
  }, [session?.phase, stop]);
  async function retryProgress() {
    if (!saveFailed || saving || accessDenied) return;
    setSaving(true);
    try {
      await recordOnboardingTour("brand", saveFailed);
      if (!alive.current) return;
      setSaveFailed(null);
      window.dispatchEvent(new Event(ONBOARDING_TOUR_ENDED_EVENT));
    } catch {
      /* Keep the error and explicit retry. */
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  return (
    <>
      <button
        data-tour="brand-help"
        className="staff-help-button"
        type="button"
        disabled={Boolean(session) || orienting || accessDenied}
        onClick={() =>
          blocked
            ? onNotice("Terminá o cerrá la acción actual para iniciar la guía.")
            : setHelpOpen(true)
        }
      >
        <HelpCircle aria-hidden="true" /> Ayuda
      </button>
      {saveFailed && (
        <div className="brand-tour-notice" role="alert">
          <span>No pudimos guardar tu progreso.</span>
          <button
            className="small-button"
            disabled={saving || accessDenied}
            onClick={() => void retryProgress()}
          >
            {saving ? "Guardando…" : "Reintentar"}
          </button>
        </div>
      )}
      <StaffFormModal
        open={helpOpen}
        eyebrow="Ayuda"
        title="¿Qué querés hacer?"
        description="Estas guías te acompañan sobre tu marca real. Guardar aplica todos los cambios pendientes."
        onClose={() => setHelpOpen(false)}
      >
        <div className="staff-help-options">
          {BRAND_HELP.map((item) => (
            <button
              key={item.id}
              disabled={item.id === "remove-logo" && !hasLogo}
              onClick={() => {
                setHelpOpen(false);
                start(item.id);
              }}
            >
              <strong>{item.title}</strong>
              <span>{item.body}</span>
              {item.id === "remove-logo" && !hasLogo && (
                <small>Primero agregá un logo.</small>
              )}
            </button>
          ))}
        </div>
      </StaffFormModal>
    </>
  );
}
