import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("../server/auth", () => ({ getMerchantAuth: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: () => {
    throw new Error("Un rebote no debe leer la sesión");
  },
}));
vi.mock("./components/sign-out-button", () => ({
  SignOutButton: () => "Cerrar sesión",
}));
import EntryPage from "./page";

it("payment_required explica el bloqueo al personal y permite salir sin rebote", async () => {
  const html = renderToStaticMarkup(
    await EntryPage({
      searchParams: Promise.resolve({ e: "payment_required" }),
    }),
  );
  expect(html).toContain("El negocio necesita un plan activo");
  expect(html).toContain("Pide a la persona propietaria");
  expect(html).toContain("Cerrar sesión");
});
it("un código desconocido no llega al HTML ni activa el aviso de cobro", async () => {
  const html = renderToStaticMarkup(
    await EntryPage({
      searchParams: Promise.resolve({ e: "codigo-ajeno-123" }),
    }),
  );
  expect(html).not.toContain("codigo-ajeno-123");
  expect(html).not.toContain("El negocio necesita un plan activo");
  expect(html).toContain("Fidelización simple");
});
