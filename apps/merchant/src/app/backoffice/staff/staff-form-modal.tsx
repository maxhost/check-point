"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Xmark } from "iconoir-react";

/**
 * `dismissible` (spec 0093, default `true`): con `false` el modal no se cierra por la X (no se
 * renderiza), ni por el scrim, ni por Escape. Lo usa la importacion de catalogo mientras procesa;
 * el cierre queda en manos de los botones del contenido.
 */
export function StaffFormModal({
  open,
  eyebrow,
  title,
  description,
  onClose,
  dismissible = true,
  children,
}: {
  open: boolean;
  eyebrow: string;
  title: string;
  description?: string;
  onClose: () => void;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  const modalRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    dismissibleRef.current = dismissible;
  }, [dismissible]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() =>
      modalRef.current
        ?.querySelector<HTMLElement>("input:not([disabled]), button")
        ?.focus(),
    );
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissibleRef.current) closeRef.current();
    };
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", escape);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  function trapFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), [href]",
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;
  return (
    <div className="staff-modal-layer">
      {dismissible ? (
        <button
          aria-label="Cerrar formulario"
          className="staff-modal-scrim"
          onClick={onClose}
        />
      ) : (
        <div aria-hidden="true" className="staff-modal-scrim" />
      )}
      <section
        ref={modalRef}
        className="staff-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
      >
        <header className="staff-modal-head">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {dismissible && (
            <button
              aria-label="Cerrar"
              className="staff-modal-close"
              onClick={onClose}
              type="button"
            >
              <Xmark aria-hidden="true" />
            </button>
          )}
        </header>
        {children}
      </section>
    </div>
  );
}
