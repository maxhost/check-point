import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Spec 0065 fase D / ADR 0068 — EL AISLAMIENTO DE LA PESTAÑA, en la forma que la decisión
 * del owner dejó posible.
 *
 * El ítem original del DoD decía «`/wallet/settings` sin sesión → redirect». Con la sección
 * hecha PESTAÑA no hay URL propia que redirigir, así que lo que se asevera es lo que de
 * verdad protege el dato: **sin cookie, `/wallet` entero devuelve la pantalla «Tu tarjeta no
 * está abierta», no renderiza el shell (ni la pestaña, ni las membresías) y NO TOCA LA
 * BASE**. Lo segundo no es adorno: es la diferencia entre «no se ve» y «no se leyó».
 *
 * El oráculo de «no toca la base» es un `getDb` que TIRA. Un mock que devuelve un doble
 * dejaría pasar una consulta y el test seguiría verde.
 *
 * El aislamiento que importa —membresía ajena → 404— vive en la ruta HTTP y su oráculo está
 * en `consumer-marketing-opt-out.neon.integration.test.ts`.
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

vi.mock("../../../server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../server/db")>()),
  getDb: () => {
    throw new Error("la página sin sesión no puede tocar la base");
  },
}));

describe("el portal sin sesión (spec 0065, fase D / ADR 0068)", () => {
  it("responde «Tu tarjeta no está abierta» sin shell y sin una sola consulta", async () => {
    const { default: WalletPage } = await import("./page");
    const html = renderToStaticMarkup(await WalletPage());
    expect(html).toContain("Tu tarjeta no está abierta");
    // Ni la barra inferior ni la pestaña: si el shell se renderizara, acá habría botones.
    expect(html).not.toContain("consumer-bottom-nav");
    expect(html).not.toContain("Configuración");
    expect(html).not.toContain("Promociones de");
  });
});
