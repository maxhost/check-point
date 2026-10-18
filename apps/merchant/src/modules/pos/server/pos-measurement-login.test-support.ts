/** Legitimate OTP owner and PIN staff login. Cookie material never enters reports. */
import { writeFile } from "node:fs/promises";
import { expect, vi } from "vitest";
import { consoleEmailOutbox } from "@mi-pasaporte/domain/server/email/console";
import { POST as requestCode } from "../../../app/api/merchant/auth/login/route";
import { POST as verifyCode } from "../../../app/api/merchant/auth/login/verify/route";
import { POST as staffLogin } from "../../../app/api/merchant/auth/staff/route";
import type { Manifest } from "./pos-measurement.test-support";
function cookie(raw: string) {
  const [pair, ...attrs] = raw.split(";");
  const at = pair.indexOf("=");
  const attr = (key: string) =>
    attrs
      .map((a) => a.trim())
      .find((a) => a.toLowerCase().startsWith(key + "="))
      ?.slice(key.length + 1);
  const max = attr("max-age");
  return {
    name: pair.slice(0, at),
    value: pair.slice(at + 1),
    domain: "localhost",
    path: attr("path") ?? "/",
    expires: max
      ? Math.floor(Date.now() / 1000) + Number(max)
      : Math.floor(
          Date.parse(
            attr("expires") ?? new Date(Date.now() + 86400000).toISOString(),
          ) / 1000,
        ),
    httpOnly: attrs.some((a) => a.trim().toLowerCase() === "httponly"),
    secure: attrs.some((a) => a.trim().toLowerCase() === "secure"),
    sameSite: attr("samesite")?.toLowerCase() === "strict" ? "Strict" : "Lax",
  };
}
export async function login(m: Manifest, directory: string) {
  expect(process.env.NODE_ENV).not.toBe("production");
  expect(process.env.EMAIL_PROVIDER).toBe("console");
  expect(process.env.BETTER_AUTH_URL).toBe("http://localhost:43242");
  const start = consoleEmailOutbox.length;
  const spy = vi.spyOn(console, "info").mockImplementation(() => {});
  const req = (path: string, body: unknown) =>
    new Request(`http://localhost:43242${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.242",
      },
      body: JSON.stringify(body),
    });
  try {
    for (const f of m.fixtures) {
      const before = consoleEmailOutbox.length;
      expect(
        (await requestCode(req("/api/merchant/auth/login", { email: f.email })))
          .status,
      ).toBe(200);
      const code = consoleEmailOutbox
        .slice(before)
        .find((mail) => mail.to === f.email)
        ?.subject.match(/(\d{6})$/)?.[1];
      if (!code) throw Error("Missing legitimate OTP");
      const owner = await verifyCode(
        req("/api/merchant/auth/login/verify", { email: f.email, code }),
      );
      expect(owner.status).toBe(200);
      const staff = await staffLogin(
        req("/api/merchant/auth/staff", {
          identifier: `operator@${f.slug}`,
          pin: f.pin,
        }),
      );
      expect(staff.status).toBe(200);
      for (const [role, response] of [
        ["owner", owner],
        ["staff", staff],
      ] as const) {
        const raw = response.headers.getSetCookie();
        expect(raw.length).toBeGreaterThan(0);
        await writeFile(
          `${directory}/cookies-${f.case}-${role}.json`,
          JSON.stringify(raw.map(cookie)),
          { mode: 0o600 },
        );
      }
    }
  } finally {
    spy.mockRestore();
    consoleEmailOutbox.splice(start);
  }
}
