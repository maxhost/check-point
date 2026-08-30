---
spec: 0043
fecha: 2026-08-30
estado: implementada
resumen: Login de staff con acceso limitado al mostrador — el owner da de alta/desactiva personal (nombre/email/contraseña, rol staff); el staff logueado ve sólo una consola con el historial de acreditaciones del día y un botón para escanear/acreditar (reusa el mostrador 0030). Sin canje de cupones.
disjunta: si
archivos: schema/business (status en membership), server/staff, rutas api/staff, backoffice/staff (owner), backoffice/counter (consola con historial + escanear), guard de sesión compartido
---

# 0043 — Login de staff y consola de mostrador

> **Nada de codigo empieza sin esta spec en `cerrada`.**

Implementa la tajada acordada del borrador **0005** (consola de personal + compra acreditada):
sólo **login de staff** y **operar el mostrador**. El canje de cupones/premios queda para más
adelante (borrador 0006), fuera de alcance.

## Problema

El mostrador (escanear QR → acreditar puntos/sellos, spec 0030) ya existe y funciona, pero hoy
**sólo lo puede usar el owner**: no hay identidad de personal. El `role` de `business_membership`
es texto libre siempre `"owner"`, la única UI de "staff" es un mock sin backend
(`app/backoffice/demo/staff`), y las páginas del backoffice no distinguen rol de forma consistente.
El owner necesita que su personal acredite en el mostrador **sin** ver marca, programa, catálogo,
analíticas ni la gestión de personal.

## Alcance

**Entra:**
- **Gestión de personal (owner):** pantalla real que **reemplaza el mock** `demo/staff`. Listar
  personal, dar de alta (nombre, email, contraseña), **desactivar/reactivar**.
- **Identidad de staff:** rol `staff` en `business_membership` (con CHECK), estado
  `active|disabled`, provisión vía better-auth (ADR 0044).
- **Login de staff:** el staff usa el `/login` existente; al entrar aterriza **directo** en la
  consola de mostrador.
- **Consola de mostrador (owner + staff):** la ruta del mostrador pasa a mostrar el **historial
  de acreditaciones del día** del negocio (hora, cliente, programa, +puntos/+sellos, operador) +
  botón **Escanear** que lanza el flujo actual de escaneo/resolución/acreditación (sin cambios en
  ese flujo). Al terminar una acreditación vuelve al historial, ya actualizado.
- **Gating por rol:** staff sólo ve la consola; toda página owner-only redirige al staff a la
  consola; un staff `disabled` no puede operar (se lo desloguea).

**No entra (explícito):**
- **Canje de cupones/premios** (borrador 0006). El mostrador sólo acredita puntos/sellos.
- **Roles de plataforma** (`platform_admin`) y su backoffice (borrador 0001/0008).
- **Atar el staff a un local** (auto-atribución por operador). El mostrador ya permite elegir/omitir
  local; se hará después.
- **Invitación por email / recuperación de contraseña del staff / SSO.** Alta directa por el owner;
  la recuperación de owner/staff no es parte de esta spec.
- **Permisos granulares** más allá de owner/staff (el mock tenía checkboxes; se descartan en el MVP).
- **Historial más allá del día** (paginado, export, filtros por operador). Sólo el día en curso.

## Diseño

### Arquitectura y límites

- Roles de negocio y su gating: **ADR 0044**. `owner` = backoffice completo; `staff` = sólo consola
  de mostrador.
- Se reusa **sin cambios**: el flujo de escaneo/acreditación (`counter/qr-scanner.tsx`,
  `counter-console.tsx`, `server/counter/{resolve,grant,orders}.ts`, `api/counter/*`), que ya acepta
  cualquier membership del negocio (`operatorBusiness` no filtra rol) y ya registra
  `order.operator_user_id` + `order.location_id`.
- La provisión de usuarios usa **better-auth** (esquema `merchant_auth`, spec 0022) — nunca insert
  crudo de contraseñas.

### Modelo de datos

`business_membership` (`schema/business.ts`) — **aditivo**:
- `role text not null default 'owner'` → agregar **CHECK** `role in ('owner','staff')`.
- Nueva columna `status text not null default 'active'` con **CHECK** `status in ('active','disabled')`.

No hay tabla nueva. La identidad del staff es su `user`/`account` de better-auth + la membership
`role='staff'` en el negocio del owner. La auditoría de quién acreditó ya existe
(`order.operator_user_id`, `order.created_at`, `order.location_id`).

