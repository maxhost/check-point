import { NextRequest } from "next/server";

import { POST as CHECKOUT } from "../app/api/billing/checkout/route";
import { GET as CATALOG } from "../app/api/catalog/route";
import { GET as LOCATIONS } from "../app/api/locations/route";
import { GET as CAMPAIGNS } from "../app/api/marketing/campaigns/route";
import { GET as STAFF } from "../app/api/staff/route";
import { GET as BRAND } from "../app/api/brand/route";
import { POST as LOGO_UPLOAD } from "../app/api/brand/logo-upload/route";
import {
  GET as PROGRAM,
  PUT as PROGRAM_PUT,
} from "../app/api/loyalty-program/route";
import { POST as STAMP_UPLOAD } from "../app/api/loyalty-program/stamp-upload/route";
import { GET as QR } from "../app/api/loyalty-program/qr/route";
import { GET as TEMPLATES } from "../app/api/loyalty-terms/templates/route";
import { PATCH as SLUG } from "../app/api/merchant/business/slug/route";
import { GET as CHECKLIST } from "../app/api/onboarding/checklist/route";
import { POST as TOUR } from "../app/api/onboarding/tours/[tourId]/route";

/**
 * LA TABLA de entradas HTTP del owner —y desde la spec 0085 también LOS DOBLES—, aparte del
 * test por el hook `file-size`: con la fila del `PUT` de la ruta única (spec 0079) ese archivo
 * pasaba de 300 líneas, y con el doble de `./db` extendido (spec 0085) se pasaba de nuevo. La
 * regla del repo es **dividir, no extender**, y no se borra una aserción para hacer lugar.
 *
 * **Acá no hay ni un `expect`**: los oráculos siguen todos en el test. Esto es la lista y el
 * montaje.
 *
 * **Por qué los dobles pueden vivir en un módulo importado y no rompen el hoisting de
 * `vi.mock`:** este archivo importa las rutas, así que cuando el test lo importa las fábricas
 * de `vi.mock` corren **mientras este módulo todavía se está evaluando**. Por eso ninguna
 * fábrica referencia estos símbolos de forma EAGER — todas los llaman dentro de una función
 * que recién se ejecuta durante un caso (`getDb: () => dobleDeGetDb()`). Leerlos al construir
 * el objeto del mock daría un TDZ.
 */
/** El estado que cada caso mueve. Es un objeto MUTABLE a propósito: los dobles lo leen en el
 * momento de la llamada, así que un caso cambia `session`/`ownerRow` y el siguiente lo limpia
 * en su `beforeEach`. */
export const world = {
  session: null as null | { user: { id: string; emailVerified?: boolean } },
  ownerRow: null as null | Record<string, unknown>,
  businessId: "11111111-1111-4111-8111-111111111111",
  programId: "99999999-9999-4999-8999-999999999999",
  slug: "la-farmacia",
};

/**
 * La fila de la SESIÓN, doblada en un solo lugar y con el permiso de alta en `null` (spec
 * 0077): los casos sólo tocan `world.session.user`, que es lo que ese archivo mide. El permiso
 * con valor tiene sus propios archivos contra Neon.
 */
export const dobleDeSesion = async () =>
  world.session && {
    ...world.session,
    session: { onboardingGrantUntil: null },
  };

export const dobleDeOwnerContext = async () => world.ownerRow;

/**
 * Spec 0075 — **el QR es la única fila que PASA el gate** en un caso, así que es la única que
 * llega a su dominio. Sus dos dependencias de datos se doblan para que ese 200 sea
 * **determinista**: sin esto daría 403 `not_owner` con `DATABASE_URL` puesta (el usuario
 * doblado no existe en la base) y 503 `qr_unavailable` sin ella, y **ninguno de los dos
 * probaría la polaridad**. El 200 contra la base lo prueba `loyalty-qr.neon.integration`.
 */
export const dobleDeProgramForOwner = async () => ({
  business: { id: world.businessId },
  program: { id: world.programId },
  rewards: [],
});

