import { describe, expect, it } from "vitest";
import {
  DraftProviderUnavailableError,
  stockDraftProviderFromEnv,
} from "./draft-provider";

/** Spec 0212 — resolucion del proveedor del dictado por entorno. */
const env = (vars: Record<string, string>) =>
  vars as unknown as NodeJS.ProcessEnv;
describe("stockDraftProviderFromEnv", () => {
  it("openai usa gpt-6-luna por defecto y respeta STOCK_DRAFT_MODEL", () => {
    expect(
      stockDraftProviderFromEnv(
        env({
          STOCK_DRAFT_PROVIDER: "openai",
          OPENAI_API_KEY: "k",
        }),
      ).model,
    ).toBe("gpt-6-luna");
    expect(
      stockDraftProviderFromEnv(
        env({
          STOCK_DRAFT_PROVIDER: "openai",
          OPENAI_API_KEY: "k",
          STOCK_DRAFT_MODEL: "gpt-5-mini",
        }),
      ).model,
    ).toBe("gpt-5-mini");
  });

  it("sin STOCK_DRAFT_PROVIDER hereda el del catalogo; sin nada, fake", () => {
    expect(
      stockDraftProviderFromEnv(
        env({
          CATALOG_EXTRACTION_PROVIDER: "openai",
          OPENAI_API_KEY: "k",
        }),
      ).id,
    ).toBe("openai");
    expect(stockDraftProviderFromEnv(env({})).id).toBe("fake");
  });

  it("openai sin clave tira (sin fallback silencioso al falso)", () => {
    expect(() =>
      stockDraftProviderFromEnv(env({ STOCK_DRAFT_PROVIDER: "openai" })),
    ).toThrow(DraftProviderUnavailableError);
  });
});
