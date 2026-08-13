import { formatDate, localDateTimeInput } from "./ui";
import type { LoyaltyVm } from "./use-loyalty-program";

export function ProgramView({ vm }: { vm: LoyaltyVm }) {
  const {
    program,
    isClosing,
    timezone,
    closing,
    saving,
    earningEndsAt,
    redemptionEndsAt,
    setEditing,
    setClosing,
    setEarningEndsAt,
    setRedemptionEndsAt,
    setConfirmClose,
    setConfirmCancel,
  } = vm;
  if (!program) return null;
  const minDateTime = localDateTimeInput(timezone);
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
              onClick={() => setClosing(!closing)}
            >
              Cerrar programa
            </button>
            {closing && (
              <div className="transition-fields">
                <h3>Cierre del programa</h3>
                <p>
                  Desde el fin de acumulación no se otorgarán más beneficios.
                  Las personas podrán canjear los ya obtenidos hasta la fecha
                  final.
                </p>
                <label>
                  Fin de acumulación
                  <input
                    type="datetime-local"
                    min={minDateTime}
                    value={earningEndsAt}
                    onChange={(event) => setEarningEndsAt(event.target.value)}
                  />
                </label>
                <label>
                  Fecha final de canje
                  <input
                    type="datetime-local"
                    min={earningEndsAt || minDateTime}
                    value={redemptionEndsAt}
                    onChange={(event) =>
                      setRedemptionEndsAt(event.target.value)
                    }
                  />
                </label>
                <p className="field-help">Zona horaria: {timezone}.</p>
                <button
                  className="button danger"
                  type="button"
                  disabled={saving || !earningEndsAt || !redemptionEndsAt}
                  onClick={() => setConfirmClose(true)}
                >
                  Continuar con el cierre
                </button>
              </div>
            )}
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
