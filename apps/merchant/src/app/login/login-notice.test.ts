import { describe, expect, it, vi } from "vitest";
import { loginNotice } from "./login-notice";

// The page is only asserted on the props it hands down, so the client form (which
// pulls in the better-auth browser client) is replaced by a marker component.
const LoginFormMock = vi.fn();
vi.mock("./login-form", () => ({ LoginForm: LoginFormMock }));

const STAFF_DISABLED_COPY = "Miembro del staff desactivado";

describe("login notice allow-list (ADR 0055)", () => {
  const cases: Array<[string, string | string[] | undefined, string | null]> = [
    ["the known reason", "staff_disabled", STAFF_DISABLED_COPY],
    ["no param at all", undefined, null],
    ["an empty param", "", null],
    ["an invented reason", "cuenta_bloqueada", null],
    ["a near miss", "staff_disabled ", null],
    ["a repeated param (array)", ["staff_disabled"], null],
    ["an HTML injection attempt", "<script>alert(1)</script>", null],
    ["a prototype key", "__proto__", null],
    ["an object key", "constructor", null],
    ["a copy-looking value", STAFF_DISABLED_COPY, null],
  ];

  it.each(cases)("%s → %j", (_name, reason, expected) => {
    expect(loginNotice(reason)).toBe(expected);
  });
});

describe("login page wiring", () => {
  async function initialErrorFor(e: unknown): Promise<unknown> {
    const { default: LoginPage } = await import("./page");
    const element = (await LoginPage({
      searchParams: Promise.resolve(e as { e?: string | string[] }),
    })) as { type: unknown; props: { initialError?: string | null } };
    expect(element.type).toBe(LoginFormMock);
    return element.props.initialError;
  }

  it("translates the reason before handing it to the form", async () => {
    expect(await initialErrorFor({ e: "staff_disabled" })).toBe(
      STAFF_DISABLED_COPY,
    );
  });

  it("never lets the raw query param reach the form", async () => {
    expect(
      await initialErrorFor({ e: "<script>alert(1)</script>" }),
    ).toBeNull();
    expect(await initialErrorFor({ e: "cuenta_bloqueada" })).toBeNull();
  });

  it("shows nothing on a plain /login", async () => {
    expect(await initialErrorFor({})).toBeNull();
  });
});
