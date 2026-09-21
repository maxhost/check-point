import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { UNDELIVERABLE_EMAIL_DOMAIN } from "./auth-start";
import { getDb } from "./db";
import { memberships, users } from "./schema";
import { nextSuggestion, slugify } from "./slug";
import { generatePin, hashPin } from "./staff-pin";
import {
  type CreateStaffInput,
  type CreatedStaff,
  StaffError,
  toStaffDTO,
} from "./staff";
import { assertGrantable, parsePermissions } from "./staff-permissions";

/**
 * Spec 0067 §4 — el ALTA del integrante, separada de `staff.ts` porque ese archivo ya
 * quedaba en **338 lineas** con ella adentro (medido con el hook `file-size`, limite 300):
 * dividir, no extender. `staff.ts` conserva el error tipado, el DTO, `ownerContext`, el
 * listado y el alta/baja; aca vive todo lo que el alta agrega en esta spec —handle, PIN y
 * el `user` sin credencial—, que es tambien lo unico que importa `staff-pin.ts`.
 */

/**
 * Valida el cuerpo del alta. **`name` y `permissions`**: cualquier otra clave se ignora.
 *
 * `permissions` es **obligatorio y con al menos un elemento** desde la spec 0086 §5 (decision
 * del owner): dar de alta a alguien que no puede hacer nada no tiene sentido, y para eso
 * existe desactivarlo. Un valor desconocido es `400 unknown_permission` **antes** de llegar a
 * la base — el `CHECK` de la migracion 0041 es la red, no el validador.
 */
export function parseCreateStaffInput(value: unknown): CreateStaffInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StaffError(400, "El cuerpo no es válido.", "invalid_body");
  }
  const body = value as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name)
    throw new StaffError(400, "El nombre es obligatorio.", "name_required");
  if (name.length > 80)
    throw new StaffError(400, "El nombre es muy largo.", "name_too_long");
  return { name, permissions: parsePermissions(body.permissions) };
}

/**
 * El email del staff es **sintetico y no entregable**, que es la salida que la spec §4
 * deja elegir («email sintetico no entregable e `emailVerified=false`, **o** sin email si
 * el esquema lo permite — el implementador elige UNA y lo deja escrito»).
 *
 * **Se elige el sintetico**, y el motivo esta medido, no es preferencia:
 * `merchant_auth.user.email` es `text NOT NULL` con `merchant_auth_user_email_unique`
 * (`schema/auth.ts:12-15`), asi que «sin email» exigiria una migracion de la tabla de
 * better-auth — y `schema/auth.ts` esta fuera del alcance de esta spec.
 *
 * **Spec 0068 §2: ese email se PERSISTE pero NO se serializa.** Salio del `StaffDTO`, asi
 * que ninguna respuesta lo devuelve; la columna sigue existiendo porque es `NOT NULL`.
 *
 * `.invalid` es el TLD que RFC 2606 §2 reserva para que **nunca** resuelva: ningun MTA
 * puede entregarle nada. Y ese email tampoco sirve para entrar: el usuario se crea **sin
 * fila en `merchant_auth.account`**, o sea sin credencial de contraseña, asi que
 * `signInEmail` no tiene contra que verificar ni hoy (con `emailAndPassword` todavia
 * encendido) ni cuando el paso 3 lo apague.
 */
function syntheticEmail(userId: string): string {
  return `staff-${userId}@${UNDELIVERABLE_EMAIL_DOMAIN}`;
}

/**
 * El `handle` del integrante, derivado del nombre y **libre dentro del negocio**.
 *
 * `slugify` cumple lo que promete —siempre devuelve forma valida— pero no mira las
 * reservadas (`"Admin"` → `"admin"`) y colapsa a `"000"` todo nombre sin caracteres
 * latinos (`"日本語"`, `"Мир"`): dos integrantes con nombre en japones chocarian contra
 * `core_business_membership_handle_unique`. Por eso el derivado pasa SIEMPRE por
 * `nextSuggestion`, que sufija (`000-2`) y que ya trata las reservadas como ocupadas.
 *
 * La lectura previa es un TOCTOU asumido, igual que con el slug del negocio: la unicidad
 * la garantiza el indice, y el `insert` que choca se traduce a 409.
 */
