import { createHmac, timingSafeEqual } from "node:crypto";
import { isIanaTimezone } from "@mi-pasaporte/domain/server/timezone";
import { isSupportedCountryCode } from "../supported-countries";

/**
 * Spec 0155 / ADR 0121 §11 — EL TOKEN DE SELECCION.
 *
 * Un solo Details por alta: `POST /api/places/details` firma lo que Google devolvio, el
 * cliente lo guarda opaco y lo devuelve al crear la cuenta (`signup`) o un local. El
 * servidor verifica la firma en vez de volver a llamar a Google. **Las coordenadas del
 * navegador siguen sin ser un hecho**: lo unico que el servidor acepta es lo que el mismo
 * firmo.
 *
 * Formato: `base64url(JSON) + "." + base64url(HMAC-SHA256)`. La clave se DERIVA de
 * `BETTER_AUTH_SECRET` con una etiqueta propia, asi que un token de seleccion no sirve como
 * nada que better-auth firme ni al reves, y no hay env nueva que rotar.
 */
export type Selection = {
  v: 1;
  provider: "google";
  placeId: string;
  label: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  timezone: string;
  types: string[];
  snapshot: Record<string, unknown>;
  /** Vencimiento, en milisegundos desde epoch. */
  exp: number;
};

export type SelectionInput = Omit<Selection, "v" | "provider" | "exp">;

/** Vence a las 2 horas (contrato P2). */
export const SELECTION_TTL_MS = 2 * 60 * 60 * 1000;

/** Token alterado, vencido o con forma invalida → `422 invalid_selection`. */
export class SelectionError extends Error {
  constructor() {
    super("La selección del lugar no es válida o venció.");
    this.name = "SelectionError";
  }
}

/**
 * Sin secreto se LANZA un `Error` comun —no un `SelectionError`—: es una falla interna
 * (503), y jamas se emite ni se acepta un token sin firma.
 */
function signingKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET no está configurado.");
  return createHmac("sha256", secret).update("places-selection-v1").digest();
}

const mac = (payload: string) =>
  createHmac("sha256", signingKey()).update(payload).digest();

export function signSelection(
  selection: SelectionInput,
  now: Date = new Date(),
): string {
  const full: Selection = {
    v: 1,
    provider: "google",
    ...selection,
    exp: now.getTime() + SELECTION_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${payload}.${mac(payload).toString("base64url")}`;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

function isSelection(value: unknown): value is Selection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return (
    s.v === 1 &&
    s.provider === "google" &&
    isText(s.placeId) &&
    isText(s.label) &&
    isFiniteNumber(s.latitude) &&
    isFiniteNumber(s.longitude) &&
    isSupportedCountryCode(s.countryCode) &&
    isIanaTimezone(s.timezone) &&
    Array.isArray(s.types) &&
    s.types.every((type) => typeof type === "string") &&
    !!s.snapshot &&
    typeof s.snapshot === "object" &&
    !Array.isArray(s.snapshot) &&
    isFiniteNumber(s.exp)
  );
}

export function verifySelection(
  token: unknown,
  now: Date = new Date(),
): Selection {
  const key = signingKey();
  if (typeof token !== "string") throw new SelectionError();
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new SelectionError();
  const [payload, signature] = parts;
  const expected = createHmac("sha256", key).update(payload).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    throw new SelectionError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new SelectionError();
  }
  if (!isSelection(parsed) || parsed.exp <= now.getTime())
    throw new SelectionError();
  return parsed;
}
