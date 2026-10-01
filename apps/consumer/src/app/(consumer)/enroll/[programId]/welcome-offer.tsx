import type { WelcomeOffer as Offer } from "@mi-pasaporte/domain/server/consumer/enroll-landing";

export function WelcomeOffer({ offer }: { offer: Offer }) {
  const timing =
    offer.redeemFrom === "same_visit"
      ? "en esta misma visita"
      : "en tu próxima visita";
  return (
    <aside
      aria-label="Regalo de bienvenida"
      className="mt-5 rounded-md border border-border bg-surface-subtle p-4 text-content"
    >
      <h2 className="text-xl font-bold">{offer.message}</h2>
      <p className="mt-2 font-semibold">{offer.label}</p>
      {offer.rule && <p className="mt-2 text-sm">{offer.rule}</p>}
      <p className="mt-3 text-sm leading-6">
        Instalá tu pase en Apple o Google Wallet y {timing} te llevás{" "}
        {offer.label}. Vence a los {offer.validDays} días. El regalo llega al
        instalar el pase y se canjea en el mostrador.
      </p>
    </aside>
  );
}
