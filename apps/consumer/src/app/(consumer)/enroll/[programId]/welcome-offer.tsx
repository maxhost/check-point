import type { WelcomeOffer as Offer } from "@mi-pasaporte/domain/server/consumer/enroll-landing";
import styles from "../../consumer-entry.module.css";

export function WelcomeOffer({ offer }: { offer: Offer }) {
  if (!offer) return null;
  return (
    <aside aria-label="Regalo de bienvenida" className={styles.welcomeOffer}>
      <h2>Te espera un beneficio de bienvenida</h2>
      <p>
        Añade CheckPass a tu inicio y activa las notificaciones para descubrir
        tu beneficio, sujeto a disponibilidad.
      </p>
    </aside>
  );
}