Invariantes:
- Un negocio tiene **exactamente un** `owner` (el que lo creó en onboarding). El alta de staff nunca
  crea otro owner.
- Un email = un `user` (unicidad de better-auth). Staff pertenece a **un** negocio (MVP).
- Desactivar **no borra** al user ni sus `order` históricos.

### Autorización y aislamiento

Guard de sesión **compartido** (hoy cada página inlínea `getSession` — se centraliza):
- `requireBackofficeSession()` → `{ session, business, membership }` (rol + estado); si no hay
  sesión → `/login`; si el user no tiene membership activa en ningún negocio → `/login` (deslogueado)
  o `/onboarding` sólo si además no existe negocio (caso owner nuevo).
- `requireOwner()` → usa el anterior; si `membership.role !== 'owner'` → **redirect a
  `/backoffice/counter`** (no a onboarding). Lo usan marca, programa, catálogo, analytics, personal y
  el home `/backoffice`.
- La consola `/backoffice/counter` acepta `role in ('owner','staff')` con `status='active'`.
- `status='disabled'`: cualquier guard lo trata como sin acceso → se revocan sus sesiones al
  desactivar (borrado de filas en `merchant_auth.session` del user) y el próximo request cae a
  `/login`.
- Las rutas `api/staff/*` exigen `role='owner'` del negocio de la sesión (aislamiento: el owner sólo
  gestiona staff **de su** negocio; validar que la membership objetivo pertenece al mismo
  `businessId`, análogo a `assertLocationInBusiness`).
- `api/counter/*` sigue con `requireOperator` (owner o staff activos).

### Rutas, API y errores

Owner (rol owner):
- `GET /backoffice/staff` (server component) — lista de personal del negocio: nombre, email, rol,
  estado, alta. Formulario de alta + acciones activar/desactivar. Reemplaza el link del home
  (`backoffice/page.tsx`) de `/backoffice/demo/staff` a `/backoffice/staff`.
- `POST /api/staff` — body `{ firstName?/name, email, password }`. Crea el user better-auth
  (`getMerchantAuth().api.signUpEmail`, **descartando la cookie devuelta**) + membership
  `role='staff', status='active'` en el negocio del owner. Respuesta: DTO del staff **sin** hash ni
  token. Errores: `400` body inválido / contraseña < 8; `409` email ya en uso; `401/403` sin sesión
  owner.
- `POST /api/staff/:userId/status` — body `{ status: 'active'|'disabled' }`. Cambia estado; al
  desactivar, revoca sesiones del staff. `404` si el user no es staff del negocio; `409` si se intenta
  desactivar al owner. `403` si el llamante no es owner.

Staff + owner:
- `GET /backoffice/counter` — consola: historial del día + botón Escanear. Server component que carga
  el historial y `business`+`locations` (como hoy). El flujo de escaneo/acreditación se abre desde el
  botón y usa las rutas `api/counter/*` intactas.
- Query nuevo `listTodaysAccreditations(businessId, now)` (`server/counter` o `server/staff`): los
  `order` del negocio con `created_at` dentro del **día en la zona horaria del negocio** (la misma
  fuente que usa la ventana de cierre de loyalty), orden descendente, con operador
  (join a `user.name`/email), cliente (displayName del consumidor), programa y unidades acreditadas
  (+puntos o +sellos). DTO sin `qr_token`, sin hash, sin token.

### Estados de interfaz / móvil

- **Consola de mostrador** (mobile-first, es una pantalla de teléfono en el local):
  - Encabezado con nombre del operador y botón de salir.
  - Botón grande **"Escanear"** → abre el escáner (cámara, ya existe; requiere HTTPS).
  - **Historial del día**: filas hora · cliente · programa · +N puntos / +N sellos · operador. Vacío:
    estado "Todavía no hay acreditaciones hoy".
  - Al completar una acreditación, vuelve a la consola con la fila nueva arriba.
- **Gestión de personal** (owner): tabla simple + formulario de alta (nombre, email, contraseña con
  mínimo 8) + toggle activar/desactivar con confirmación. Errores como toast.
- **Login**: sin cambios de UI; el destino post-login depende del rol (owner → `/backoffice`, que
  redirige; staff → `/backoffice/counter`). El home `/backoffice` redirige staff a la consola.

