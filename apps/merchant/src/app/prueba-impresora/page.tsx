import type { Metadata } from "next";
import { PrinterTest } from "./printer-test";

/**
 * Pagina PUBLICA (sin sesion) para que la duena de un comercio pruebe, sola y desde su
 * Android, si Chrome imprime directo a su termica Bluetooth por Web Serial y si recuerda la
 * impresora entre sesiones. Es una prueba de factibilidad: si se confirma, la impresion real
 * del POS se construye aparte y esta pagina se borra (`docs/PARQUEADO.md` #84).
 */
export const metadata: Metadata = {
  title: "Prueba de impresora · CheckPass Club",
  robots: { index: false, follow: false },
};

export default function PruebaImpresoraPage() {
  return <PrinterTest />;
}
