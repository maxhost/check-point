"use client";

import { useState } from "react";
import type { ConsumerProgramSummary } from "../../../server/consumer/programs";
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
    <section aria-labelledby="programs-tab-title">
      <div className="consumer-programs-heading">
        <div>
          <h2 id="programs-tab-title">Tus programas</h2>
          <p>Todos tus beneficios, en un solo lugar.</p>
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
              ? "Todavía no pertenecés a ningún programa."
              : "Activá el filtro para ver programas anteriores."}
          </p>
        </div>
      )}
    </section>
  );
}