### Efectos, idempotencia, concurrencia, auditoría

- La acreditación ya es atómica/idempotente por `(business_id, client_request_id)` (0030) — no cambia.
- Alta de staff: crear user + membership. Si `signUpEmail` crea el user pero falla la membership,
  no debe quedar un user huérfano sin negocio → envolver en control de error (o crear la membership
  y, ante fallo, no dejar acceso: un user sin membership activa no puede entrar). El email duplicado
  lo rechaza better-auth (409).
- Auditoría de acreditación: ya cubierta por `order.operator_user_id`; el historial la expone.

### Migraciones y observabilidad

- Migración **aditiva** `00xx`: `ADD COLUMN status` a `business_membership` + CHECK de `status` y de
  `role`. Verificar en rama Neon efímera y aplicar a prod tras el PASS.
- Logs estructurados sin PII sensible en alta/desactivación de staff (evento + businessId + rol;
  nunca contraseña ni token).

### Arquitectura de referencia

- **ADR 0044** (roles de negocio owner/staff). Better-auth / registro de owner: **spec 0022**.
  Mostrador y acreditación atómica: **spec 0030** (auto-enrolamiento ADR 0033). Atribución por local
  (fuera de alcance acá): ADR 0042 / spec 0041.

## Archivos

| Archivo | Acción |
|---|---|
| `src/server/schema/business.ts` | editar — CHECK en `role`, columna `status` + CHECK |
| `apps/merchant/drizzle/00xx_*.sql` (+ snapshot/journal) | crear — migración aditiva |
| `src/server/auth-guards.ts` (o similar) | crear — `requireBackofficeSession`/`requireOwner` compartido |
| `src/server/staff.ts` (+ barrel si aplica) | crear — alta/listar/estado de staff, DTO anti-fuga |
| `src/app/api/staff/route.ts` | crear — `POST` alta |
| `src/app/api/staff/[userId]/status/route.ts` | crear — `POST` activar/desactivar |
| `src/app/backoffice/staff/page.tsx` (+ componentes cliente) | crear — gestión de personal (owner) |
| `src/app/backoffice/counter/page.tsx` | editar — historial del día + botón Escanear |
| `src/app/backoffice/counter/*` (consola) | editar — envolver el flujo de escaneo en la consola |
| `src/server/counter/*` o `src/server/staff.ts` | editar/crear — `listTodaysAccreditations` |
| `src/app/backoffice/page.tsx` | editar — link a `/backoffice/staff` real; redirigir staff a la consola |
| páginas owner-only (`brand`, `loyalty`, `catalog`, `analytics`) | editar — usar `requireOwner` (redirige staff a la consola, no a onboarding) |
| `src/server/staff.test.ts`, `src/server/*.neon.integration.test.ts` | crear — unit + integración |

### Disjunta?

**Sí.** La única spec abierta es **0040** (cropper de imagen, superficies de subida logo/sello/producto)
— no toca auth, roles, counter ni staff. Sin colisión de archivos.

## Definition of Done

- [ ] `business_membership` tiene `status` + CHECK de `role in ('owner','staff')` y de estado;
  migración aditiva verificada en rama Neon y aplicada a prod; `core`/`merchant_auth` intactos.
- [ ] El owner crea staff (nombre, email, contraseña) desde `/backoffice/staff`; se crea un user
  better-auth con contraseña hasheada por better-auth (no insert crudo) + membership `role='staff'`,
  **sin** afectar la sesión del owner. Email duplicado → 409.
- [ ] El owner puede desactivar y reactivar staff; desactivar revoca sus sesiones y le corta el
  acceso; no borra al user ni su historial; no se puede desactivar al owner.
- [ ] Un staff logueado aterriza en `/backoffice/counter` y **no** puede ver marca, programa,
  catálogo, analytics ni gestión de personal (redirigen a la consola, no a onboarding).
- [ ] La consola muestra el historial de acreditaciones **del día** (zona del negocio) con operador,
  cliente, programa y unidades, y el botón Escanear lanza el flujo de acreditación existente; al
  acreditar, la fila aparece en el historial.
- [ ] El staff puede escanear y acreditar puntos/sellos exactamente como el owner (mismo dominio 0030,
  sin regresión); ningún canje de cupones.
