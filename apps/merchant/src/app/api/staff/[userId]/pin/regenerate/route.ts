import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../server/db";
import {
  memberships,
  sessions,
  staffPinLockouts,
  users,
} from "../../../../../../server/schema";
import { generatePin, hashPin } from "../../../../../../server/staff-pin";
import { toStaffDTO } from "../../../../../../server/staff";
import { requireStaffAccess, staffError } from "../../../_auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/staff/:userId/pin/regenerate — el owner rota el PIN de un integrante que lo
 * perdio (spec 0067 §4). Contrato: `docs/specs/0067-contratos-de-api.md` §4.
 *
 * Hace las cuatro cosas juntas, y las cuatro tienen test:
 *
 *  1. rota el hash y devuelve el PIN en claro **una sola vez**;
 *  2. `pin_must_change = true`, asi que el integrante vuelve a pasar por el cambio;
 *  3. **resetea el bloqueo**: si el PIN se perdio estando bloqueado, un PIN nuevo con el
 *     candado puesto no serviria de nada;
 *  4. **revoca las sesiones de ese integrante**, con el mismo `DELETE` de
 *     `auth-guards.ts:77` y `setStaffStatus` — no se agrega un mecanismo de revocacion
 *     nuevo (ADR 0055).
 *
 * **Aislamiento:** `requireStaffAccess` resuelve el negocio desde la SESION, y el `UPDATE`
 * lleva `business_id` en el `WHERE`. Un owner del negocio A pidiendo un staff del negocio
 * B no matchea ninguna fila → **404, no 403**: un 403 confirmaria que ese id existe.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  // El guard va ADENTRO del `try` (spec 0068 §3): resolver la sesión también consulta la
  // base, y afuera un fallo de base salía 500 sin `code` en vez del 503 del contrato.
  try {
    const auth = await requireStaffAccess(request);
    if ("response" in auth) return auth.response;

    const { userId } = await params;
    const pin = generatePin();
    const pinHash = await hashPin(pin);
    const now = new Date();

    const [row] = await getDb()
      .update(memberships)
      .set({ pinHash, pinMustChange: true, pinUpdatedAt: now })
      .where(
        and(
          eq(memberships.businessId, auth.business.id),
          eq(memberships.userId, userId),
          eq(memberships.role, "staff"),
        ),
      )
      .returning({
        role: memberships.role,
        status: memberships.status,
        permissions: memberships.permissions,
        handle: memberships.handle,
        createdAt: memberships.createdAt,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Ese integrante no existe.", code: "staff_not_found" },
        { status: 404 },
      );
    }

    await getDb()
      .delete(staffPinLockouts)
      .where(
        and(
          eq(staffPinLockouts.businessId, auth.business.id),
          eq(staffPinLockouts.userId, userId),
        ),
      );
    await getDb().delete(sessions).where(eq(sessions.userId, userId));

    const [profile] = await getDb()
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return NextResponse.json(
      {
        staff: toStaffDTO({
          userId,
          name: profile?.name ?? "",
          handle: row.handle,
          slug: auth.business.slug,
          role: row.role,
          status: row.status,
          permissions: row.permissions,
          createdAt: row.createdAt,
        }),
        pin,
      },
      { status: 200 },
    );
  } catch (error) {
    return staffError(error, "No pudimos regenerar el PIN.");
  }
}
