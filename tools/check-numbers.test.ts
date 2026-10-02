import { describe, expect, it } from "vitest";
import { claimedNumber, duplicateNumbers } from "./check-numbers";

/** Spec 0135 / ADR 0114: el pre-push rechaza numeros de spec/ADR duplicados. */
describe("duplicateNumbers", () => {
  it("dos archivos distintos con el mismo numero chocan", () => {
    expect(duplicateNumbers(["0121-a.md", "0121-b.md", "0122-c.md"])).toEqual([
      "0121",
    ]);
  });

  it("sin repetidos: vacio", () => {
    expect(duplicateNumbers(["0121-a.md", "0122-a.md"])).toEqual([]);
  });

  it("varios repetidos, ordenados", () => {
    expect(
      duplicateNumbers([
        "0130-x.md",
        "0125-a.md",
        "0130-y.md",
        "0125-b.md",
        "0125-c.md",
      ]),
    ).toEqual(["0125", "0130"]);
  });

  it("templates, anexos de contrato y no-.md no reclaman numero", () => {
    expect(
      duplicateNumbers([
        "TEMPLATE.md",
        "TEMPLATE-CHICA.md",
        "0067-identidad-sin-contrasena.md",
        "0067-contratos-de-api.md",
        "0055-canje-de-premios-en-mostrador.md",
        "0055-contratos-del-orquestador.md",
        "0116-paquete-de-dominio-y-app-del-cliente.md",
        "0116-clases-del-cliente.txt",
        ".gitkeep",
      ]),
    ).toEqual([]);
  });
});

describe("claimedNumber", () => {
  it.each([
    ["0135-trabajo-en-paralelo.md", "0135"],
    ["0067-contratos-de-api.md", null],
    ["TEMPLATE.md", null],
    ["0116-modulos-movidos.txt", null],
    ["135-corto.md", null],
  ])("%s → %s", (name, expected) => {
    expect(claimedNumber(name)).toBe(expected);
  });
});
