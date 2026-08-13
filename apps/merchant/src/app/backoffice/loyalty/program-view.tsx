import { formatDate } from "./ui";
import type { LoyaltyVm } from "./use-loyalty-program";

export function ProgramView({ vm }: { vm: LoyaltyVm }) {
  const {
    program,
    isClosing,
    timezone,
    saving,
    setEditing,
    setClosing,
    setConfirmCancel,
  } = vm;
  if (!program) return null;
  return (
    <>
      <section className="panel loyalty-panel">
        <h2>
          {program.kind === "points"
            ? "Programa de puntos"
            : "Programa de sellos"}
        </h2>
        <p>
          {isClosing
            ? "El programa conserva los beneficios ya otorgados hasta su fecha final de canje."
            : "Puedes actualizar su configuración y sus términos mientras permanezca activo."}
        </p>
        {isClosing ? (
          <>
            <dl className="closing-summary">
              <div>
                <dt>Fin de acumulación</dt>
                <dd>{formatDate(program.earningEndsAt, timezone)}</dd>
              </div>
              <div>
                <dt>Canje hasta</dt>
                <dd>{formatDate(program.redemptionEndsAt, timezone)}</dd>
              </div>
            </dl>
            <button
              className="button"
              type="button"
              disabled={saving}
              onClick={() => setConfirmCancel(true)}
            >
              Cancelar cierre
            </button>
          </>
        ) : (
          <>
            <button className="button" onClick={() => setEditing(true)}>
              Editar programa
            </button>
            <button
              className="close-program-link"
              type="button"
              onClick={() => setClosing(true)}
            >
              Cerrar programa
            </button>
          </>
        )}
      </section>
      <section className="panel loyalty-panel">
        <h2>Términos y condiciones</h2>
        <p className="published-term">{program.termsMarkdown}</p>
      </section>
    </>
  );
}
