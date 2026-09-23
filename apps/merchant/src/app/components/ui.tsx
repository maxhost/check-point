"use client";

import { Xmark } from "iconoir-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

/** Bloque visual reutilizable; cada pantalla compone con él su propia silueta. */
export function Skeleton({
  className = "",
  width,
  height,
  radius,
}: {
  className?: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  radius?: CSSProperties["borderRadius"];
}) {
  return (
    <span
      aria-hidden="true"
      className={`ui-skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius }}
    />
  );
}

/** Agrupa una composición y anuncia la carga una sola vez a lectores de pantalla. */
export function SkeletonScreen({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={className} role="status">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function Toast({
  message,
  kind = "success",
  durationMs = 4000,
  onDismiss,
}: {
  message: string | null;
  kind?: "success" | "info" | "warning" | "error";
  /** `null` mantiene el toast visible hasta que cambie la operación. */
  durationMs?: number | null;
  onDismiss: () => void;
}) {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message || durationMs === null) return;
    const timeout = window.setTimeout(() => dismissRef.current(), durationMs);
    return () => window.clearTimeout(timeout);
  }, [durationMs, message]);
  return message ? (
    <p className={`toast ${kind}`} role="status" aria-live="polite">
      {message}
    </p>
  ) : null;
}

export function ModuleHeader({
  eyebrow,
  title,
  description,
  closeHref,
  onClose,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  closeHref: string;
  onClose?: () => void;
}) {
  return (
    <div className="module-topline">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {onClose ? (
        <button
          className="close-module"
          type="button"
          onClick={onClose}
          aria-label={`Cerrar ${eyebrow}`}
        >
          <Xmark aria-hidden="true" />
        </button>
      ) : (
        <Link
          className="close-module"
          href={closeHref}
          aria-label={`Cerrar ${eyebrow}`}
        >
          <Xmark aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
