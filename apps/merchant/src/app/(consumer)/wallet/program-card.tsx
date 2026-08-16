"use client";

import { useState } from "react";
import { CardPreview } from "../../../components/loyalty/card-preview";
import type { ConsumerProgramSummary } from "../../../server/consumer/programs";
import { PointsCard } from "./points-card";
import { TermsModal } from "./terms-modal";

export function ProgramCard({ program }: { program: ConsumerProgramSummary }) {
  const [showTerms, setShowTerms] = useState(false);
  const statusLabel =
    program.programStatus === "closing"
      ? "Cerrado"
      : program.programStatus === "inactive"
        ? "Inactivo"
        : null;
  return (
    <article
      className={`consumer-program-card ${statusLabel ? "is-closed" : ""}`}
    >
      {program.kind === "stamps" && program.cardDesign ? (
        <div className="consumer-stamps-card">
          <div className="consumer-program-brand">
            {program.logoPath ? (
              <img
                src={program.logoPath}
                alt={`Logo de ${program.businessName}`}
              />
            ) : (
              <span aria-hidden="true">
                {program.businessName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <strong>{program.businessName}</strong>
          </div>
          <CardPreview
            design={program.cardDesign}
            target={program.target ?? 0}
            stampImagePath={program.stampImagePath}
            filled={program.stampsCount}
          />
          <p>
            {program.stampsCount} de {program.target ?? 0} {program.unitName}
          </p>
        </div>
      ) : (
        <PointsCard program={program} />
      )}
      {statusLabel && (
        <span className="consumer-status-badge">{statusLabel}</span>
      )}
      <button
        className="consumer-info-button"
        type="button"
        aria-label={`Ver términos de ${program.businessName}`}
        onClick={() => setShowTerms(true)}
      >
        i
      </button>
      {showTerms && (
        <TermsModal
          businessName={program.businessName}
          termsMarkdown={program.termsMarkdown}
          onClose={() => setShowTerms(false)}
        />
      )}
    </article>
  );
}
