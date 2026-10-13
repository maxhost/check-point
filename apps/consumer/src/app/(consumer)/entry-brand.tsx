import { CheckPassIcon } from "./entry-icons";
import styles from "./consumer-entry.module.css";

export function EntryBrand({ large = false }: { large?: boolean }) {
  return (
    <div
      className={`${styles.brand} ${large ? styles.brandLarge : styles.brandFooter}`}
    >
      <CheckPassIcon />
      <span>CheckPass</span>
    </div>
  );
}

export function BusinessIdentity({
  businessName,
  logoUrl,
}: {
  businessName: string;
  logoUrl?: string;
}) {
  return (
    <div className={styles.merchantIdentity}>
      <div
        className={`${styles.merchantSymbol} ${logoUrl ? styles.withLogo : ""}`}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" />
        ) : (
          <span aria-hidden="true">
            {businessName.trim().charAt(0).toLocaleUpperCase("es")}
          </span>
        )}
      </div>
      <strong>{businessName}</strong>
    </div>
  );
}

export function EnrollmentIntro({
  businessName,
  firstName,
  signed = false,
}: {
  businessName: string;
  firstName?: string;
  signed?: boolean;
}) {
  const name = firstName?.trim();
  return (
    <div className={styles.intro}>
      <h1>
        {name && signed ? `Hola, ${name}. Programa de ` : "Programa de "}
        {businessName}
      </h1>
      <p>Pase y beneficios del programa, en un solo lugar: CheckPass.</p>
    </div>
  );
}
