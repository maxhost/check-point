import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getMerchantAuth } from "../../../../../server/auth";
import { staffError } from "../../_auth";
import { getDb } from "../../../../../server/db";
import { memberships } from "../../../../../server/schema";
import {
  hashPin,
  isValidPin,
  lockedFor,
  registerPinAttempt,
  verifyPin,
} from "../../../../../server/staff-pin";

export const dynamic = "force-dynamic";

/**
 * POST /api/staff/:userId/pin — el integrante cambia SU PIN. Es el «cambio obligatorio del
 * primer uso» de la spec 0067 §4. Contrato: `docs/specs/0067-contratos-de-api.md` §3.
 *
 * **La ruta exige el PIN actual y ese es el invariante mas peligroso de todo el paso.**
 * Sin esa verificacion, cualquiera con una sesion abierta podria fijarse un PIN nuevo; y
 * como el backfill de la migracion 0032 dejo `pin_must_change = true` sobre las membresias
 * de staff heredadas, «cambiar sin verificar» seria una toma de cuenta de todas ellas.
 * Tiene su test: `staff-pin-change.neon.integration.test.ts`.
 *
 * El intento pasa por el MISMO bloqueo escalado que el login: si no, este endpoint seria
 * el camino barato para adivinar el PIN a fuerza bruta. Y `verifyPin` no tira contra el
 * centinela `'legacy-sin-pin'`, asi que esas filas contestan 401/429, nunca 500.
 *
 * **El PIN se evalua SIEMPRE, tambien cuando hay un bloqueo vivo** (la spec §4 dice «429
 * sin evaluar el PIN»; esto lo cumple en lo observable y no en el orden). El guard del
 * bloqueo vive adentro del `UPDATE` atomico, que es lo que exige la misma seccion, y para
 * consultarlo antes habria que leer la fila primero — el read-then-write que la spec
 * prohibe. Lo que el usuario puede observar SI se cumple: el intento **no consume nada**
 * (el estado no se mueve) y el 429 es identico con PIN bueno o malo, o sea que no filtra
 * cual era. El costo es un hash de mas por intento bloqueado, y a cambio el tiempo de
 * respuesta es constante.
 *
 * `[userId]` y no `[id]`: `api/staff/[userId]/status/` ya existe y Next no admite dos
 * nombres de parametro en el mismo nivel.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  // TODO lo que toca la base va adentro del `try` —incluida la resolucion de la sesion,
  // que tambien consulta—: un fallo de base tiene que salir como el 503
  // `staff_unavailable` que declara el contrato, no como un 500 pelado de Next.
  try {
    return await changePinRequest(request, await params);
  } catch (error) {
    return staffError(error, "No pudimos cambiar el PIN.");
  }
}

async function changePinRequest(
  request: Request,
  { userId }: { userId: string },
): Promise<NextResponse> {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return NextResponse.json(
      { error: "No autorizado.", code: "unauthorized" },
      { status: 401 },
    );
  }

  // Un integrante solo cambia SU propio PIN. Se contesta 404 y no 403 para no confirmar
  // que ese id existe, igual que hace el aislamiento entre negocios.
  if (userId !== session.user.id) {
    return NextResponse.json(
      { error: "Ese integrante no existe.", code: "staff_not_found" },
      { status: 404 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "El cuerpo no es válido.", code: "invalid_body" },
      { status: 400 },
    );
  }

  const { currentPin, newPin } = body;
  if (!isValidPin(currentPin) || !isValidPin(newPin)) {
    return NextResponse.json(
      { error: "El PIN debe tener 6 dígitos.", code: "invalid_pin_format" },
      { status: 400 },
    );
  }
  if (currentPin === newPin) {
    return NextResponse.json(
      { error: "El PIN nuevo debe ser distinto.", code: "pin_unchanged" },
      { status: 400 },
    );
  }

  return changePin(userId, currentPin, newPin);
}

/** El trabajo contra la base, ya validados la sesion, el `userId` y los dos PINes. */
async function changePin(
  userId: string,
  currentPin: string,
  newPin: string,
): Promise<NextResponse> {
  // La membresia se resuelve por `user_id`, que es lo unico que trae la sesion — pero la
  // PK de `business_membership` es `(business_id, user_id)` y nada impide dos membresias
  // de staff del mismo usuario en negocios distintos. Con `limit(1)` esa fila decidiria a
  // dedo contra que negocio corren el lockout y el `UPDATE`. Se piden DOS y se exige
  // exactamente una: la ambiguedad se rechaza, no se resuelve. Hoy es inalcanzable
  // (`createStaff` acuña un `user` nuevo por integrante), y este guard es lo que hace que
  // siga siendolo si eso cambia.
  const rows = await getDb()
    .select({
      businessId: memberships.businessId,
      status: memberships.status,
      pinHash: memberships.pinHash,
    })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.role, "staff")))
    .limit(2);
  if (rows.length !== 1) {
    return NextResponse.json(
      { error: "Ese integrante no existe.", code: "staff_not_found" },
      { status: 404 },
    );
  }
  const row = rows[0];

  const now = new Date();
  const ok = await verifyPin(row.pinHash ?? "", currentPin);
  const state = await registerPinAttempt(row.businessId, userId, ok, now);

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
  if (!ok) {
    return NextResponse.json(
      { error: "El PIN actual no es correcto.", code: "invalid_credentials" },
      { status: 401 },
    );
  }
  if (row.status !== "active") {
    return NextResponse.json(
      { error: "Tu acceso está desactivado.", code: "staff_disabled" },
      { status: 403 },
    );
  }

  await getDb()
    .update(memberships)
    .set({
      pinHash: await hashPin(newPin),
      pinMustChange: false,
      pinUpdatedAt: now,
    })
    .where(
      and(
        eq(memberships.businessId, row.businessId),
        eq(memberships.userId, userId),
      ),
    );

  return NextResponse.json({ ok: true, mustChangePin: false }, { status: 200 });
}
