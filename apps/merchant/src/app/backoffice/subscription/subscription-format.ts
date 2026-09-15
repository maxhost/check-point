/**
 * Spec 0064, fase B — EL FORMATEO DE LA SECCIÓN DE SUSCRIPCIÓN, en funciones puras y en un
 * módulo propio.
 *
 * POR QUÉ SALEN DE LA CONSOLA: `subscription-console.tsx` estaba en 264/300 y esta fase le
 * suma cinco cosas, así que el corte iba ANTES de agregar (anexo, fase B). Y por qué ACÁ y no
 * repartidas por el JSX: son decisiones sobre la PLATA y las FECHAS del merchant; un `toFixed`
 * suelto adentro de un `<p>` no se puede mirar ni mutar.
 *
 * Nada de esto es "use client": son funciones puras, así que las puede llamar tanto el server
 * component como la consola.
 */

/**
 * La fecha, con el `timeZone` del negocio FIJADO. Sin fijarlo el server y el cliente formatean
 * distinto y React reporta un mismatch de hidratación (patrón de
 * `app/backoffice/loyalty/ui.tsx:18`). Venía de `subscription-console.tsx` sin cambios.
 *
 * El `"—"` del `null` es para los lugares donde la línea se imprime igual; los avisos nuevos
 * de esta spec NO lo usan — cuando no hay fecha, OMITEN la frase entera (§B: «sin `renewalAt`
 * omite el aviso y no inventa fecha»).
 */
export function formatDate(value: string | null, timezone: string): string {
  return value === null
    ? "—"
    : new Intl.DateTimeFormat("es-EC", {
        timeZone: timezone,
        dateStyle: "long",
      }).format(new Date(value));
}

/**
 * EL IMPORTE VIENE EN LA UNIDAD MÍNIMA DE LA MONEDA (centavos): `amount_paid` de Stripe es un
 * entero, así que 2000 son USD 20,00 y no USD 2000. Es el bug más caro posible en esta
 * pantalla —un cero de diferencia sobre lo que se le cobró al merchant— y por eso la división
 * está acá y no inline.
 *
 * `currency` llega en minúsculas desde Stripe (`"usd"`) e `Intl.NumberFormat` exige el código
 * ISO en MAYÚSCULAS: sin el `toUpperCase()` tira `RangeError` y se cae el render. Y si aun así
 * la moneda no es válida, se cae a un formato plano en vez de tumbar la sección: una pantalla
 * de plan no se rompe por un código de moneda raro.
 */
export function formatAmount(amountInMinorUnits: number, currency: string) {
  const amount = amountInMinorUnits / 100;
  try {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

/** Dos días, en milisegundos. */
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * LA FECHA CONVENIENTE PARA DAR DE BAJA = renovación − 2 días (spec §2, respuesta 3 del
 * owner). La baja es INMEDIATA y sin devolución (ADR 0063), así que darla de baja el día 1 del
 * período regala el período entero; el aviso existe para que el merchant no pierda plata.
 *
 * DEVUELVE `null` SI NO HAY RENOVACIÓN, y ése es el punto: `readBillingFacts` devuelve
 * `renewalAt: null` ante cualquier fallo de Stripe, y el modal tiene que OMITIR el aviso —
 * nunca inventar una fecha (DoD de la fase B). Un `new Date(null)` da el epoch, o sea «1 de
 * enero de 1970», que es exactamente la fecha inventada que esto prohíbe.
 */
export function convenientDowngradeDate(renewalAt: string | null) {
  if (renewalAt === null) return null;
  const renewal = new Date(renewalAt);
  const time = renewal.getTime();
  // Una fecha inválida (`NaN`) también omite el aviso: `new Date(NaN - dos días)` formatea
  // como «Invalid Date» y eso llegaría al DOM.
  if (Number.isNaN(time)) return null;
  return new Date(time - TWO_DAYS_MS).toISOString();
}
