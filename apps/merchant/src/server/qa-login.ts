import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses, memberships } from "@mi-pasaporte/db/schema";
import { openMerchantSession } from "./merchant-session";

/**
 * Spec 0150 — TEMPORAL. Login de QA sin link magico para las 3 cuentas de prueba.
 * Se borra entero (este archivo, la ruta `api/merchant/auth/qa-login`, sus tests y la
 * variable `QA_LOGIN_ENABLED` de Vercel) al terminar las pruebas del owner.
 *
 * La lista es FIJA en el codigo (no se lee de la base, de una variable ni del cliente): el
 * cliente manda solo `account`, y el `userId` sale de aca. Medidas en PROD el 2026-10-04,
 * las tres `owner` `active` con un solo comercio.
 */
export type QaAccount = {
  account: string;
  label: string;
  businessId: string;
  userId: string;
};

export const QA_ACCOUNTS: readonly QaAccount[] = [
  {
    account: "panaderia",
    label: "Panaderia",
    businessId: "f3f74630-b583-4ab7-9bc3-4d47bd2f3fb0",
    userId: "13b520cd-54a7-4acc-9072-06162a7a1993",
  },
  {
    account: "barberia",
    label: "Barberia",
    businessId: "c512bbd2-b203-43f6-8fe5-24778387a331",
    userId: "2857ac6d-2df0-4b25-9e45-77ecadea3a32",
  },
  {
    account: "gym",
    label: "Gym",
    businessId: "02e37e89-66a4-4d1e-9f92-d83e6f4856af",
    userId: "481c2661-a756-48e9-bb15-3b182cb16e49",
  },
];

const DESTINATION = "/backoffice";

/**
 * Comparacion EXACTA con `"true"`, leida en cada llamada (no al importar): apagarla en
 * Vercel es cambiar la variable + redeploy, sin codigo. ORACULO DE M1: `"1"` → apagada.
 */
export function qaLoginEnabled(): boolean {
  return process.env.QA_LOGIN_ENABLED === "true";
}

/** Lo publico de la tabla: nunca `userId` ni `businessId`. */
export function publicQaAccounts(
  accounts: readonly QaAccount[] = QA_ACCOUNTS,
): { account: string; label: string }[] {
  return accounts.map(({ account, label }) => ({ account, label }));
}

/** Decision pura: el `account` del cuerpo → su fila de la tabla, o `null`. */
export function resolveQaAccount(
  account: unknown,
  accounts: readonly QaAccount[] = QA_ACCOUNTS,
): QaAccount | null {
  if (typeof account !== "string" || account === "") return null;
  return accounts.find((entry) => entry.account === account) ?? null;
}

/** Paso 3: el `userId` sigue siendo `owner` `active` de ESE comercio, y el comercio esta `active`. */
async function qaAccountAvailable(entry: QaAccount): Promise<boolean> {
  const rows = await getDb()
    .select({ userId: memberships.userId })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(
      and(
        eq(memberships.businessId, entry.businessId),
        eq(memberships.userId, entry.userId),
        eq(memberships.role, "owner"),
        eq(memberships.status, "active"),
        eq(businesses.status, "active"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export function qaNotFound(): NextResponse {
  return NextResponse.json(
    { error: "No encontrado.", code: "not_found" },
    { status: 404 },
  );
}

/**
 * `POST` ya pasado el apagado (paso 1, que vive en la ruta). La tabla es parametro para que
 * la suite Neon inyecte cuentas sembradas en la rama de CI en vez de tocar las de PROD.
 */
export async function qaLoginPost(
  request: Request,
  accounts: readonly QaAccount[] = QA_ACCOUNTS,
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidBody();
  }
  const raw =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).account
      : undefined;
  const entry = resolveQaAccount(raw, accounts);
  if (!entry) return invalidBody();

  try {
    if (!(await qaAccountAvailable(entry))) {
      return NextResponse.json(
        {
          error: "Esta cuenta de prueba no esta disponible.",
          code: "qa_account_unavailable",
        },
        { status: 403 },
      );
    }
    const cookie = await openMerchantSession(entry.userId);
    console.info("[qa-login]", entry.account);
    return NextResponse.json(
      { redirectTo: DESTINATION },
      { status: 200, headers: { "set-cookie": cookie } },
    );
  } catch (error) {
    // Va el `name`, nunca el mensaje: puede arrastrar datos de la fila.
    console.error("qa_login_unavailable", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      { error: "No pudimos iniciar la sesion.", code: "qa_login_unavailable" },
      { status: 503 },
    );
  }
}

function invalidBody(): NextResponse {
  return NextResponse.json(
    { error: "El cuerpo no es valido.", code: "invalid_body" },
    { status: 400 },
  );
}