/**
 * Spec 0079 — el `PUT` de la ruta única es la segunda fila sin paso 3, y su desenlace positivo
 * es un 201. El writer se dobla **a propósito**: ese archivo mide el GUARD, y el invariante
 * crear ≠ editar que `saveProgram` aplica de verdad se mide contra Neon
 * (`onboarding-program-bypass.neon.integration.test.ts`).
 */
export const dobleDeSaveProgram = async () => ({
  programId: world.programId,
  created: true,
});

/**
 * EL DOBLE DE `./db`, y su forma **no es cosmética** (spec 0085). Hay DOS consumidores con
 * cadenas distintas:
 *
 * - `select().from().where().limit()` — la lectura del slug, que espera su fila;
 * - `select().from().where()` **sin `.limit()`** — la lectura de `core.business_onboarding_tour`
 *   del checklist, que en drizzle **se espera directamente**.
 *
 * Con una cadena fija terminada en `.limit()`, el `await` del segundo devolvía el OBJETO
 * `{ limit }` en vez de un array, el `.map` reventaba, el `catch` de la ruta lo convertía en
 * **503** y se caían TODOS los casos del checklist de la batería. Por eso `where()` devuelve
 * algo que es a la vez **`await`-able** (un `Promise` de verdad) y portador de `.limit()`.
 *
 * **Y las dos ramas devuelven cosas DISTINTAS a propósito:** el negocio doblado no tiene
 * ninguna fila de progreso de tours —los cuatro items salen `done: false`, que es lo que la
 * batería asevera—.
 *
 * **La rama `.limit()`, en cambio, HOY NO TIENE ORACULO y hay que decirlo:** queda disponible
 * para la lectura del slug, pero **ningún test asevera su contenido**. Medido por el revisor de
 * la 0085 con una mutación (`limit: async () => []`): **sobrevive en verde**, y este archivo
 * tiene un solo importador. No la toques dando por hecho que algo la cuida.
 */
const resultadoDelWhere = () =>
  Object.assign(Promise.resolve([] as Array<Record<string, unknown>>), {
    limit: async () => [{ slug: world.slug }],
  });

export const dobleDeGetDb = () => ({
  select: () => ({ from: () => ({ where: () => resultadoDelWhere() }) }),
});