- [ ] Ningún DTO/log/cookie legible filtra hash de contraseña, token de sesión ni `qr_token`.
- [ ] Aislamiento: un owner sólo lista/gestiona staff de **su** negocio; `api/staff/*` rechaza cross-negocio.
- [x] Revisor independiente emite PASS según `docs/AGENT-WORKFLOW.md` antes de `implementada`.

> **Implementada 2026-08-30 (orquestador, tras PASS del revisor independiente).** Flujo
> `AGENT-WORKFLOW.md`: implementador → revisor independiente **FAIL** (1 bloqueante: la subpágina
> `backoffice/brand/kit/page.tsx` había quedado con el guard viejo sin chequeo de rol → un staff
> podía verla por URL) → el orquestador la migró a `requireOwner` y verificó por barrido que **ninguna**
> página de backoffice usa ya `getSession` inline → **PASS efectivo**. Además se resolvió el menor del
> revisor (alta de staff: si falla el insert de membership, se borra el user better-auth recién creado
> para no "quemar" el email). Guard compartido `server/auth-guards.ts` (`requireBackofficeSession`/
> `requireOwner`); alta vía `signUpEmail` sin propagar la cookie del owner; desactivar = `status='disabled'`
> + revocar sesiones (no borra al user, preserva auditoría); consola `backoffice/counter` = historial del
> día del negocio (`listTodaysAccreditations`) + botón Escanear (reusa 0030 intacto). **Gates:** typecheck
> 3/3, lint, unit **213**, build 3/3, **integración Neon 5/5** en rama efímera `spec-0043-staff`
> (`br-quiet-mouse-axp5nlrh`). **Migración `0026_cynical_mister_fear` aplicada y verificada por SQL en
> PROD** (26→27; `business_membership` gana `status` + CHECK de rol/estado; memberships existentes →
> `active`; `core`(22)/`merchant_auth`(4)/`consumer`(10) intactos). **Residuales (menores, no bloquean):**
> el historial muestra las acreditaciones del negocio (todos los operadores) — si el owner prefiere
> "solo las mías" es un filtro por `operator_user_id`; y las páginas mock `demo/*` siguen sin guard de
> rol (se gatearán cuando pasen a reales). QA en vivo del owner pendiente.

## Plan de pruebas y verificación

- [ ] Unit: guard de rol (owner vs staff vs disabled → destino correcto); DTO de staff sin secretos;
  validación de alta (email, contraseña ≥ 8).
- [ ] Integración Neon: alta de staff crea user+membership `staff/active` sin tocar la sesión del
  owner; email duplicado → 409; desactivar revoca sesiones y bloquea; reactivar restaura; no se puede
  desactivar al owner; aislamiento cross-negocio (403/404).
- [ ] Integración Neon: staff acredita puntos y sellos (reusa 0030, sin regresión); `listTodaysAccreditations`
  devuelve sólo el día del negocio, con operador/cliente/unidades, aislado por negocio.
- [ ] Seguridad: spy de DTO/log sin contraseña/hash/token/`qr_token`; staff no alcanza páginas owner-only.
- [ ] Regresión: mostrador del owner (0030), onboarding del owner (0022), marca/programa/catálogo verdes.
- [ ] Comandos: Node 24; `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, integración en rama efímera.
- [ ] Manual: owner da de alta un staff, el staff entra en otro dispositivo, ve sólo la consola,
  escanea y acredita; el owner lo desactiva y el staff pierde acceso.

## Handoff requerido

Implementador y revisor usan `docs/AGENT-WORKFLOW.md`. El implementador no cambia el modelo de roles
(ADR 0044), no agrega canje, no ata staff a local, ni toca el dominio de acreditación 0030. El revisor
exige evidencia de gating por rol, aislamiento por negocio, anti-fuga y no-regresión del mostrador,
además de los gates. Sólo el orquestador aplica la migración a producción y marca `implementada` tras
el PASS.

## Abierto

- **Alcance del historial del día:** por defecto muestra las acreditaciones del **negocio** (todos los
  operadores) con el nombre del operador. Si el owner prefiere que cada staff vea **sólo las suyas**,
  es un filtro por `operator_user_id` — decisión menor, se confirma en QA.
- Provisión con `signUpEmail`: confirmar en implementación que no dispara verificación de email ni
  pisa la cookie del owner (si hiciera falta, usar el plugin admin de better-auth `createUser`).
