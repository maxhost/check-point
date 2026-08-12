"use client";

import { Xmark } from "iconoir-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

export function Toast({
  message,
  kind = "success",
  onDismiss,
}: {
  message: string | null;
  kind?: "success" | "warning" | "error";
  onDismiss: () => void;
}) {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => dismissRef.current(), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);
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
