import { describe, expect, it } from "vitest";
import { nextLockout, type StaffPinLockoutState } from "./staff-pin";

/**
 * Spec 0067 §4 / ADR 0070 §13 — los numeros del escalado son del OWNER. Este archivo es
 * el oraculo de la mutacion #1 de la spec («cambiar el umbral del stage 1 de 3 a 5»), asi
 * que cada tramo se asevera por COMPORTAMIENTO —cuantos fallos hacen falta y cuanto dura
 * el bloqueo— y no leyendo ninguna constante del modulo: un test que importara la tabla
 * quedaria verde con la tabla mutada.
 *
 * `minutesUntil` compara contra el reloj que se le pasa, no contra `Date.now()`: la
 * funcion es pura y el test no depende de cuanto tarda en correr.
 */

const NOW = new Date("2026-09-16T12:00:00.000Z");

const FRESH: StaffPinLockoutState = {
  failedCount: 0,
  stage: 0,
  lockedUntil: null,
};

/** Minutos entre `now` y el bloqueo resultante. `null` = no quedo bloqueado. */
function minutesUntil(state: StaffPinLockoutState, now: Date): number | null {
  if (state.lockedUntil === null) return null;
  return (state.lockedUntil.getTime() - now.getTime()) / 60_000;
}

/** Aplica `count` fallos seguidos desde `state`, con el reloj quieto. */
function fail(
  state: StaffPinLockoutState,
  count: number,
  now: Date = NOW,
): StaffPinLockoutState {
  let current = state;
  for (let i = 0; i < count; i += 1) {
    current = nextLockout(current, false, now);
  }
  return current;
}

describe("nextLockout — la tabla del owner", () => {
  it("stage 0: bloquea al QUINTO fallo, 15 min, y pasa a stage 1", () => {
    const four = fail(FRESH, 4);
    expect(minutesUntil(four, NOW)).toBe(null);
    expect(four.failedCount).toBe(4);
    expect(four.stage).toBe(0);

    const fifth = nextLockout(four, false, NOW);
    expect(minutesUntil(fifth, NOW)).toBe(15);
    expect(fifth.stage).toBe(1);
    expect(fifth.failedCount).toBe(0);
  });

  it("stage 1: bloquea al TERCER fallo, 1 h, y pasa a stage 2", () => {
    const stageOne: StaffPinLockoutState = {
      failedCount: 0,
      stage: 1,
      lockedUntil: null,
    };

    const two = fail(stageOne, 2);
    expect(minutesUntil(two, NOW)).toBe(null);
    expect(two.failedCount).toBe(2);
    expect(two.stage).toBe(1);

    const third = nextLockout(two, false, NOW);
    expect(minutesUntil(third, NOW)).toBe(60);
    expect(third.stage).toBe(2);
    expect(third.failedCount).toBe(0);
  });

  it("stage 2: bloquea al PRIMER fallo, 24 h, y pasa a stage 3", () => {
    const stageTwo: StaffPinLockoutState = {
      failedCount: 0,
      stage: 2,
      lockedUntil: null,
    };

    const first = nextLockout(stageTwo, false, NOW);
    expect(minutesUntil(first, NOW)).toBe(24 * 60);
    expect(first.stage).toBe(3);
    expect(first.failedCount).toBe(0);
  });

  it("stage 3: bloquea al PRIMER fallo, 24 h, y SE QUEDA en stage 3", () => {
    const stageThree: StaffPinLockoutState = {
      failedCount: 0,
      stage: 3,
      lockedUntil: null,
    };

    const first = nextLockout(stageThree, false, NOW);
    expect(minutesUntil(first, NOW)).toBe(24 * 60);
    expect(first.stage).toBe(3);
  });

  it("el tramo completo, encadenado con el reloj corriendo", () => {
    // 5 fallos → 15 min; se libera → 3 fallos → 1 h; se libera → 1 fallo → 24 h.
    const locked15 = fail(FRESH, 5);
    expect(minutesUntil(locked15, NOW)).toBe(15);

    const after15 = new Date(NOW.getTime() + 16 * 60_000);
    const locked60 = fail(locked15, 3, after15);
    expect(minutesUntil(locked60, after15)).toBe(60);

    const after60 = new Date(after15.getTime() + 61 * 60_000);
    const locked24h = fail(locked60, 1, after60);
    expect(minutesUntil(locked24h, after60)).toBe(24 * 60);
    expect(locked24h.stage).toBe(3);
  });
});

describe("nextLockout — exito y bloqueo vivo", () => {
  it("un login correcto resetea contador, stage y bloqueo", () => {
    const locked15 = fail(FRESH, 5);
    const freed = new Date(NOW.getTime() + 16 * 60_000);
    const twoMore = fail(locked15, 2, freed);
    expect(twoMore.failedCount).toBe(2);
    expect(twoMore.stage).toBe(1);

    const ok = nextLockout(twoMore, true, freed);
    expect(ok).toEqual({ failedCount: 0, stage: 0, lockedUntil: null });
  });

  it("estando bloqueado, un fallo NO avanza el contador ni alarga el bloqueo", () => {
    const locked15 = fail(FRESH, 5);
    const during = new Date(NOW.getTime() + 60_000);

    const after = fail(locked15, 10, during);
    expect(after).toEqual(locked15);
    expect(minutesUntil(after, NOW)).toBe(15);
  });

  it("estando bloqueado, un PIN correcto tampoco levanta el bloqueo", () => {
    const locked15 = fail(FRESH, 5);
    const during = new Date(NOW.getTime() + 60_000);

    expect(nextLockout(locked15, true, during)).toEqual(locked15);
  });

  it("el bloqueo vencido deja de contar: el fallo siguiente vuelve a incrementar", () => {
    const locked15 = fail(FRESH, 5);
    const freed = new Date(NOW.getTime() + 15 * 60_000 + 1);

    const one = nextLockout(locked15, false, freed);
    expect(one.failedCount).toBe(1);
    expect(one.lockedUntil).toBe(null);
  });
});
