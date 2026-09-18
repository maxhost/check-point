import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../server/db";
import { businesses, memberships, users } from "../../../../../server/schema";
import { openMerchantSession } from "../../../../../server/merchant-session";
import { staffError } from "../../../staff/_auth";
import { businessStatusFailure } from "../../../../../server/api-owner";
import {
  isValidPin,
  lockedFor,
  registerPinAttempt,
  verifyPin,
} from "../../../../../server/staff-pin";

export const dynamic = "force-dynamic";

/**
 * POST /api/merchant/auth/staff — login del integrante con `handle@slug` + PIN
 * (spec 0067 §4, ADR 0070 §13). Contrato: `docs/specs/0067-contratos-de-api.md` §1.
 *
 * **Es ruta propia y no el plugin `username` de better-auth**, medido en 1.6.26: la regla
 * global de `/sign-in*` esta keyeada por `(IP, path)` —todo el staff de un local comparte
 * bucket y quien rota IPs no tiene limite por cuenta—, su storage por defecto es `memory`
 * (en lambda no hay donde persistir 15 min / 1 h / 24 h) y ademas se apaga fuera de
 * produccion. El bloqueo de esta ruta es por `(negocio, integrante)` y vive en la base.
 *
 * Orden de las decisiones, que **es** el contrato:
 *
 *  1. cuerpo mal formado → 400, sin tocar la base;
 *  2. identificador que no resuelve → **401 generico**, el mismo cuerpo que un PIN malo:
 *     la ruta no dice si ese integrante existe;
 *  3. **el PIN se evalua SIEMPRE** —tambien si hay un bloqueo vivo— y el intento se
 *     registra en UN solo statement atomico con el guard del bloqueo adentro;
 *  4. **bloqueo vivo → 429, aunque el PIN sea correcto** (el bloqueo no se levanta con el
 *     PIN bueno) y aunque el bloqueo lo acabe de disparar este mismo intento;
 *  5. PIN incorrecto → 401;
 *  6. integrante `disabled` → 403 `staff_disabled` (ADR 0055), **despues** de verificar el
 *     PIN: contestarlo antes convertiria la ruta en un oraculo de quien trabaja ahi;
 *  7. todo bien → 200 con la cookie de sesion y `mustChangePin`.
 *
 * **Sobre el paso 3, para que el docblock no afirme lo que el codigo no hace:** la spec §4
 * escribe «con `locked_until > now()` la ruta responde 429 **sin evaluar el PIN**». Esta
 * ruta lo cumple en lo OBSERVABLE, no en el orden — el guard del bloqueo vive adentro del
 * `UPDATE` atomico, que es lo que la misma seccion exige, y consultarlo antes seria el
 * read-then-write que prohibe. Lo que el cliente puede ver si se cumple: el intento
 * bloqueado **no consume nada** (el estado no se mueve) y el 429 es identico con PIN bueno
 * o malo, asi que no filtra cual era. El costo es un hash de mas por intento bloqueado, y
 * a cambio la respuesta tarda lo mismo siempre.
 */
export async function POST(request: Request) {
  // TODO lo que toca la base va adentro del `try`: un fallo de base tiene que salir como
  // el 503 `staff_unavailable` que declara el contrato, no como un 500 pelado de Next.
  try {
    return await staffLogin(request);
  } catch (error) {
    return staffError(error, "No pudimos validar el acceso.");
  }
}

