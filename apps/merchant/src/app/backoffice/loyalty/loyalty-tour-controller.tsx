"use client";
import { loyaltyHelpStep } from "./loyalty-tour-step";
import { useEffect, useRef, useState } from "react";
import type { Driver } from "driver.js";
import { HelpCircle } from "iconoir-react";
import { StaffFormModal } from "../staff/staff-form-modal";
import {
  disposeOnboardingTour,
  startOnboardingTour,
  ONBOARDING_TOUR_ENDED_EVENT,
} from "../onboarding/onboarding-tour";
import {
  recordOnboardingTour,
  type OnboardingTourStatus,
} from "../onboarding/onboarding-api";
import {
  LOYALTY_HELP,
  LOYALTY_TOUR_QUERY_KEY,
  helpUnavailable,
  loyaltyAnchor,
  loyaltyOrientation,
  wantsLoyaltyOnboardingTour,
} from "./loyalty-tour-definitions";
import { useLoyaltyTour } from "./loyalty-tour-context";
import {
  type LoyaltyTask,
  type LoyaltyTourSession,
} from "./loyalty-tour-state";
import { loyaltyTourKeyboard } from "./loyalty-tour-focus";
import type { LoyaltyVm } from "./use-loyalty-program";
export function LoyaltyTourController({ vm }: { vm: LoyaltyVm }) {
  const { editor } = useLoyaltyTour();
  const [helpOpen, setHelpOpen] = useState(false);
  const [session, setSession] = useState<LoyaltyTourSession | null>(null);
  const [accrual, setAccrual] = useState(false);
  const [orienting, setOrienting] = useState(false);
  const [saveFailed, setSaveFailed] = useState<OnboardingTourStatus | null>(
    null,
  );
  const [retrying, setRetrying] = useState(false);
  const driver = useRef<Driver | null>(null);
  const instance = useRef(0);
  const alive = useRef(true);
  const denied = [vm.operationError?.status, vm.loadError?.status].some(
    (status) => status === 401 || status === 403,
  );
  const blocked =
    vm.saving ||
    vm.loading ||
    Boolean(vm.loadError) ||
    vm.stamp.isAnalyzing ||
    Boolean(vm.stamp.pending) ||
    denied ||
    vm.refreshFailed ||
    vm.confirmDiscard ||
    vm.confirmCancel ||
    vm.confirmClose ||
    vm.closing;
  const reason = denied
    ? "Recuperá el acceso antes de iniciar una guía."
    : blocked
      ? "Terminá o cerrá la acción actual para iniciar una guía. Tu borrador se conserva."
      : null;
  function returnFocus() {
    requestAnimationFrame(() => {
      if (alive.current)
        document
          .querySelector<HTMLButtonElement>(loyaltyAnchor("help"))
          ?.focus();
    });
  }
  function stop() {
    if (driver.current) disposeOnboardingTour(driver.current);
    driver.current = null;
    setSession(null);
    setOrienting(false);
    returnFocus();
  }
  const latest = useRef({ vm, session, stop });
  latest.current = { vm, session, stop };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (driver.current) disposeOnboardingTour(driver.current);
    };
  }, []);
  useEffect(() => {
    if (denied) stop();
  }, [denied]);
  function orient(persist: boolean) {
    setHelpOpen(false);
    setOrienting(true);
    driver.current = startOnboardingTour({
      tourId: "program",
      steps: loyaltyOrientation(vm),
      persist,
      showSkipOnFirstStep: true,
      disableActiveInteraction: true,
      onClosed: () => {
        if (alive.current) {
          setOrienting(false);
          returnFocus();
        }
      },
      onSaveError: (status) => {
        if (alive.current) setSaveFailed(status);
      },
    });
  }
  useEffect(() => {
    if (
      !vm.isOwner ||
      blocked ||
      session ||
      orienting ||
      !wantsLoyaltyOnboardingTour(window.location.search)
    )
      return;
    const frame = requestAnimationFrame(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete(LOYALTY_TOUR_QUERY_KEY);
      window.history.replaceState(window.history.state, "", url);
      orient(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [vm.isOwner, blocked, session, orienting]);
  function start(task: LoyaltyTask) {
    if (blocked || helpUnavailable(task, vm)) return;
    setHelpOpen(false);
    setAccrual(false);
    setSession({
      instance: ++instance.current,
      task,
      afterAttempt: vm.writeOutcome?.attemptId ?? 0,
    });
    if (task === "policies") vm.preparePolicies();
  }
  useEffect(() => {
    if (!session) return;
    const keyboard = (event: KeyboardEvent) =>
      loyaltyTourKeyboard(event, () => latest.current.stop());
    document.addEventListener("keydown", keyboard, true);
    return () => document.removeEventListener("keydown", keyboard, true);
  }, [session?.instance]);
  useEffect(() => {
    if (!session) return;
    let cleaning = false;
    const frame = requestAnimationFrame(() => {
      if (latest.current.session?.instance !== session.instance) return;
      driver.current = startOnboardingTour({
        tourId: "program",
        persist: false,
        showProgress: false,
        allowKeyboardControl: false,
        steps: [
          {
            popover: {
              title: "Tu guía",
              description: "Acompañá el formulario.",
            },
          },
        ],
        onClosed: () => {
          if (!cleaning && alive.current) setSession(null);
        },
      });
    });
    return () => {
      cleaning = true;
      cancelAnimationFrame(frame);
      if (driver.current) disposeOnboardingTour(driver.current);
      driver.current = null;
    };
  }, [session?.instance]);
  useEffect(() => {
    if (!session) return;
    const frame = requestAnimationFrame(() => {
      if (
        latest.current.session?.instance !== session.instance ||
        !driver.current?.isActive()
      )
        return;
      const current = latest.current.vm;
      const step = loyaltyHelpStep(
        current,
        session,
        editor,
        accrual,
        () => setAccrual(true),
        () => latest.current.stop(),
      );
      if (!step) return;
      driver.current.highlight(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    session,
    editor,
    accrual,
    vm.editing,
    vm.closing,
    vm.confirmClose,
    vm.saving,
    vm.stamp.pending,
    vm.stamp.isAnalyzing,
    vm.writeOutcome,
    vm.refreshFailed,
    vm.loading,
  ]);
  async function retry() {
    if (!saveFailed || retrying || denied) return;
    setRetrying(true);
    try {
      await recordOnboardingTour("program", saveFailed);
      if (alive.current) {
        setSaveFailed(null);
        window.dispatchEvent(new Event(ONBOARDING_TOUR_ENDED_EVENT));
      }
    } catch {
      /* Explicit retry retains the same decision. */
    } finally {
      if (alive.current) setRetrying(false);
    }
  }
  return (
    <>
      <button
        className="staff-help-button"
        data-tour="loyalty-help"
        type="button"
        disabled={Boolean(session) || orienting}
        onClick={() => setHelpOpen(true)}
      >
        <HelpCircle aria-hidden="true" /> Ayuda
      </button>
      {saveFailed && (
        <div role="alert" className="brand-tour-notice">
          <span>No pudimos guardar tu progreso.</span>
          <button
            className="small-button"
            disabled={retrying || denied}
            onClick={() => void retry()}
          >
            Reintentar
          </button>
        </div>
      )}
      <StaffFormModal
        open={helpOpen}
        eyebrow="Ayuda"
        title="¿Qué querés hacer?"
        description="Las guías acompañan tus acciones. Guardar aplica todos los cambios pendientes del programa."
        onClose={() => setHelpOpen(false)}
      >
        {reason && <p role="status">{reason}</p>}
        <div className="staff-help-options">
          <button disabled={blocked} onClick={() => orient(false)}>
            <strong>Conocer fidelización</strong>
          </button>
          {LOYALTY_HELP.filter((item) => vm.isOwner || item.id !== "close").map(
            (item) => {
              const unavailable = helpUnavailable(item.id, vm);
              return (
                <button
                  key={item.id}
                  disabled={blocked || Boolean(unavailable)}
                  onClick={() => start(item.id)}
                >
                  <strong>{item.title}</strong>
                  {unavailable && <small>{unavailable}</small>}
                </button>
              );
            },
          )}
        </div>
      </StaffFormModal>
    </>
  );
}
