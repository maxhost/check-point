/** Monto en la moneda del negocio, como el resto del panel (`es-EC`). Codigo ISO invalido →
 * `USD 2.50`. Propio del modulo para no depender de codigo de pantallas. */
export function formatTicketMoney(value: string, currencyCode: string): string {
  const amount = Number(value);
  try {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}
