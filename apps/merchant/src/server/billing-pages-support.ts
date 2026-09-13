import { expect } from "vitest";
import type { GuardBusiness } from "./auth-guards";
import type { Seed } from "./counter-integration-support";

/**
 * Spec 0063, D7 / D8 — EL PREÁMBULO COMPARTIDO de los dos archivos de integración de las
 * PÁGINAS de billing. Corte de tamaño decidido por el orquestador ANTES de despachar la D2:
 * el archivo único pasaba de 260 líneas y los 3 casos de D8 salen a
 * `billing-reconcile-page.neon.integration.test.ts`.
 *
 * LOS `vi.mock` NO PUEDEN VIVIR ACÁ — misma lección que `billing-webhook-support.ts`: van en
 * cada `.test.ts`. Lo que sí vive acá son los DOBLES de módulo, o sea las funciones que
 * reemplazan exports.
 *
 * Y ESTE ARCHIVO NO PUEDE IMPORTAR LAS PÁGINAS. NO es estilo: la primera versión las
 * importaba (para compartir los dos `renderToStaticMarkup`) y eso COLGABA LA CORRIDA ENTERA
 * sin emitir una sola línea, con el proceso al 0,0% de CPU — ni siquiera `vitest list`, que
 * sólo colecta, terminaba. El ciclo es: el `vi.mock("./auth-guards")` del test importa este
 * módulo dentro de su factory → este módulo importaba la página → la página importa
 * `./auth-guards`, cuya factory todavía no terminó → espera para siempre. El timeout de los
 * `it` NO salva: el cuelgue es en la COLECCIÓN, antes de que exista un test que pueda
 * expirar. Los renders viven en cada `.test.ts`, que importa las páginas DESPUÉS de los
 * mocks (son 3 líneas, contra una corrida que no termina).
 *
 * Nada de producción importa este archivo.
 */

/** La sesión que las PÁGINAS ven. Mutable porque cada test siembra su propio negocio y el
 * `vi.mock` se registra antes de que exista. */
export const pageSession = {
  current: null as null | {
    userId: string;
    userName: string;
    business: GuardBusiness;
    membership: { role: string; status: string };
  },
};

/** El negocio que las RUTAS ven, por `ownerContext`. Separado de `pageSession` a propósito:
 * un test tiene que poder dejar la página con sesión y la ruta sin owner, que es el estado
 * que distingue «la página no renderiza» de «la ruta no autoriza». */
export const routeOwner = { businessId: null as string | null };

/**
 * El doble de `./auth-guards`: la sesión sale de `pageSession`. El GUARD en sí (ADR 0044) no
 * se re-testea acá — tiene sus propios tests — y el `redirect()` de Next no funciona fuera de
 * un request real, así que doblarlo es lo único que permite renderizar la página.
 */
export function authGuardsDouble(actual: typeof import("./auth-guards")) {
  return {
    ...actual,
    requireOwner: async () => pageSession.current,
    requireBackofficeSession: async () => pageSession.current,
  };
}

/**
 * El doble de `./staff`: `ownerContext` devuelve el negocio de `routeOwner`.
 *
 * ESTO NO PRUEBA EL GATE y no pretende hacerlo: con `ownerContext` doblado, un staff activo y
 * uno desactivado son el mismo `null` — la distinción vive en
 * `billing-routes-auth.neon.integration.test.ts`, con sesiones REALES. Acá el doble existe
 * para que una ruta se pueda invocar con un owner autenticado sin repetir esas 45 líneas de
 * `signInEmail`.
 */
export function staffDouble(actual: typeof import("./staff")) {
  return {
    ...actual,
    ownerContext: async () =>
      routeOwner.businessId === null
        ? null
        : { id: routeOwner.businessId, currencyCode: "USD" },
  };
}

/** Deja las dos superficies apuntando al negocio sembrado. */
export function useBusiness(seed: Seed, name = "Suscripción"): void {
  pageSession.current = {
    userId: seed.userId,
    userName: "Ana",
    business: {
      id: seed.business.id,
      name,
      currencyCode: "USD",
      timezone: "America/Guayaquil",
    },
    membership: { role: "owner", status: "active" },
  };
  routeOwner.businessId = seed.business.id;
}

/**
 * Los caminos de un valor que NO es plano (null, undefined, string, number, boolean, array u
 * objeto literal). Lo que Flight serializa y `JSON.stringify` esconde —`Map`, `Set`,
 * `Promise`, `Date`, instancias— sale acá CON su camino, para que el rojo diga dónde (R13).
 */
export function nonPlainPaths(
  value: unknown,
  path = "props",
  out: string[] = [],
): string[] {
  if (value == null || ["string", "number", "boolean"].includes(typeof value))
    return out;
  if (Array.isArray(value)) {
    value.forEach((item, i) => nonPlainPaths(item, `${path}[${i}]`, out));
    return out;
  }
  if (Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value as object))
      nonPlainPaths(item, `${path}.${key}`, out);
    return out;
  }
  out.push(`${path}: ${Object.prototype.toString.call(value)}`);
  return out;
}

/**
 * EL ORÁCULO COMPLETO DE «ESTO NO CRUZA AL CLIENTE» (ADR 0062). Vive acá, y no repetido en el
 * `.test.ts`, por una razón medida: el requisito 4 del ADR exige correrlo en CADA estado, las
 * ~20 líneas no entraban de nuevo (`billing-pages.neon…` estaba en 299/300 al hook) y el
 * atajo —aseverar en el 2º estado SÓLO la prop que cambia— es exactamente la SEXTA preimagen
 * que cazó un revisor: un secreto en OTRA prop, gateado al estado que el oráculo mira de
 * costado, dejaba 44/44 en VERDE (y encima se imprimía en el HTML).
 *
 * Las cuatro aserciones, cada una cerrando una vuelta del ADR:
 *  1. `type` — el elemento apunta al componente esperado, no a un string salido de datos.
 *  2. `key` — no vive en `props` y Flight lo manda igual (5ª preimagen).
 *  3. UNA SOLA lectura (`structuredClone`), porque Flight lee cada valor UNA vez (4ª).
 *  4. VALOR EXACTO de TODAS las props, con `toEqual` sobre el clon (2ª y 3ª).
 * `nonPlainPaths` está sólo por el mensaje: dice el CAMINO del valor no plano.
 */
export function expectCrossesExactly(
  element: unknown,
  type: unknown,
  props: Record<string, unknown>,
): void {
  const el = element as {
    type: unknown;
    key: unknown;
    props: Record<string, unknown>;
  };
  expect(el.type).toBe(type);
  expect(el.key).toBeNull();
  const crossed = structuredClone(el.props);
  expect(nonPlainPaths(crossed)).toEqual([]);
  expect(crossed).toEqual(props);
}
