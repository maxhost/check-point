import { StaffFormModal } from "../staff/staff-form-modal";
import type { useBrandEditor } from "./use-brand-editor";

export function BrandRecovery({
  editor,
}: {
  editor: ReturnType<typeof useBrandEditor>;
}) {
  const {
    needsReview,
    currentBrand,
    adoptOpen,
    setAdoptOpen,
    loading,
    accessDenied,
    consult,
    adopt,
  } = editor;
  if (!needsReview || accessDenied) return null;
  return (
    <section
      className="brand-recovery"
      data-tour="brand-recovery"
      aria-label="Revisar la marca guardada"
    >
      <p>
        Tu borrador se conserva. Consultá la marca actual antes de volver a
        guardar.
      </p>
      <button
        className="small-button"
        disabled={loading}
        onClick={() => void consult()}
      >
        {loading ? "Consultando…" : "Consultar marca actual"}
      </button>
      {currentBrand && (
        <>
          <h2>Versión guardada</h2>
          <dl>
            <dt>Nombre</dt>
            <dd>{currentBrand.name}</dd>
            <dt>Zona horaria</dt>
            <dd>{currentBrand.timezone}</dd>
            <dt>Moneda</dt>
            <dd>{currentBrand.currencyCode}</dd>
            <dt>Colores</dt>
            <dd>
              {currentBrand.brandPrimaryColor} ·{" "}
              {currentBrand.brandComplementaryColor} ·{" "}
              {currentBrand.brandAccentColor}
            </dd>
            <dt>Logo</dt>
            <dd>
              {currentBrand.logoPath ? (
                <img
                  src={currentBrand.logoPath}
                  alt={`Logo guardado de ${currentBrand.name}`}
                />
              ) : (
                "Sin logo"
              )}
            </dd>
          </dl>
          <button
            className="small-button"
            disabled={loading}
            onClick={() => setAdoptOpen(true)}
          >
            Usar versión guardada
          </button>
        </>
      )}
      <StaffFormModal
        open={adoptOpen}
        eyebrow="Marca"
        title="¿Usar la versión guardada?"
        description="Se descartarán todos los cambios de tu borrador local, incluido el logo elegido."
        onClose={() => setAdoptOpen(false)}
      >
        <div className="brand-recovery-actions">
          <button className="button alt" onClick={() => setAdoptOpen(false)}>
            Conservar borrador
          </button>
          <button className="button" onClick={adopt}>
            Descartar borrador y usar versión guardada
          </button>
        </div>
      </StaffFormModal>
    </section>
  );
}
