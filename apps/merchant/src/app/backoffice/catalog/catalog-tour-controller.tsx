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
  catalogHelpStep,
  catalogOnboardingStart,
  CATALOG_TOUR_QUERY_KEY,
  wantsCatalogOnboardingTour,
} from "./catalog-tour-definitions";
import { CATALOG_HELP } from "./catalog-tour-locales";
import {
  catalogHelpDisabled,
  type CatalogHelpTour,
} from "./catalog-tour-state";
import { useCatalogTour } from "./catalog-tour-context";
import type { Catalog } from "./types";
import { catalogTourKeyboard } from "./catalog-tour-focus";

export function CatalogTourController({
  catalog,
  canDelete,
  isOwner,
  blocked,
  onPrepare,
  onNotice,
}: {
  catalog: Catalog;
  canDelete: boolean;
  isOwner: boolean;
  blocked: boolean;
  onPrepare: (task: CatalogHelpTour) => void;
  onNotice: (message: string) => void;
}) {
  const context = useCatalogTour()!;
  const { session, start, stop, notify } = context;
  const latest = useRef(context);
  latest.current = context;
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState<OnboardingTourStatus | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [orienting, setOrienting] = useState(false);
  const driverRef = useRef<Driver | null>(null);
  const orientation = useRef<Driver | null>(null);
  const requested = useRef(false);
  useEffect(() => {
    if (!session) return;
    const keyboard = (event: KeyboardEvent) => catalogTourKeyboard(event, stop);
    document.addEventListener("keydown", keyboard, true);
    return () => document.removeEventListener("keydown", keyboard, true);
  }, [session?.instance, stop]);

  useEffect(() => {
    if (requested.current || !isOwner || blocked) return;
    if (!wantsCatalogOnboardingTour(window.location.search)) return;
    const frame = requestAnimationFrame(() => {
      requested.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete(CATALOG_TOUR_QUERY_KEY);
      window.history.replaceState(window.history.state, "", url);
      setOrienting(true);
      orientation.current = startOnboardingTour({
        ...catalogOnboardingStart(),
        onClosed: () => setOrienting(false),
        onSaveError: setSaveFailed,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [isOwner, blocked]);
  useEffect(
    () => () => {
      if (orientation.current) disposeOnboardingTour(orientation.current);
    },
    [],
  );

  useEffect(() => {
    if (!session) return;
    let cleaning = false;
    const instance = session.instance;
    const frame = requestAnimationFrame(() => {
      const current = latest.current.session;
      if (!current || current.instance !== instance) return;
      const close = () => latest.current.stop();
      driverRef.current = startOnboardingTour({
        tourId: "catalog",
        persist: false,
        showProgress: false,
        allowKeyboardControl: false,
        steps: [
          catalogHelpStep(
            current,
            () => latest.current.notify({ type: "next" }),
            close,
          ),
        ],
        onClosed: () => {
          if (!cleaning) close();
        },
      });
    });
    return () => {
      cleaning = true;
      cancelAnimationFrame(frame);
      if (driverRef.current) disposeOnboardingTour(driverRef.current);
      driverRef.current = null;
    };
    // The driver belongs to an instance; phases update it without destroying the tour.
  }, [session?.instance]);

  useEffect(() => {
    if (!session) return;
    const frame = requestAnimationFrame(() => {
      const tour = driverRef.current;
      const current = latest.current.session;
      if (!tour || !tour.isActive() || current?.instance !== session.instance)
        return;
      const step = catalogHelpStep(
        current,
        () => notify({ type: "next" }),
        stop,
      );
      if (
        typeof step.element === "string" &&
        !document.querySelector(step.element)
      ) {
        const visible =
          document.querySelector<HTMLElement>(".catalog-ai-modal")?.dataset
            .tour;
        const phase =
          visible === "catalog-import-result"
            ? "result"
            : visible === "catalog-import-processing"
              ? "processing"
              : visible === "catalog-import-picker"
                ? "picker"
                : null;
        if (
          current.task.startsWith("import-") &&
          phase &&
          phase !== current.phase
        ) {
          latest.current.notify({ type: "import", phase });
          return;
        }
        onNotice(
          "No encontramos el control de esta tarea. Ajustá los filtros o volvé a elegir desde Ayuda.",
        );
        stop();
        return;
      }
      tour.highlight(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [session, notify, stop, onNotice]);

  useEffect(() => {
    if (!session?.entityId || session.phase === "success") return;
    const items = session.task.endsWith("product")
      ? catalog.products
      : catalog.categories;
    if (!items.some((item) => item.id === session.entityId)) {
      onNotice(
        "Ese elemento ya no está en el catálogo. Volvé a elegir desde Ayuda.",
      );
      stop();
    }
  }, [catalog, session, stop, onNotice]);

  function begin(task: CatalogHelpTour) {
    setHelpOpen(false);
    start(task, catalog.locations.length > 1);
    onPrepare(task);
  }
  async function retryProgress() {
    if (!saveFailed || saving) return;
    setSaving(true);
    try {
      await recordOnboardingTour("catalog", saveFailed);
      setSaveFailed(null);
      window.dispatchEvent(new Event(ONBOARDING_TOUR_ENDED_EVENT));
    } catch {
      /* Keep the visible retry action. */
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <button
        data-tour="catalog-help-entry"
        className="staff-help-button"
        type="button"
        disabled={Boolean(session) || orienting}
        onClick={() =>
          blocked ||
          document.querySelector('[data-tour="catalog-category-edit-name"]')
            ? onNotice("Terminá o cerrá la acción actual para iniciar la guía.")
            : setHelpOpen(true)
        }
      >
        <HelpCircle aria-hidden="true" /> Ayuda
      </button>
      {saveFailed && (
        <div className="catalog-tour-notice" role="alert">
          <span>No pudimos guardar tu progreso.</span>
          <button
            className="small-button"
            disabled={saving}
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
        description="Estas guías te acompañan sobre tu catálogo real."
        onClose={() => setHelpOpen(false)}
      >
        <div className="staff-help-options catalog-help-options">
          {CATALOG_HELP.map((item) => {
            const reason = catalogHelpDisabled(item.id, {
              products: catalog.products.length,
              categories: catalog.categories.length,
              canDelete,
              importing: catalog.importInProgress,
            });
            return (
              <button
                key={item.id}
                disabled={Boolean(reason)}
                onClick={() => begin(item.id)}
              >
                <strong>
                  {catalog.importInProgress && item.id.startsWith("import-")
                    ? "Ver importación en curso"
                    : item.title}
                </strong>
                <span>{item.body}</span>
                {reason && <small>{reason}</small>}
              </button>
            );
          })}
        </div>
      </StaffFormModal>
    </>
  );
}
