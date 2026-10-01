import type { WelcomeOffer as Offer } from "@mi-pasaporte/domain/server/consumer/enroll-landing";

export function WelcomeOffer({ offer }: { offer: Offer }) {
  if (!offer) return null;
  return (
    <aside
      aria-label="Regalo de bienvenida"
      className="mt-5 rounded-md border border-border bg-surface-subtle p-4 text-content"
    >
      <h2 className="text-xl font-bold">Hay una bienvenida para vos</h2>
      <p className="mt-2 text-sm leading-6">
        Añadí CheckPass a tu inicio y activá las notificaciones para descubrir
        tu beneficio, sujeto a disponibilidad.
      </p>
    </aside>
  );
}
