/**
 * Spec 0074 §D1/§D3 — LAS FORMAS DE LAS DOS LECTURAS DE SESION, PURAS.
 *
 * **Este archivo no tiene un solo `import`, y eso es deliberado** (misma forma y mismo motivo
 * que `server/business-status.ts`, spec 0072 §D4). La tentacion es definir la forma dentro de
 * `auth-guards.ts`, que es donde vive el resolvedor gemelo; pero ese modulo importa
 * `next/navigation` y llama a `redirect()`, asi que cualquier consumidor de la forma se
 * arrastraria el runtime de ruteo. `auth-guards.ts` **no se modifica**: las rutas componen su
 * propia consulta con el MISMO `orderBy(asc(business.created_at))`.
 *
 * Las dos vistas viven juntas porque las dos derivan de la MISMA fila —el join
 * `memberships × businesses` de la sesion— y porque las dos comparten la regla de membresia
 * de §D1. Separarlas en dos hojas duplicaria esa regla, que es justo lo que §D0 prohibe.
 *
 * **Ninguna de las dos serializa una clave interna** (`CLAUDE.md`): `stampImageObjectKey` entra
 * a `toOnboardingView` y sale convertido en el booleano `stampImage`; `logoObjectKey`,
 * `stripeCustomerId` y `stripeSubscriptionId` no entran ni como parametro.
 */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  /** Booleano SIEMPRE, nunca `undefined`: la ruta lo normaliza con `=== true`. */
  emailVerified: boolean;
};

export type SessionBusiness = {
  id: string;
  name: string;
  /** Unico GLOBAL (spec 0067 §1): es el login del staff y la URL publica. */
  slug: string;
  /** `active` | `suspended` | `closed`. */
  status: string;
  /** El motivo, **solo para `role='owner'`** — ver {@link toSessionView}. */
  suspensionReason: string | null;
  currencyCode: string;
  timezone: string;
};

export type SessionMembership = { role: string; status: string };

/**
 * **SIEMPRE `200`.** No existe un camino que devuelva 401 ni 403: un endpoint que REPORTA el
 * estado no puede estar gateado por el estado que reporta, o la UI nunca podria renderizar la
 * pantalla de cuenta suspendida (spec 0074 §D1, `0074-contratos-de-api.md` §1).
 */
export type SessionView =
  | { authenticated: false }
  | {
      authenticated: true;
      user: SessionUser;
      business: SessionBusiness | null;
      membership: SessionMembership | null;
    };

/** La fila cruda del join `memberships × businesses`. `businessStatus` y `membershipStatus`
 * se nombran distinto a proposito: son DOS ejes y en la fila del join los dos se llaman
 * `status` (ADR 0055) — asi es como uno termina decidiendo por el otro. */
export type SessionRow = {
  id: string;
  name: string;
  slug: string;
  businessStatus: string;
  suspensionReason: string | null;
  currencyCode: string;
  timezone: string;
  role: string;
  membershipStatus: string;
};

/** El cuerpo del caso «sin sesion», COMPARTIDO por las dos rutas. Es la misma forma que ya
 * tiene `GET /api/auth/get-session` de better-auth (200 con cuerpo vacio), asi que la UI
 * mantiene un solo modelo mental. */
export const NOT_AUTHENTICATED = { authenticated: false } as const;

/**
 * La fila → el cuerpo de `GET /api/merchant/session`.
 *
 * DOS REGLAS, las dos contrato:
 *
 * 1. **Membresia no `active` → `business: null` y `membership: null`, sin revocar nada.**
 *    `requireBackofficeSession` en ese caso BORRA las sesiones del usuario y rebota; esta
 *    ruta no puede hacerlo porque es un `GET`, y un `GET` con efecto lateral se dispara con
 *    un prefetch del navegador. Devolver `null` logra lo que importa —un integrante dado de
 *    baja no lee un solo dato del negocio— sin el efecto lateral. La revocacion sigue
 *    ocurriendo donde ya ocurre: en la primera pagina o API que el caller toque.
 * 2. **`suspensionReason` solo para `role === 'owner'`**, identico a `auth-guards.ts:160-163`:
 *    un integrante no tiene por que leer la nota interna de por que se suspendio la cuenta
 *    del negocio donde trabaja. Es la mutacion M3 del presupuesto.
 */
export function toSessionView(
  user: SessionUser,
  row: SessionRow | null | undefined,
): SessionView {
  if (!row || row.membershipStatus !== "active") {
    return { authenticated: true, user, business: null, membership: null };
  }
  return {
    authenticated: true,
    user,
    business: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.businessStatus,
      suspensionReason: row.role === "owner" ? row.suspensionReason : null,
      currencyCode: row.currencyCode,
      timezone: row.timezone,
    },
    membership: { role: row.role, status: row.membershipStatus },
  };
}

export type OnboardingBusiness = { id: string; name: string; slug: string };
export type OnboardingProgram = { id: string; kind: string };

/**
 * **HECHOS, nunca un numero de paso** (spec 0074 §D3). El ADR 0070 prohibe la columna
 * `onboarding_step` y un `"step": 2` en el JSON es esa columna disfrazada: el dia que el
 * wizard tenga 4 pantallas, el numero miente. El paso lo deriva la UI.
 */
export type OnboardingView =
  | { authenticated: false }
  | {
      authenticated: true;
      business: OnboardingBusiness | null;
      program: OnboardingProgram | null;
      stampImage: boolean;
    };

/** La fila del programa que la ruta lee. `stampImageObjectKey` es una clave interna de R2 y
 * **entra aca para no salir**: lo unico que cruza es el booleano. */
export type OnboardingProgramRow = {
  id: string;
  kind: string;
  stampImageObjectKey: string | null;
};

/**
 * Las dos filas → el cuerpo de `GET /api/onboarding/state`.
 *
 * `business` llega ya filtrado por la ruta con la MISMA regla de membresia de
 * {@link toSessionView}: una membresia no `active` se ve igual que no tener negocio. Sin esa
 * consistencia, un integrante dado de baja leeria el nombre y el `slug` del negocio por esta
 * puerta y no por la otra.
 */
export function toOnboardingView(
  business: OnboardingBusiness | null | undefined,
  program: OnboardingProgramRow | null | undefined,
): OnboardingView {
  return {
    authenticated: true,
    business: business
      ? { id: business.id, name: business.name, slug: business.slug }
      : null,
    program: program ? { id: program.id, kind: program.kind } : null,
    stampImage: program ? program.stampImageObjectKey !== null : false,
  };
}
