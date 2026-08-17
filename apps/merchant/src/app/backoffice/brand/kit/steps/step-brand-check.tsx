import type { KitBusiness } from "../../../../../server/brand-kit/data";

// Step 2 (spec 0041): read-only check of the marca the poster will use — logo + the 3
// brand colors — with a link to edit the marca (this step never duplicates that editor).
// Blocks when there is no logo: the poster depends on it (spec: "no logo" state).

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="brand-kit-swatch">
      <span className="brand-kit-swatch-chip" style={{ background: color }} />
      <span className="brand-kit-swatch-meta">
        <strong>{label}</strong>
        <small>{color}</small>
      </span>
    </div>
  );
}

export function StepBrandCheck({
  business,
  hasLogo,
}: {
  business: KitBusiness;
  hasLogo: boolean;
}) {
  if (!hasLogo) {
    return (
      <div className="brand-kit-block">
        <h2>Falta el logo de tu negocio</h2>
        <p>
          Subí el logo de tu negocio para generar el afiche: es la pieza central del
          diseño.
        </p>
        <a className="brand-kit-block-cta" href="/backoffice/brand">
          Ir a Marca para subir el logo
        </a>
      </div>
    );
  }

  return (
    <div className="brand-kit-brandcheck">
      <p className="brand-kit-hint">
        El afiche usa el logo y los colores de tu marca. Para cambiarlos, editá tu marca.
      </p>
      <div className="brand-kit-brandcheck-grid">
        <div className="brand-kit-logo-preview">
          <img src={business.logoPath ?? ""} alt={business.name} />
          <span>{business.name}</span>
        </div>
        <div className="brand-kit-swatches">
          <Swatch label="Primario" color={business.brandPrimaryColor} />
          <Swatch label="Complementario" color={business.brandComplementaryColor} />
          <Swatch label="Acento" color={business.brandAccentColor} />
        </div>
      </div>
      <a className="brand-kit-editlink" href="/backoffice/brand">
        Editar marca
      </a>
    </div>
  );
}
