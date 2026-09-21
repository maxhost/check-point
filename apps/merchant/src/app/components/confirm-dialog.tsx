"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Spec 0063, D7 / ADR 0058 §8 — DOS PROPS NUEVAS, LAS DOS RETROCOMPATIBLES, para que el
 * modal de condiciones de la baja NO sea una segunda copia de la trampa de foco y del
 * Escape. Medido antes de escribirlo: los 7 consumidores pasan `description` como string o
 * como expresión de strings, así que ensanchar el tipo a `ReactNode` no toca a ninguno
 * (`string` es asignable a `ReactNode`) y `confirmDisabled` es opcional.
 *
 *  - `description: ReactNode` — el modal de la baja bloqueada necesita un LINK adentro
 *    (`/backoffice/locations`), y con `string` no había forma.
 *  - `confirmDisabled` — «Confirmar NO está disponible» cuando faltan locales por archivar.
 *    Ojo con lo que NO significa: el botón que ABRE este modal nunca se deshabilita (ADR
 *    0058 §8, respuesta literal del owner: «el usuario no sabría qué debe hacer»). Se
 *    aprieta, y esto es lo que explica qué falta. El bloqueo duro es el 409 del servidor.
 *
 * La trampa de foco sigue sirviendo sin tocarla: su selector ya excluye
 * `button:not([disabled])` —así que el «Confirmar» deshabilitado no recibe foco— e incluye
 * `[href]`, así que el link de la descripción SÍ entra en el ciclo del Tab.
 * ORÁCULO: `confirm-dialog-focus.test.ts`, con el markup REAL y este `onKeyDown` REAL, y cada
 * mitad con su mutación en rojo: el SELECTOR (`"button, input, select, textarea"` ⇒ rojo), el
 * ciclo hacia ADELANTE sólo desde el último (sacar `activeElement === last` ⇒ rojo) y el ciclo
 * hacia ATRÁS (borrar la rama del shift+Tab ⇒ rojo). Queda FUERA el `useEffect` de abajo —el
 * foco inicial y el Escape—, que ese test mockea.
 * Acá vivía un LÍMITE DECLARADO («exige un DOM real; jsdom no está instalado») que era FALSO y
 * nadie había intentado: `node-html-parser` viene bundleado en `next`, con `querySelectorAll` y
 * motor CSS. Y la primera corrección de ese límite se quedó corta al revés: decía «tiene
 * oráculo» cuando sólo lo tenía el selector, y las otras dos mitades quedaban verdes ante su
 * mutación. Las dos veces lo cazó un revisor independiente.
 */
type Props = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  confirmTourAnchor?: string;
  onCancel: () => void;
  onConfirm: () => void;
};
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  confirmDisabled = false,
  confirmTourAnchor,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() =>
      cancelButtonRef.current?.focus(),
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocusRef.current?.isConnected)
        previousFocusRef.current.focus();
    };
  }, [onCancel, open]);

  const trapFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
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
  };

  if (!open) return null;
  return (
    <div className="dialog-backdrop">
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={dialogRef}
        onKeyDown={trapFocus}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div>
          <button
            className="button alt"
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="button danger"
            data-tour={confirmTourAnchor}
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
