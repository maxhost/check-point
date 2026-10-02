import { describe, expect, it } from "vitest";
import { NAMELESS_CUSTOMER, toCustomerRow } from "./list";

/**
 * Spec 0119: un cliente que entro con Apple sin compartir el nombre nace con nombres `""`, y la
 * proyeccion guarda `display_name = first || ' ' || last` = `" "`. El listado del comercio no
 * puede mostrar una fila en blanco.
 */
const row = (displayName: unknown) => ({
  display_name: displayName,
  enrolled_at: new Date("2026-10-01T12:00:00Z"),
  last_visit_at: null,
  program_id: null,
});

describe("toCustomerRow — el nombre", () => {
  it("un nombre real sale tal cual", () => {
    expect(toCustomerRow(row("Ana Pérez")).name).toBe("Ana Pérez");
  });

  it("sin nombre (`' '` de la proyeccion) → «Sin nombre»", () => {
    expect(NAMELESS_CUSTOMER).toBe("Sin nombre");
    expect(toCustomerRow(row(" ")).name).toBe("Sin nombre");
    expect(toCustomerRow(row("")).name).toBe("Sin nombre");
  });
});
