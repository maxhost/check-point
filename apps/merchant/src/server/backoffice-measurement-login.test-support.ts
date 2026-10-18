/** Real owner OTP flow for M0. Cookies stay in a separate private temporary directory. */
import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { expect, vi } from "vitest";
import { consoleEmailOutbox } from "@mi-pasaporte/domain/server/email/console";
import { POST as REQUEST_CODE } from "../app/api/merchant/auth/login/route";
import { POST as VERIFY } from "../app/api/merchant/auth/login/verify/route";
import { getMerchantAuth } from "./auth";
import type { Manifest } from "./backoffice-measurement.test-support";

type Cookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
};
function parseCookie(raw: string): Cookie {
  const [pair, ...attributes] = raw.split(";");
  const separator = pair.indexOf("=");
  if (separator < 1) throw new Error("Login returned invalid cookie metadata");
  const get = (name: string) =>
    attributes
      .map((a) => a.trim())
      .find((a) => a.toLowerCase().startsWith(`${name}=`))
      ?.slice(name.length + 1);
  const sameSite = get("samesite")?.toLowerCase();
  const maxAge = get("max-age"),
    expires = get("expires");
  const cookie: Cookie = {
    name: pair.slice(0, separator),
    value: pair.slice(separator + 1),
    domain: "localhost",
    path: get("path") ?? "/",
    expires:
      maxAge !== undefined
        ? Math.floor(Date.now() / 1000) + Number(maxAge)
        : expires
          ? Math.floor(Date.parse(expires) / 1000)
          : Math.floor(Date.now() / 1000) + 86400,
    httpOnly: attributes.some((a) => a.trim().toLowerCase() === "httponly"),
    secure: attributes.some((a) => a.trim().toLowerCase() === "secure"),
    sameSite:
      sameSite === "strict" ? "Strict" : sameSite === "none" ? "None" : "Lax",
  };
  if (
    !Number.isFinite(cookie.expires) ||
    cookie.expires <= Date.now() / 1000 ||
    !cookie.value
  )
    throw new Error("Login returned expired or empty cookie");
  return cookie;
}
export async function loginFixtures(m: Manifest) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Fixture login requires isolated test console provider");
  expect(process.env.BETTER_AUTH_URL).toBe("http://localhost:43152");
  if (
    !process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET.length < 32
  )
    throw new Error("Coordinator must assign baseline auth secret");
  const directory = process.env.BACKOFFICE_MEASUREMENT_COOKIE_DIR;
  if (!directory || !isAbsolute(directory))
    throw new Error("Private absolute cookie directory required");
  const previous = await lstat(directory).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== "ENOENT") throw e;
    return null;
  });
  if (previous?.isSymbolicLink())
    throw new Error("Cookie directory symlink forbidden");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const actual = await realpath(directory),
    temporary = await realpath(tmpdir());
  const inside = (root: string) => {
    const part = relative(root, actual);
    return part === "" || (!part.startsWith("..") && !isAbsolute(part));
  };
  if (
    ![temporary, "/private/tmp", "/tmp"].some(inside) ||
    inside(
      await realpath(fileURLToPath(new URL("../../../../", import.meta.url))),
    )
  )
    throw new Error(
      "Cookies must stay in temporary storage outside repository",
    );
  const oldProvider = process.env.EMAIL_PROVIDER;
  process.env.EMAIL_PROVIDER = "console";
  const initial = consoleEmailOutbox.length;
  const logger = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    for (const f of m.fixtures) {
      const before = consoleEmailOutbox.length;
      const request = (path: string, body: unknown) =>
        new Request(`http://localhost:43152${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.238",
          },
          body: JSON.stringify(body),
        });
      const accepted = await REQUEST_CODE(
        request("/api/merchant/auth/login", { email: f.email }),
      );
      expect(accepted.status).toBe(200);
      expect(await accepted.json()).toEqual({ accepted: true });
      const code = consoleEmailOutbox
        .slice(before)
        .find((mail) => mail.to === f.email)
        ?.subject.match(/(\d{6})$/)?.[1];
      if (!code || !/^\d{6}$/.test(code))
        throw new Error("Existing login flow did not issue fixture OTP");
      const verified = await VERIFY(
        request("/api/merchant/auth/login/verify", { email: f.email, code }),
      );
      expect(verified.status).toBe(200);
      expect(await verified.json()).toEqual({ destination: "/backoffice" });
      const raw = verified.headers.getSetCookie();
      if (!raw.length)
        throw new Error("Existing login flow returned no cookies");
      const cookieHeader = raw.map((value) => value.split(";")[0]).join("; ");
      const session = await getMerchantAuth().api.getSession({
        headers: new Headers({ cookie: cookieHeader }),
      });
      expect(session?.user.id).toBe(f.userId);
      await writeFile(
        `${actual}/cookies-${f.count}.json`,
        JSON.stringify(raw.map(parseCookie)),
        { flag: "wx", mode: 0o600 },
      );
    }
  } finally {
    logger.mockRestore();
    consoleEmailOutbox.splice(initial);
    if (oldProvider === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = oldProvider;
  }
}
