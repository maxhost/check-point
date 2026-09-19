import { parseSessionInput } from "better-auth/db";
import { describe, expect, it } from "vitest";

// `getMerchantAuth()` construye el adapter en el acto (`drizzleAdapter(getDb())`), asi que
// necesita las tres envs. NINGUNA consulta sale de acá: sólo se lee `auth.options`.
process.env.BETTER_AUTH_SECRET ||= "unit-secret-at-least-32-characters-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";
process.env.DATABASE_URL ||= "postgresql://u:p@host.neon.tech/db";

import { getMerchantAuth } from "./auth";
import {
  ONBOARDING_GRANT_AFTER_COMPLETION_MINUTES,
  ONBOARDING_GRANT_MINUTES,
  onboardingGrantActive,
  programEditDenied,
} from "./onboarding-grant";

/**
 * Spec 0077 §4 y §5 — LA DECISIÓN PURA del permiso de alta y el invariante crear ≠ editar.
 *
 * Lo que este archivo NO prueba: que las puertas la CABLEEN bien, ni que la columna exista.
 * Eso es `onboarding-grant.neon.integration.test.ts` y `onboarding-program.neon…`. Acá se
 * mide la decisión, que es lo único que se puede medir sin base — y el `input: false`, que
 * se mide contra el parser REAL de better-auth, no contra una copia de la config.
 */
const NOW = new Date("2026-09-18T12:00:00.000Z");
const min = (m: number) => new Date(NOW.getTime() + m * 60_000);

describe("onboardingGrantActive (spec 0077 §4)", () => {
  const cases: Array<
    [string, Parameters<typeof onboardingGrantActive>[0], boolean]
  > = [
    [
      "vigente + email SIN verificar → corre",
      { onboardingGrantUntil: min(30), emailVerified: false, now: NOW },
      true,
    ],
    [
      "CORTE 1 — el email se verifica: no corre, aunque el instante siga vigente",
      { onboardingGrantUntil: min(30), emailVerified: true, now: NOW },
      false,
    ],
    [
      "CORTE 2/3 — el instante ya venció (el tope de 60 min, o el acortado de 5)",
      { onboardingGrantUntil: min(-1), emailVerified: false, now: NOW },
      false,
    ],
    [
      "el borde exacto NO corre: `until === now` ya caducó",
      { onboardingGrantUntil: NOW, emailVerified: false, now: NOW },
      false,
    ],
    [
      "fail-closed — `null` (la sesión del staff, que nunca recibe el permiso)",
      { onboardingGrantUntil: null, emailVerified: false, now: NOW },
      false,
    ],
    [
      "fail-closed — `undefined` (la clave ni siquiera vino)",
      { onboardingGrantUntil: undefined, emailVerified: false, now: NOW },
      false,
    ],
    [
      "fail-closed — una fecha INVÁLIDA no abre nada",
      {
        onboardingGrantUntil: new Date("no-es-una-fecha"),
        emailVerified: false,
        now: NOW,
      },
      false,
    ],
    [
      "fail-closed — una cadena que no parsea tampoco",
      { onboardingGrantUntil: "mañana", emailVerified: false, now: NOW },
      false,
    ],
    [
      "el driver puede devolver el `timestamptz` como STRING: sigue corriendo",
      {
        onboardingGrantUntil: min(30).toISOString(),
        emailVerified: false,
        now: NOW,
      },
      true,
    ],
    [
      "`emailVerified` ausente cuenta como NO verificado, pero sin instante no abre nada",
      { onboardingGrantUntil: null, emailVerified: undefined, now: NOW },
      false,
    ],
  ];

  it("la tabla de casos no quedó vacía", () => {
    expect(cases.length).toBe(10);
  });

  it.each(cases)("%s", (_name, input, expected) => {
    expect(onboardingGrantActive(input)).toBe(expected);
  });

  it("los dos topes son los del ADR 0076 §4, y el del alta completa es MÁS CORTO", () => {
    expect(ONBOARDING_GRANT_MINUTES).toBe(60);
    expect(ONBOARDING_GRANT_AFTER_COMPLETION_MINUTES).toBe(5);
    expect(ONBOARDING_GRANT_AFTER_COMPLETION_MINUTES).toBeLessThan(
      ONBOARDING_GRANT_MINUTES,
    );
  });
});

describe("programEditDenied — crear ≠ editar (spec 0077 §5)", () => {
  it("CREAR se permite SIEMPRE, incluso sin email y sin permiso (ADR 0070 §11)", () => {
    expect(
      programEditDenied({
        isEdit: false,
        emailVerified: false,
        onboardingGrantActive: false,
      }),
    ).toBeNull();
  });

  it("EDITAR sin email y sin permiso → 403 `email_not_verified` (EL BYPASS)", () => {
    const denied = programEditDenied({
      isEdit: true,
      emailVerified: false,
      onboardingGrantActive: false,
    });
    expect(denied?.status).toBe(403);
    expect(denied?.code).toBe("email_not_verified");
  });

  it("EDITAR con el email verificado → permitido", () => {
    expect(
      programEditDenied({
        isEdit: true,
        emailVerified: true,
        onboardingGrantActive: false,
      }),
    ).toBeNull();
  });

  it("EDITAR con el permiso de alta vigente → permitido (es el alta reanudando)", () => {
    expect(
      programEditDenied({
        isEdit: true,
        emailVerified: false,
        onboardingGrantActive: true,
      }),
    ).toBeNull();
  });
});

/**
 * `input: false` — LA LÍNEA CRÍTICA DE SEGURIDAD de la spec (§2), medida contra el PARSER
 * REAL de better-auth 1.6.26 y no contra una copia de la config: `parseSessionInput` es el
 * que aplica `input: false` sobre todo dato de entrada que llegue a la tabla `session`
 * (`dist/db/schema.mjs:59-77`, la rama `fields[key].input === false`).
 *
 * Los dos casos van juntos a propósito: el segundo prueba que el primero rechaza **por el
 * valor** y no porque el parser tire con cualquier cosa.
 */
describe("`input: false` muerde (spec 0077 §2)", () => {
  const options = getMerchantAuth().options;

  it("un cuerpo que TRAE `onboardingGrantUntil` es rechazado por el parser", () => {
    expect(() =>
      parseSessionInput(
        options,
        { onboardingGrantUntil: min(60) } as Record<string, unknown>,
        "create",
      ),
    ).toThrow(/onboardingGrantUntil is not allowed to be set/);
  });

  it("CONTROL — sin un valor para esa clave el parser no tira, y devuelve `{}`", () => {
    expect(
      parseSessionInput(
        options,
        { onboardingGrantUntil: undefined } as Record<string, unknown>,
        "create",
      ),
    ).toEqual({});
  });
});