async function freeHandle(businessId: string, name: string): Promise<string> {
  const rows = await getDb()
    .select({ handle: memberships.handle })
    .from(memberships)
    .where(eq(memberships.businessId, businessId));
  const taken = rows
    .map((row) => row.handle)
    .filter((handle): handle is string => Boolean(handle));
  return nextSuggestion(slugify(name), taken);
}

/**
 * Alta de un integrante (ADR 0044 + spec 0067 §4 + spec 0086 §5). Quien da de alta escribe
 * el **nombre** y **los permisos**: el `handle` lo deriva el servidor y el `slug` sale de la
 * SESION, nunca del cuerpo — si viajara en el body seria un parametro con el que se podria
 * apuntar al negocio de otro.
 *
 * **Ya no lo hace solo el owner** (spec 0086): tambien un integrante con el permiso `staff`,
 * que es el perfil ADMINISTRADOR. Lo que ese perfil NO puede es otorgar `staff` — R1, y va
 * aplicada aca adentro, no en la ruta, para que cualquier puerta futura la herede.
 *
 * Ya NO pasa por `signUpEmail`: ese camino exige una contraseña que el staff no tiene, y
 * el paso 3 apaga `emailAndPassword` entero. El `user` se inserta directo, **sin fila en
 * `account`** (sin credencial) y con {@link syntheticEmail}.
 *
 * Devuelve el PIN en claro **en esta unica respuesta**: no se guarda en claro y ninguna
 * ruta lo lee despues. Si se pierde, el owner regenera.
 */
export async function createStaff(
  business: { id: string; slug: string },
  value: unknown,
  /** El ROL DEL CALLER, que sale de la fila que resolvio el guard y **nunca del cuerpo**.
   * Lo necesita R1 (spec 0086 §4): un administrador no fabrica otro administrador. Es
   * obligatorio a proposito — un default `"owner"` haria que cualquier puerta nueva se
   * saltee la regla por omision. */
  callerRole: string,
): Promise<CreatedStaff> {
  const input = parseCreateStaffInput(value);
  // R1 — va ANTES de cualquier escritura: un no-owner que manda `staff` en la lista no puede
  // dejar ni un `user` huerfano detras del rechazo.
  assertGrantable(callerRole, input.permissions);
  const handle = await freeHandle(business.id, input.name);
  const pin = generatePin();
  const pinHash = await hashPin(pin);
  const userId = randomUUID();
  const email = syntheticEmail(userId);
  const now = new Date();

  await getDb().insert(users).values({
    id: userId,
    name: input.name,
    email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const [row] = await getDb()
      .insert(memberships)
      .values({
        businessId: business.id,
        userId,
        role: "staff",
        status: "active",
        permissions: input.permissions,
        handle,
        pinHash,
        pinMustChange: true,
        pinUpdatedAt: now,
      })
      .returning({
        role: memberships.role,
        status: memberships.status,
        permissions: memberships.permissions,
        createdAt: memberships.createdAt,
      });
    return {
      staff: toStaffDTO({
        userId,
        name: input.name,
        handle,
        slug: business.slug,
        role: row.role,
        status: row.status,
        permissions: row.permissions,
        createdAt: row.createdAt,
      }),
      pin,
    };
  } catch (error) {
    // Se revierte el `user` recien insertado: una fila sin membresia no puede entrar, pero
    // dejarla quemaria el id y el email sinteticos para siempre. Las FK en cascada se
    // llevan sus sesiones.
    await getDb()
      .delete(users)
      .where(eq(users.id, userId))
      .catch(() => {});
    if (isUniqueViolation(error)) {
      // La carrera que el TOCTOU de `freeHandle` deja abierta: dos altas simultaneas con
      // el mismo nombre. El indice unico es quien decide, no la lectura previa.
      throw new StaffError(
        409,
        "Ese identificador ya está en uso.",
        "handle_taken",
      );
    }
    throw new StaffError(
      503,
      "No pudimos crear al integrante. Intenta de nuevo.",
      "staff_create_failed",
    );
  }
}

/** `23505` = unique_violation, en el error o en cualquiera de sus `cause`. */
function isUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
