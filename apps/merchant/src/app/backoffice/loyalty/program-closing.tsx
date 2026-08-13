import { localDateTimeInput } from "./ui";
import type { LoyaltyVm } from "./use-loyalty-program";

export function ProgramClosing({ vm }: { vm: LoyaltyVm }) {
  const {
    timezone,
    saving,
    earningEndsAt,
    redemptionEndsAt,
    setEarningEndsAt,
    setRedemptionEndsAt,
    setConfirmClose,
  } = vm;
  const minDateTime = localDateTimeInput(timezone);
  return (
    <section className="panel loyalty-panel">
      <h2>Cierre del programa</h2>
      <p>
        Desde el fin de acumulación no se otorgarán más beneficios. Las personas
        podrán canjear los ya obtenidos hasta la fecha final.
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
          onChange={(event) => setRedemptionEndsAt(event.target.value)}
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
    </section>
  );
}
