# Encargo para GPT — 2026-10-06

Lo que GPT tiene que cerrar, juntado por Claude a pedido del owner. Cada punto dice qué, dónde y en qué orden. Todo
está medido contra la rama `sin-gate-email` (`134f77d`) el 2026-10-06; si `main` cambió, re-medilo antes de empezar.
Tus specs se numeran desde **0170** (Claude usa 0165–0169).

## 0. Lo que tenés que saber antes (no es trabajo)

- **0163 (tu spec) está `implementada`**, con PASS del revisor independiente (`f124e2d`). El revisor encontró que el e2e
  `tests/e2e/merchant-entry.spec.ts` solo cubre el caso sin cookie; la rama con sesión ahora la cubre
  `apps/merchant/src/app/page.neon.integration.test.ts`. No hace falta que hagas nada.
- **Claude está implementando la spec 0166** (`docs/specs/0166-raiz-del-merchant-lleva-al-panel-con-sesion.md`), que
  cambia `apps/merchant/src/app/page.tsx`. Con la 0166 en `main`, la raíz `/` hace esto:
  - sin `?e=` y sin sesión (o sesión vencida) → `/es/business/onboarding`;
  - sin `?e=` y con sesión válida → `/backoffice`;
  - **con `?e=<codigo>` → nunca redirige**, con o sin sesión: renderiza lo que haya en `page.tsx`. Esto es lo que
    evita un ciclo `/` ↔ `/backoffice`. **No lo cambies.**
- **No toques `page.tsx` hasta que la 0166 esté en `origin/main`.** El punto 1 se apoya en ella.

## 1. Pantalla del motivo de `?e=` en la raíz del merchant (decisión del owner, 2026-10-06)

**Problema.** Cuando el guard de `/backoffice` o el link mágico rebotan a `/?e=<codigo>`, la raíz hoy muestra una
portada estática («Fidelización simple para tu negocio») sin el motivo y sin salida. Antes de la 0166, ese rebote sin
sesión terminaba en el alta de dueño: un empleado desactivado veía «crear tu negocio».

**Qué pidió el owner:** que con `?e=` la raíz muestre el motivo y un solo botón de salida. Un empleado desactivado no
tiene que ver el alta.

**Contrato (servidor, lo fija la 0166, no cambia):** `page.tsx` es un Server Component que recibe `searchParams`
(Next 16, `Promise`). Con `e` presente renderiza; vos decidís qué. Los códigos que pueden llegar:

| Código | Quién lo emite | ¿Llega con sesión viva? |
|---|---|---|
| `staff_disabled` | `server/auth-guards.ts:152` (revoca antes) | no |
| `business_closed` | `auth-guards.ts:166`; `api/merchant/auth/magic-link/route.ts:17` (revoca antes) | sí desde el guard |
| `business_suspended` | `auth-guards.ts:182` (integrante no-owner de un negocio no activo) | sí |
| `magic_link_invalid` | `magic-link/route.ts:12` | puede (sesión vieja) |
| cualquier otro valor | URL escrita a mano | — |

La tabla de códigos está en `docs/specs/0067-contratos-de-api.md` §«Códigos de rebote» (línea 472). Trae un texto
sugerido por código (p.ej. `magic_link_invalid` → «Ese enlace ya no sirve. Pedí uno nuevo.»); partí de ahí.
`apps/merchant/src/ui/api-error.tsx` ya tiene título y texto para `business_suspended` y `business_closed`. Un código
desconocido necesita un texto genérico.

**Antes de escribir la spec, pedile al owner** qué botón lleva cada código. Esto no está decidido; es una propuesta:
`staff_disabled` → «Hablá con el dueño del negocio», sin botón al alta; `business_closed` → contacto;
`business_suspended` → «Hablá con el dueño»; `magic_link_invalid` → «Pedir un link nuevo» (ingreso).

**Disjunta:** no con la 0166 (mismo `page.tsx`): va después.

## 2. Fechas de marketing al `DateTimeField` del kit (PARQUEADO #79)

Hay 8 `TextField type="datetime-local"` en marketing, dos por archivo:
`app/backoffice/marketing/{custom-fields,cross-fields,template-fields,welcome-fields}.tsx`. Además,
`app/backoffice/loyalty/closing-date-field.tsx:29` es un `<input type="datetime-local">` nativo. Todos pasan a
`ui/date-time-field.tsx` (spec 0161), que acepta y devuelve `"YYYY-MM-DDTHH:mm"`, el mismo formato que el `input`.
Va dentro de la Fase 1 de UI. **Cuando esté en `main`, avisale a Claude**: después de eso Claude restringe el `type`
de `TextField` (`ui/text-field.tsx`), y eso rompe el typecheck si queda alguno.

## 3. Estado de la 0157 en `docs/INDEX.md`

El owner (2026-10-06): «la 0157 ya está cerrada, GPT ya hizo los ajustes». En `INDEX.md` la fila sigue en `cerrada`,
con el gate bloqueado. Actualizá la fila y el frontmatter de la spec al estado real, con el sha donde quedó.

## 4. Lo que ya tenés en curso

La Fase 1 de UI (ADR 0123): commits locales sobre `main` sin pushear hasta el final, como quedó acordado. El punto 2 va
adentro.

## Lo que NO es tuyo (para que no lo busques)

- Los flakes #74, #75 y #78 (Claude).
- `docs/design-system.md` §Form, «Pendiente» sobre `validationErrors`: lo resolvió la 0162; Claude corrige el texto.