async function staffLogin(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "El cuerpo no es válido.", code: "invalid_body" },
      { status: 400 },
    );
  }

  const identifier =
    typeof body.identifier === "string" ? body.identifier.trim() : "";
  const pin = body.pin;
  if (!identifier || !isValidPin(pin)) {
    return NextResponse.json(
      { error: "Revisa el identificador y el PIN.", code: "invalid_body" },
      { status: 400 },
    );
  }

  const parsed = parseIdentifier(identifier);
  const row = parsed ? await findStaff(parsed.handle, parsed.slug) : null;
  if (!row) return invalidCredentials();

  const now = new Date();
  // `verifyPin` NUNCA tira: el `pin_hash` centinela del backfill de la 0032
  // (`'legacy-sin-pin'`) hace que better-auth lance `Invalid password hash`, y ese throw
  // suelto seria un 500 que ademas distinguiria esas filas de las demas.
  const ok = await verifyPin(row.pinHash ?? "", pin);
  const state = await registerPinAttempt(row.businessId, row.userId, ok, now);

  const retryAfter = lockedFor(state, now);
  if (retryAfter !== null) {
    return NextResponse.json(
      {
        error: "Demasiados intentos. Prueba más tarde.",
        code: "pin_locked",
        retryAfterSeconds: retryAfter,
      },
      { status: 429, headers: { "retry-after": String(retryAfter) } },
    );
  }
  if (!ok) return invalidCredentials();

  if (row.status !== "active") {
    return NextResponse.json(
      { error: "Tu acceso está desactivado.", code: "staff_disabled" },
      { status: 403 },
    );
  }

  /**
   * EL EJE `status` DEL NEGOCIO (spec 0072 §D4): con `suspended` o `closed` **el staff no
   * obtiene sesión**, ni una. Es la decisión textual del owner: «si yo suspendo un comercio
   * […] deja de acceder a las funciones, si lo cierro no hay ni siquiera login».
   *
   * VA DESPUÉS de verificar el PIN, por el mismo motivo que `staff_disabled` (paso 6 del
   * contrato de esta ruta): contestarlo antes convertiría la ruta en un oráculo de qué
   * negocios existen y en qué estado están, a cualquiera que tipee un `handle@slug`.
   *
   * El `suspension_reason` NO viaja: el motivo se serializa sólo al owner (§D4).
   */
  const businessFailure = businessStatusFailure(
    row.businessStatus,
    null,
    false,
  );
  if (businessFailure) {
    return NextResponse.json(
      { error: businessFailure.message, code: businessFailure.code },
      { status: businessFailure.status },
    );
  }

  const cookie = await openMerchantSession(row.userId);
  return NextResponse.json(
    {
      staff: {
        userId: row.userId,
        name: row.name,
        identifier: `${parsed?.handle}@${parsed?.slug}`,
        mustChangePin: row.pinMustChange,
      },
    },
    { status: 200, headers: { "set-cookie": cookie } },
  );
}

/** Mismo cuerpo para «no existe» y «PIN incorrecto»: la diferencia no se publica. */
function invalidCredentials() {
  return NextResponse.json(
    {
      error: "El identificador o el PIN no son correctos.",
      code: "invalid_credentials",
    },
    { status: 401 },
  );
}

/**
 * `handle@slug` → sus dos partes. Se corta por el ULTIMO `@` porque ni el handle ni el
 * slug pueden contenerlo (`^[a-z0-9-]+$`), asi que un identificador con dos `@` es basura
 * y tiene que caer en el 401 generico, no resolver por la mitad.
 */
function parseIdentifier(raw: string): { handle: string; slug: string } | null {
  const at = raw.lastIndexOf("@");
  if (at < 1 || at === raw.length - 1) return null;
  const handle = raw.slice(0, at).toLowerCase();
  const slug = raw.slice(at + 1).toLowerCase();
  if (handle.includes("@")) return null;
  return { handle, slug };
}

/** Resolucion en dos pasos de la spec §4: `slug` → negocio, `(negocio, handle)` → membresia. */
async function findStaff(handle: string, slug: string) {
  const [row] = await getDb()
    .select({
      businessId: businesses.id,
      userId: memberships.userId,
      name: users.name,
      status: memberships.status,
      // Spec 0072 §D4: el eje `status` del NEGOCIO, una columna mas en el
      // `innerJoin(businesses)` que esta resolucion ya hacia.
      businessStatus: businesses.status,
      pinHash: memberships.pinHash,
      pinMustChange: memberships.pinMustChange,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(businesses.slug, slug),
        eq(memberships.handle, handle),
        eq(memberships.role, "staff"),
      ),
    )
    .limit(1);
  return row ?? null;
}
