import type { RewardState } from "./types";

/**
 * The per-reward state table of the Canjear mode (spec 0055 «UI — consola de mostrador»),
 * transcribed from §2 of `docs/specs/0055-contratos-del-orquestador.md` — same order and
 * same numbering as the server's `planRedemption` table, so a reviewer can diff table
 * against table and see where the UI deliberately differs: `insufficient_balance` is not
 * an error here, it is the "Faltan N" state, enabled only when the program dispenses.
 *
 * It is a TABLE, not a re-implementation: an expectation computed with the same
 * arithmetic would happily agree with a wrong `rewardState`. Cases 25-28 are extra and
 * labelled where they appear.
 *
 * Lives in its own module (like `server/counter-redeem-plan-cases.ts`) only so the test
 * file stays under the file-size budget. No consumer outside the test.
 */
export type Case = {
  n: number;
  kind: string;
  balance: number;
  target?: unknown;
  pointsCost: number | null;
  allow: boolean;
  expected: RewardState;
};

export const redeemable = (cost: number): RewardState => ({
  status: "redeemable",
  cost,
  missing: 0,
  enabled: true,
  label: "Canjeable",
});

export const short = (
  cost: number,
  missing: number,
  enabled: boolean,
  label: string,
): RewardState => ({ status: "short", cost, missing, enabled, label });

export const unavailable: RewardState = {
  status: "unavailable",
  cost: null,
  missing: 0,
  enabled: false,
  label: "No disponible",
};

export const CASES: Case[] = [
  {
    n: 1,
    kind: "points",
    balance: 100,
    pointsCost: 30,
    allow: false,
    expected: redeemable(30),
  },
  {
    n: 2,
    kind: "points",
    balance: 30,
    pointsCost: 30,
    allow: false,
    expected: redeemable(30),
  },
  {
    n: 3,
    kind: "points",
    balance: 29,
    pointsCost: 30,
    allow: false,
    expected: short(30, 1, false, "Faltan 1 punto"),
  },
  {
    n: 4,
    kind: "points",
    balance: 80,
    pointsCost: 100,
    allow: true,
    expected: short(100, 20, true, "Faltan 20 puntos"),
  },
  {
    n: 5,
    kind: "points",
    balance: 0,
    pointsCost: 100,
    allow: true,
    expected: short(100, 100, true, "Faltan 100 puntos"),
  },
  {
    n: 6,
    kind: "points",
    balance: 100,
    pointsCost: null,
    allow: false,
    expected: unavailable,
  },
  {
    n: 7,
    kind: "points",
    balance: 100,
    pointsCost: null,
    allow: true,
    expected: unavailable,
  },
  {
    n: 8,
    kind: "points",
    balance: 100,
    pointsCost: 0,
    allow: false,
    expected: unavailable,
  },
  {
    n: 9,
    kind: "points",
    balance: 100,
    pointsCost: -5,
    allow: false,
    expected: unavailable,
  },
  {
    n: 10,
    kind: "points",
    balance: 100,
    pointsCost: 2.5,
    allow: false,
    expected: unavailable,
  },
  {
    n: 11,
    kind: "stamps",
    balance: 12,
    target: 10,
    pointsCost: null,
    allow: false,
    expected: redeemable(10),
  },
  {
    n: 12,
    kind: "stamps",
    balance: 10,
    target: 10,
    pointsCost: null,
    allow: false,
    expected: redeemable(10),
  },
  {
    n: 13,
    kind: "stamps",
    balance: 9,
    target: 10,
    pointsCost: null,
    allow: false,
    expected: short(10, 1, false, "Faltan 1 sello"),
  },
  {
    n: 14,
    kind: "stamps",
    balance: 9,
    target: 10,
    pointsCost: null,
    allow: true,
    expected: short(10, 1, true, "Faltan 1 sello"),
  },
  {
    n: 15,
    kind: "stamps",
    balance: 5,
    target: null,
    pointsCost: null,
    allow: false,
    expected: unavailable,
  },
  {
    n: 16,
    kind: "stamps",
    balance: 5,
    target: null,
    pointsCost: null,
    allow: true,
    expected: unavailable,
  },
  {
    n: 17,
    kind: "stamps",
    balance: 5,
    target: 0,
    pointsCost: null,
    allow: false,
    expected: unavailable,
  },
  {
    n: 18,
    kind: "stamps",
    balance: 5,
    target: "",
    pointsCost: null,
    allow: false,
    expected: unavailable,
  },
  {
    n: 19,
    kind: "stamps",
    balance: 5,
    target: false,
    pointsCost: null,
    allow: false,
    expected: unavailable,
  },
  {
    n: 20,
    kind: "stamps",
    balance: 12,
    target: "10",
    pointsCost: null,
    allow: false,
    expected: redeemable(10),
  },
  {
    n: 21,
    kind: "stamps",
    balance: 5,
    target: 2.5,
    pointsCost: null,
    allow: false,
    expected: unavailable,
  },
  {
    n: 22,
    kind: "stamps",
    balance: 5,
    target: -3,
    pointsCost: null,
    allow: false,
    expected: unavailable,
  },
  {
    n: 23,
    kind: "stamps",
    balance: 0,
    target: 10,
    pointsCost: null,
    allow: true,
    expected: short(10, 10, true, "Faltan 10 sellos"),
  },
  {
    n: 24,
    kind: "points",
    balance: 100,
    pointsCost: 30,
    allow: true,
    expected: redeemable(30),
  },
  // Not in the server table: a nonsense balance snapshot, and a Sellos `target` arriving
  // `undefined`. Both must land on "No disponible" — never on a free redemption.
  // `programDTO` DOES serialize `target` (same spec): this pins the field arriving absent
  // ANYWAY (stale client, `configuration` without `target`), not a missing DTO field.
  {
    n: 25,
    kind: "stamps",
    balance: 12,
    target: undefined,
    pointsCost: null,
    allow: false,
    expected: unavailable,
  },
  {
    n: 26,
    kind: "points",
    balance: -1,
    pointsCost: 30,
    allow: false,
    expected: unavailable,
  },
  {
    n: 27,
    kind: "points",
    balance: 1.5,
    pointsCost: 1,
    allow: false,
    expected: unavailable,
  },
  // The Sellos reward carries no `pointsCost`: the cost is the card size, never the
  // reward's. Reading the wrong field here would make every stamps card unavailable.
  {
    n: 28,
    kind: "stamps",
    balance: 10,
    target: 10,
    pointsCost: 999,
    allow: false,
    expected: redeemable(10),
  },
];
