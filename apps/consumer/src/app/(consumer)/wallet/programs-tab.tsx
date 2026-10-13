"use client";

import { useState } from "react";
import type { ConsumerProgramSummary } from "@mi-pasaporte/domain/server/consumer/programs";
import { ProgramCard } from "./program-card";

export function visiblePrograms(
  programs: ConsumerProgramSummary[],
  showClosed: boolean,
) {
  return showClosed
    ? programs
    : programs.filter((program) => program.programStatus === "active");
}

export function ProgramsTab({
  programs,
}: {
  programs: ConsumerProgramSummary[];
}) {
  const [showClosed, setShowClosed] = useState(false);
  const visible = visiblePrograms(programs, showClosed);
  const hasClosed = programs.some(
    (program) => program.programStatus !== "active",
  );
  return (
    <section aria-labelledby="programs-tab-title" className="cp-screen">
      <div className="consumer-programs-heading">
        <div>
          <span className="cp-eyebrow">COMERCIOS</span>
          <h2 id="programs-tab-title">Programas</h2>
          <p>Sellos y puntos de cada lugar.</p>
        </div>
        {hasClosed && (
          <label className="consumer-closed-toggle">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(event) => setShowClosed(event.target.checked)}
            />{" "}
            Ver programas cerrados
          </label>
        )}
      </div>
      {visible.length ? (
        <div className="consumer-program-list">
          {visible.map((program) => (
            <ProgramCard key={program.membershipId} program={program} />
          ))}
        </div>
      ) : (
        <div className="consumer-empty">
          <h3>No hay programas para mostrar</h3>
          <p>
            {showClosed
              ? "Todavía no hay programas en esta cuenta."
              : "Con el filtro activo se ven los programas anteriores."}
          </p>
        </div>
      )}
    </section>
  );
}
