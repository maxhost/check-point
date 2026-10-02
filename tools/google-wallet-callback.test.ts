import { describe, expect, it } from "vitest";
import { GOOGLE_CLASS_SUFFIX } from "../packages/domain/src/server/wallet/google-object";
import {
  CLASS_SUFFIX,
  classIdOf,
  planCallback,
} from "./google-wallet-callback";

/** El script de `callbackOptions` (spec 0107 §4) es autocontenido: su clase tiene que ser
 * la MISMA que emite la app, o configuraria el callback de una clase que no existe. */
describe("google-wallet-callback", () => {
  it("apunta a la misma clase que la app", () => {
    expect(CLASS_SUFFIX).toBe(GOOGLE_CLASS_SUFFIX);
    expect(classIdOf("338")).toBe("338.mipasaporte_identity");
  });

  it("es idempotente: sin cambios si la url ya esta; si no, PATCH de callbackOptions con reviewStatus", () => {
    const url = "https://www.checkpass.club/api/public/wallet/google/callback";
    expect(planCallback({ callbackOptions: { url } }, url)).toEqual({
      action: "noop",
    });
    expect(
      planCallback({ callbackOptions: { url: "https://viejo" } }, url),
    ).toEqual({
      action: "patch",
      body: { callbackOptions: { url }, reviewStatus: "UNDER_REVIEW" },
    });
    expect(planCallback(null, url)).toMatchObject({ action: "patch" });
  });
});
