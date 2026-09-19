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

/**
 * LA TABLA de entradas HTTP del owner, aparte del test por el hook `file-size` (spec 0079):
 * con la fila del `PUT` de la ruta única, `api-owner-surfaces.test.ts` pasaba de 300 líneas.
 * **Acá no hay ni un `expect`**: los oráculos —y los dobles, que se hoistean por encima de
 * este import— siguen en el test. Esto es sólo la lista.
 */
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

/** Las 13 entradas HTTP de las 10 superficies del owner. `qr` y `slug` incluidas: la
 * primera nació con la spec 0069 (por eso la fila 56 de `PARQUEADO` decía 9 y eran 10).
 * La 13ª es el `PUT` de la ruta única (spec 0079), que es la SEGUNDA sin gate de email. */
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
];

/**
 * **EL CONJUNTO EXACTO DE LAS RUTAS SIN PASO 3, y son DOS desde la spec 0079** — el QR
 * (spec 0075) y la escritura del programa. No es una lista paralela: sale de `SURFACES` por
 * filtro, así que mover una fila cambia los dos pisos que el test asevera.
 *
 * **El motivo de la segunda, escrito acá para que no se lea como un aflojamiento:** después
 * de la spec 0077 el gate de email **ya no vive en la puerta** de la escritura, vive en
 * `saveProgram`, que distingue crear de editar. Crear el primer programa es el paso 3 del
 * alta y una cuenta nueva llega ahí con `email_verified = false` por construcción (ADR 0070
 * §11); editarlo sí exige email verificado o el permiso de alta, y eso lo aplica el WRITER.
 * Poner el paso 3 en esta puerta volvería inalcanzable el alta; sacarlo del writer
 * reabriría el bypass.
 */
export const NOMBRES_SIN_GATE_DE_EMAIL = [
  "loyalty-program (PUT)",
  "loyalty-program/qr",
] as const;

export const SURFACES_SIN_GATE_DE_EMAIL = SURFACES.filter(([name]) =>
  (NOMBRES_SIN_GATE_DE_EMAIL as readonly string[]).includes(name),
);

export const SURFACES_CON_GATE_DE_EMAIL = SURFACES.filter(
  ([name]) => !(NOMBRES_SIN_GATE_DE_EMAIL as readonly string[]).includes(name),
);