export const json = (path: string, method: string, body: unknown = {}) =>
  new NextRequest(`https://merchant.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });

/**
 * El cuerpo CORTO de Sellos de la spec 0079. Trae `clauses` a propósito: sin ellas el
 * compositor iría a buscar las semillas del país a la base, y este archivo mide el GUARD,
 * no la composición (eso vive en la integración con Neon).
 */
const PROGRAM_BODY = {
  kind: "stamps",
  configuration: { target: 8 },
  clauses: [{ text: "Términos del comercio." }],
  rewards: [{ type: "custom", label: "Café gratis" }],
};

/** Las 15 entradas HTTP de las superficies del owner. `qr` y `slug` incluidas: la primera
 * nació con la spec 0069 (por eso la fila 56 de `PARQUEADO` decía 9 y eran 10). La 13ª es el
 * `PUT` de la ruta única (spec 0079), que es la SEGUNDA sin gate de email; la 14ª es el
 * checklist del onboarding (spec 0083 §D5), que es la TERCERA.
 *
 * **La 15ª es la escritura del progreso de un tour (spec 0084), y va del lado CON gate** —
 * es lo contrario del checklist y la asimetría es la decisión de esa spec: el checklist se
 * exime porque se gatearía a sí mismo, y esta ruta no tiene ese problema. `verify-email` es el
 * único `required: true` —y desde la spec 0085 ese campo significa que mientras no esté hecho
 * los de `position` mayor están bloqueados—, así que poner el paso 3 acá es HACER CUMPLIR ese
 * bloqueo en vez de sólo reportarlo. El inventario de exenciones sigue en TRES. */
export const SURFACES: Array<[string, () => Promise<Response>]> = [
  ["billing/checkout", () => CHECKOUT(json("/api/billing/checkout", "POST"))],
  ["catalog", () => CATALOG(json("/api/catalog", "GET"))],
  ["locations", () => LOCATIONS(json("/api/locations", "GET"))],
  [
    "marketing/campaigns",
    () => CAMPAIGNS(json("/api/marketing/campaigns", "GET")),
  ],
  ["staff", () => STAFF(json("/api/staff", "GET"))],
  ["brand", () => BRAND(json("/api/brand", "GET"))],
  [
    "brand/logo-upload",
    () => LOGO_UPLOAD(json("/api/brand/logo-upload", "POST")),
  ],
  ["loyalty-program", () => PROGRAM(json("/api/loyalty-program", "GET"))],
  [
    "loyalty-program (PUT)",
    () => PROGRAM_PUT(json("/api/loyalty-program", "PUT", PROGRAM_BODY)),
  ],
  [
    "loyalty-program/stamp-upload",
    () => STAMP_UPLOAD(json("/api/loyalty-program/stamp-upload", "POST")),
  ],
  ["loyalty-program/qr", () => QR(json("/api/loyalty-program/qr", "GET"))],
  [
    "loyalty-terms/templates",
    () => TEMPLATES(json("/api/loyalty-terms/templates", "GET")),
  ],
  [
    "merchant/business/slug",
    () => SLUG(json("/api/merchant/business/slug", "PATCH")),
  ],
  [
    "onboarding/checklist",
    () => CHECKLIST(json("/api/onboarding/checklist", "GET")),
  ],
  [
    // `tourId` válido a propósito: acá se mide el GUARD, no la validación del catálogo. El
    // `404 unknown_tour` —que se evalúa DESPUÉS del guard— tiene su oráculo contra Neon.
    "onboarding/tours/{tourId}",
    () =>
      TOUR(json("/api/onboarding/tours/staff", "POST", { status: "skipped" }), {
        params: Promise.resolve({ tourId: "staff" }),
      }),
  ],
];

/**
 * **EL CONJUNTO EXACTO DE LAS RUTAS SIN PASO 3, y son TRES desde la spec 0083** — el QR
 * (spec 0075), la escritura del programa (spec 0079) y el checklist del onboarding. No es una
 * lista paralela: sale de `SURFACES` por filtro, así que mover una fila cambia los dos pisos
 * que el test asevera.
 *
 * **El motivo de la segunda, escrito acá para que no se lea como un aflojamiento:** después
 * de la spec 0077 el gate de email **ya no vive en la puerta** de la escritura, vive en
 * `saveProgram`, que distingue crear de editar. Crear el primer programa es el paso 3 del
 * alta y una cuenta nueva llega ahí con `email_verified = false` por construcción (ADR 0070
 * §11); editarlo sí exige email verificado o el permiso de alta, y eso lo aplica el WRITER.
 * Poner el paso 3 en esta puerta volvería inalcanzable el alta; sacarlo del writer
 * reabriría el bypass.
 *
 * **El motivo de la tercera (spec 0083 §D5, decisión del owner del 2026-09-20): el
 * AUTO-GATEO.** `GET /api/onboarding/checklist` existe para decirle al owner que le falta
 * verificar el email; con el paso 3 puesto, el único endpoint que reporta ese pendiente
 * quedaría bloqueado justamente por ese pendiente. La pregunta que el docblock de
 * `requireApiOwnerSinGateDeEmail` manda hacer antes de sumar una tercera —«¿está bien que
 * esta ruta se exima?»— se hizo y la respuesta fue sí.
 */
export const NOMBRES_SIN_GATE_DE_EMAIL = [
  "loyalty-program (PUT)",
  "loyalty-program/qr",
  "onboarding/checklist",
] as const;

export const SURFACES_SIN_GATE_DE_EMAIL = SURFACES.filter(([name]) =>
  (NOMBRES_SIN_GATE_DE_EMAIL as readonly string[]).includes(name),
);

export const SURFACES_CON_GATE_DE_EMAIL = SURFACES.filter(
  ([name]) => !(NOMBRES_SIN_GATE_DE_EMAIL as readonly string[]).includes(name),
);
