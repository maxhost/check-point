import { describe, expect, it } from "vitest";
import { adminEmails, isAdminEmail } from "./admin-emails";

describe("adminEmails (spec 0190 §D2)", () => {
  it("sin variable o vacia → nadie (fail-closed)", () => {
    expect(adminEmails({})).toEqual([]);
    expect(adminEmails({ PLATFORM_ADMIN_EMAILS: " , " })).toEqual([]);
    expect(isAdminEmail("a@b.co", {})).toBe(false);
  });

  it("parte por coma, recorta y pasa a minusculas", () => {
    const env = { PLATFORM_ADMIN_EMAILS: " Dueno@CheckPass.club ,otro@x.co" };
    expect(adminEmails(env)).toEqual(["dueno@checkpass.club", "otro@x.co"]);
    expect(isAdminEmail("DUENO@checkpass.club ", env)).toBe(true);
    expect(isAdminEmail("intruso@x.co", env)).toBe(false);
  });
});
