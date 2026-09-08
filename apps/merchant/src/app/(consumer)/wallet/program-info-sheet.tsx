"use client";

import { useEffect, useState } from "react";
import type { ConsumerProgramSummary } from "../../../server/consumer/programs";
import { RewardsModal } from "./rewards-modal";
import { TermsModal } from "./terms-modal";

/**
 * What the `i` of a program card opens (spec 0055 §7). It used to open the terms
 * directly; now it offers two ways in — «Términos y condiciones» (the existing
 * `TermsModal`, untouched) and «Catálogo de premios» (new).
 *
 * The sheet is its own component and does NOT wrap `TermsModal`: that modal hardcodes
 * its title and copy (`terms-modal.tsx:42`), so it is not a generic container and reusing
 * it as one would print "Términos y condiciones" over the reward catalog.
 */
export function ProgramInfoSheet({
  program,
  onClose,
}: {
  program: ConsumerProgramSummary;
  onClose: () => void;
}) {
  const [view, setView] = useState<"menu" | "terms" | "rewards">("menu");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && view === "menu") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, view]);

  if (view === "terms") {
    return (
      <TermsModal
        businessName={program.businessName}
        termsMarkdown={program.termsMarkdown}
        onClose={onClose}
      />
    );
  }
  if (view === "rewards") {
    return <RewardsModal program={program} onClose={onClose} />;
  }
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
        aria-labelledby="program-info-title"
      >
        <button
          className="consumer-modal-close"
          type="button"
          aria-label="Cerrar información del programa"
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="program-info-title">{program.businessName}</h2>
        <div className="consumer-info-options">
          <button type="button" onClick={() => setView("terms")}>
            Términos y condiciones
          </button>
          <button type="button" onClick={() => setView("rewards")}>
            Catálogo de premios
          </button>
        </div>
      </section>
    </div>
  );
}
