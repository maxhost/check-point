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
        {signed ? (name ? `${name}, únete a ` : "Únete a ") : "Hazte parte de "}
        {businessName}
      </h1>
      <p>Únete a su programa y encuentra tu pase y beneficios en CheckPass.</p>
    </div>
  );
}
