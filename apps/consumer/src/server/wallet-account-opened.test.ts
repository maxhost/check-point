import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsumerAccountRow } from "@mi-pasaporte/domain/server/consumer/core";

/**
 * Spec 0111 D5 — the CABLEADO of `last_opened_at`: opening `/c/[webViewToken]` and
 * rendering `/wallet` with a session both call `markAccountOpened` with the account's id,
 * and neither calls it without an account. The write itself (and its 15-minute guard) is
 * pinned against real rows in `wallet-reminder.neon.integration`.
 */

const opened = vi.hoisted(() => ({ markAccountOpened: vi.fn() }));
const walletCore = vi.hoisted(() => ({
  resolveWebViewToken: vi.fn(),
  renderQrSvg: vi.fn(async () => "<svg/>"),
}));
const session = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  issueSession: vi.fn(async () => "session-token"),
}));

vi.mock("@mi-pasaporte/domain/server/wallet/reminder-store", () => opened);
vi.mock("@mi-pasaporte/domain/server/wallet/core", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@mi-pasaporte/domain/server/wallet/core")
  >()),
  ...walletCore,
}));
vi.mock(
  "@mi-pasaporte/domain/server/consumer/session",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@mi-pasaporte/domain/server/consumer/session")
    >()),
    ...session,
  }),
);
vi.mock("@mi-pasaporte/domain/server/consumer/programs", () => ({
  listConsumerPrograms: vi.fn(async () => []),
}));
vi.mock(
  "@mi-pasaporte/domain/server/consumer/coupons",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@mi-pasaporte/domain/server/consumer/coupons")
    >()),
    listConsumerCoupons: vi.fn(async () => []),
  }),
);
vi.mock(
  "@mi-pasaporte/domain/server/consumer/notices",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@mi-pasaporte/domain/server/consumer/notices")
    >()),
    listConsumerNotices: vi.fn(async () => []),
  }),
);
vi.mock(
  "@mi-pasaporte/domain/server/push/subscriptions",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@mi-pasaporte/domain/server/push/subscriptions")
    >()),
    hasWebPushSubscription: vi.fn(async () => false),
  }),
);
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "cookie" }) }),
  headers: async () => new Map([["user-agent", "Android"]]),
}));

import { GET as magicLink } from "../app/(consumer)/c/[webViewToken]/route";
import WalletPage from "../app/(consumer)/wallet/page";

const account = {
  id: "acc-1",
  webViewToken: "wv-1",
  qrToken: "qr-1",
  firstName: "Marcos",
} as ConsumerAccountRow;

function open(token: string) {
  return magicLink(new NextRequest(`https://checkpass.test/c/${token}`), {
    params: Promise.resolve({ webViewToken: token }),
  });
}

describe("last_opened_at is written when the account is opened (spec 0111 D5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /c/[webViewToken] with a valid token marks the account opened", async () => {
    walletCore.resolveWebViewToken.mockResolvedValue(account);
    const response = await open("wv-1");
    expect(response.status).toBe(302);
    expect(opened.markAccountOpened).toHaveBeenCalledWith("acc-1");
  });

  it("an unknown token marks nothing", async () => {
    walletCore.resolveWebViewToken.mockResolvedValue(null);
    expect((await open("nope")).status).toBe(404);
    expect(opened.markAccountOpened).not.toHaveBeenCalled();
  });

  it("/wallet with a session marks the account opened", async () => {
    session.resolveSession.mockResolvedValue(account);
    await WalletPage({});
    expect(opened.markAccountOpened).toHaveBeenCalledWith("acc-1");
  });

  it("/wallet without a session marks nothing", async () => {
    session.resolveSession.mockResolvedValue(null);
    await WalletPage({});
    expect(opened.markAccountOpened).not.toHaveBeenCalled();
  });
});
