import type { WelcomeOffer as Offer } from "@mi-pasaporte/domain/server/consumer/enroll-landing";
import styles from "../../consumer-entry.module.css";

export function WelcomeOffer({ offer }: { offer: Offer }) {
  if (!offer) return null;
  return (
    <aside aria-label="Regalo de bienvenida" className={styles.welcomeOffer}>
      <h2>Hay un beneficio de bienvenida esperando</h2>
      <p>
        Con CheckPass en la pantalla de inicio y las notificaciones activas, el
        beneficio se descubre al instante, sujeto a disponibilidad.
      </p>
    </aside>
  );
}
