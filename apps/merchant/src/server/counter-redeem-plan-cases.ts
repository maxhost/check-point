import type { RedeemPlan } from "./counter/redeem-plan";

/**
 * The 24-case table of `docs/specs/0055-contratos-del-orquestador.md` §2, transcribed
 * VERBATIM — same order, same numbering — so a reviewer can diff table against table.
 * It is a table and not a re-implementation on purpose: a second arithmetic that
 * computed the expectation would happily agree with a wrong `planRedemption`.
 *
 * It lives in its own module (like `counter-integration-support.ts`) only so the test
 * file stays under the file-size budget. It has no consumer outside the tests.
 */
export type Case = {
  n: number;
  kind: "points" | "stamps";
  balance: number;
  target?: unknown;
  pointsCost: number | null;
  allow: boolean;
  expected: RedeemPlan;
};

const debit = (
  unitsToDebit: number,
  balanceAfter: number,
  override: boolean,
): RedeemPlan => ({ unitsToDebit, balanceAfter, override });

export const CASES: Case[] = [
  {
    n: 1,
    kind: "points",
    balance: 100,
    pointsCost: 30,
    allow: false,
    expected: debit(30, 70, false),
  },
  {
    n: 2,
    kind: "points",
    balance: 30,
    pointsCost: 30,
    allow: false,
    expected: debit(30, 0, false),
  },
  {
    n: 3,
    kind: "points",
    balance: 29,
    pointsCost: 30,
    allow: false,
    expected: { error: "insufficient_balance" },
  },
  {
    n: 4,
    kind: "points",
    balance: 80,
    pointsCost: 100,
    allow: true,
    expected: debit(80, 0, true),
  },
  {
    n: 5,
    kind: "points",
    balance: 0,
    pointsCost: 100,
    allow: true,
    expected: debit(0, 0, true),
  },
  {
    n: 6,
    kind: "points",
    balance: 100,
    pointsCost: null,
    allow: false,
    expected: { error: "invalid_reward" },
  },
  {
    n: 7,
    kind: "points",
    balance: 100,
    pointsCost: null,
    allow: true,
    expected: { error: "invalid_reward" },
  },
  {
    n: 8,
    kind: "points",
    balance: 100,
    pointsCost: 0,
    allow: false,
    expected: { error: "invalid_reward" },
  },
  {
    n: 9,
    kind: "points",
    balance: 100,
    pointsCost: -5,
    allow: false,
    expected: { error: "invalid_reward" },
  },
  {
    n: 10,
    kind: "points",
    balance: 100,
    pointsCost: 2.5,
    allow: false,
    expected: { error: "invalid_reward" },
  },
  {
    n: 11,
    kind: "stamps",
    balance: 12,
    target: 10,
    pointsCost: null,
    allow: false,
    expected: debit(10, 2, false),
  },
  {
    n: 12,
    kind: "stamps",
    balance: 10,
    target: 10,
    pointsCost: null,
    allow: false,
    expected: debit(10, 0, false),
  },
  {
    n: 13,
    kind: "stamps",
    balance: 9,
    target: 10,
    pointsCost: null,
    allow: false,
    expected: { error: "insufficient_balance" },
  },
  {
    n: 14,
    kind: "stamps",
    balance: 9,
    target: 10,
    pointsCost: null,
    allow: true,
    expected: debit(9, 0, true),
  },
  {
    n: 15,
    kind: "stamps",
    balance: 5,
    target: null,
    pointsCost: null,
    allow: false,
    expected: { error: "invalid_program" },
  },
  {
    n: 16,
    kind: "stamps",
    balance: 5,
    target: null,
    pointsCost: null,
    allow: true,
    expected: { error: "invalid_program" },
  },
  {
    n: 17,
    kind: "stamps",
    balance: 5,
    target: 0,
    pointsCost: null,
    allow: false,
    expected: { error: "invalid_program" },
  },
  {
    n: 18,
    kind: "stamps",
    balance: 5,
    target: "",
    pointsCost: null,
    allow: false,
    expected: { error: "invalid_program" },
  },
  {
    n: 19,
    kind: "stamps",
    balance: 5,
    target: false,
    pointsCost: null,
    allow: false,
    expected: { error: "invalid_program" },
  },
  {
    n: 20,
    kind: "stamps",
    balance: 12,
    target: "10",
    pointsCost: null,
    allow: false,
    expected: debit(10, 2, false),
  },
  {
    n: 21,
    kind: "stamps",
    balance: 5,
    target: 2.5,
    pointsCost: null,
    allow: false,
    expected: { error: "invalid_program" },
  },
  {
    n: 22,
    kind: "stamps",
    balance: 5,
    target: -3,
    pointsCost: null,
    allow: false,
    expected: { error: "invalid_program" },
  },
  {
    n: 23,
    kind: "stamps",
    balance: 0,
    target: 10,
    pointsCost: null,
    allow: true,
    expected: debit(0, 0, true),
  },
  {
    n: 24,
    kind: "points",
    balance: 100,
    pointsCost: 30,
    allow: true,
    expected: debit(30, 70, false),
  },
];
