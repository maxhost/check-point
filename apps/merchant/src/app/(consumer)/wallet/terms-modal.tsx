"use client";

import { useEffect } from "react";

export function TermsModal({
  businessName,
  termsMarkdown,
  onClose,
}: {
  businessName: string;
  termsMarkdown: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div
      className="consumer-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="consumer-terms-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
      >
        <button
          className="consumer-modal-close"
          type="button"
          aria-label="Cerrar términos y condiciones"
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="terms-title">Términos y condiciones</h2>
        <p className="consumer-terms-business">{businessName}</p>
        <p className="consumer-terms-copy">
          {termsMarkdown || "Este programa no tiene términos publicados."}
        </p>
      </section>
    </div>
  );
}
