---
spec: 0039
fecha: 2026-08-16
estado: implementada
resumen: La landing pública de enrolamiento (`/enroll/[programId]`) y su pantalla de confirmación muestran el branding del negocio — logo (servido por la ruta pública que ya existe, sin exponer la clave R2) y color de marca en los botones de acción (form + "Activar notificaciones" + acento del instructivo iOS), con color de texto elegido por luminancia para contraste legible. Sin logo → fallback al nombre del negocio (como hoy). No re-diseña `/wallet` (arco separado, spec 0031). Sin migración ni secreto nuevo.
disjunta: si
archivos: apps/merchant/src/server/consumer/enrollment.ts, apps/merchant/src/lib/brand-color.ts, apps/merchant/src/lib/brand-color.test.ts, apps/merchant/src/app/(consumer)/enroll/[programId]/page.tsx, apps/merchant/src/app/(consumer)/enroll/[programId]/enroll-form.tsx, apps/merchant/src/app/(consumer)/ios-install-hint.tsx, apps/merchant/src/app/(consumer)/push-prompt.tsx, apps/merchant/src/server/consumer-enrollment-landing.neon.integration.test.ts (nuevo, split por hook file-size)
---

# 0039 — Branding de la landing de enrolamiento

> Completa la superficie pública de la spec **0028** (enrolamiento) con el branding del negocio
> (spec **0025**: colores + logo en R2). El `/wallet` rico (dashboard multi-programa con tarjetas
> por diseño) es la spec **0031** y queda **fuera** de acá.

## Problema

La landing pública `/enroll/[programId]` —a la que cae el cliente al escanear el QR del comercio—
y su pantalla de confirmación post-registro muestran **solo el nombre del negocio en texto plano**.
No hay logo ni color de marca. El negocio ya tiene branding cargado (spec 0025: 3 colores + logo en
R2), pero la landing no lo consume, así que la primera impresión del consumidor es genérica.

## Alcance

**Entra:**
- El **logo del negocio** en el encabezado de la landing (form **y** confirmación), servido por la
  ruta pública existente `GET /api/public/brands/{businessId}/logo?v={logoVersion}` (no expone la
  clave R2). Fallback al nombre del negocio cuando no hay logo.
- El **color de marca** (`brandPrimaryColor`) en los botones de acción: "Sumarme al programa"
  (form), "Activar notificaciones" (`PushPrompt`, Android) y el acento del instructivo iOS
  (`IosInstallHint`), con **color de texto elegido por luminancia** (contraste legible).
- `getEnrollLanding` extendido para devolver el branding necesario.
- Helper puro nuevo `readableTextColor(hex)` (luminancia WCAG) + su test.

**No entra:**
- El re-diseño de `/wallet` (dashboard rico multi-programa con tarjetas por branding) — es la spec
  **0031**. `/wallet` sigue **neutro**: renderiza `PushPrompt`/`IosInstallHint` **sin** pasar
  `accentColor`.
- Los botones oficiales de **Apple/Google Wallet** (`WalletButtons`): mantienen su estilo de
  plataforma, no se brandean.
- Cualquier migración o cambio de esquema (colores/logo ya existen en `business`).
- Cambios en el flujo de registro, la sesión, o el ruteo de notificaciones (spec 0038).

## Diseño

### Especificación técnica

**1. `getEnrollLanding` (`server/consumer/enrollment.ts`).** El type `EnrollLanding` y su query
suman los campos de marca del negocio:

```ts
export type EnrollLanding = {
  programId: string;
  businessId: string;                 // para construir la URL pública del logo
  businessName: string;
  countryCode: string | null;
  brandPrimaryColor: string;          // '#RRGGBB'
  brandComplementaryColor: string;
  brandAccentColor: string;
  logoVersion: number;
  hasLogo: boolean;                   // logoObjectKey != null (NUNCA se devuelve la clave)
};
```

**Anti-fuga (CLAUDE.md):** el DTO devuelve `businessId` + `logoVersion` (públicos, ya usados por la
ruta pública del logo) y `hasLogo`, **nunca** `logoObjectKey`. La URL del logo se arma en el
cliente/servidor como `/api/public/brands/{businessId}/logo?v={logoVersion}`.

**2. Helper de contraste (`lib/brand-color.ts`, nuevo).**

```ts
/** Elige el color de texto legible ('#111' o '#fff') sobre un fondo `#RRGGBB`, por
 * relación de contraste WCAG (compara el ratio contra blanco y contra negro, gana el mayor). */
export function readableTextColor(hexBackground: string): "#111111" | "#ffffff";
```

Función **pura**, sin dependencias (no hay React Aria en el repo; el proyecto no trae librería de
accesibilidad, así que el contraste se resuelve acá y con HTML semántico). Parsea `#RRGGBB`,
calcula la luminancia relativa (sRGB → lineal, `0.2126R+0.7152G+0.0722B`) y devuelve el color de
texto con mayor contraste. Entrada inválida → default seguro `'#ffffff'` sobre fondos oscuros por
convención (documentar el caso).

**3. `page.tsx` (`enroll/[programId]`).** Pasa el branding a `EnrollForm`. Renderiza el **logo**
(si `hasLogo`) en el encabezado —arriba del nombre— vía `<img>` con `alt={businessName}` y
`src="/api/public/brands/{businessId}/logo?v={logoVersion}"`; si no hay logo, mantiene el
`<h1>{businessName}</h1>` actual. El encabezado es común a todas las pantallas de `EnrollForm`
(form/done/already_member/unavailable), así que el logo brandea también la confirmación.

**4. `enroll-form.tsx`.** `EnrollForm` recibe las props de marca
(`brandPrimaryColor`, `vapidPublicKey` ya existe de la 0038):
- Botón **"Sumarme al programa"**: `background: brandPrimaryColor`, `color:
  readableTextColor(brandPrimaryColor)`. El estado `submitting` conserva un atenuado (p.ej. opacidad
  reducida) en vez del azul fijo actual.
- En `screen: done`, pasa `accentColor={brandPrimaryColor}` a `PushPrompt`/`IosInstallHint`.

**5. `push-prompt.tsx` y `ios-install-hint.tsx`.** Suman un prop **opcional** `accentColor?:
string`:
- Presente → el botón/acento usa `background: accentColor`, `color:
  readableTextColor(accentColor)`.
- Ausente (default, p.ej. cuando los renderiza `/wallet`) → conservan los colores neutros actuales.
  Esto mantiene `/wallet` sin cambios visuales y evita brandear una superficie multi-negocio con el
  color de un solo negocio.

**Accesibilidad:** HTML semántico (`<button>`, `<img alt>`), contraste por `readableTextColor`. No
se introducen dependencias; no hay React Aria disponible.

### Arquitectura de referencia

- Spec **0025** / ADR **0019** — branding real del negocio (colores + logo en R2) que esta spec
  consume.
- Spec **0028** — la landing de enrolamiento que esta spec completa.
- Spec **0038** — el `vapidPublicKey` y `PushPrompt` en la confirmación (ya presentes).
- Patrón anti-fuga R2 del CLAUDE.md (`*ObjectKey` nunca al cliente; `*Path`/ruta pública sí).

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/consumer/enrollment.ts` | editar — `EnrollLanding` + query con branding (sin `logoObjectKey`) |
| `apps/merchant/src/lib/brand-color.ts` | crear — `readableTextColor(hex)` puro |
| `apps/merchant/src/lib/brand-color.test.ts` | crear — unit del helper |
| `apps/merchant/src/app/(consumer)/enroll/[programId]/page.tsx` | editar — logo en el header + pasa branding a `EnrollForm` |
| `apps/merchant/src/app/(consumer)/enroll/[programId]/enroll-form.tsx` | editar — botón form branded + `accentColor` a los hijos |
| `apps/merchant/src/app/(consumer)/ios-install-hint.tsx` | editar — prop opcional `accentColor` |
| `apps/merchant/src/app/(consumer)/push-prompt.tsx` | editar — prop opcional `accentColor` |
| `apps/merchant/src/server/consumer-enrollment-landing.neon.integration.test.ts (nuevo, split por hook file-size)` | editar — `getEnrollLanding` devuelve branding con/sin logo, sin `logoObjectKey` |

### Disjunta?

**Sí.** No hay otra spec abierta que toque estos archivos (la 0038 quedó implementada). `PushPrompt`/
`IosInstallHint` se extienden con un prop opcional retrocompatible (el `/wallet` de la 0031, si
llega, no colisiona: usa el default).

### Archivos compartidos

Ninguno que deba dejar listo el orquestador: colores/logo (`business`), ruta pública del logo,
`vapidFromEnv`, `PushPrompt`, `IosInstallHint` ya existen.

## Definition of Done

- [ ] La landing de un negocio **con logo** muestra el logo en el header del form y de la
      confirmación; **sin logo** muestra el nombre (como hoy), sin `<img>` roto.
- [ ] El botón "Sumarme al programa" usa el color primario de la marca con texto legible
      (contraste correcto por `readableTextColor`).
- [ ] En la confirmación, "Activar notificaciones" (Android) y el acento del instructivo iOS usan
      el color de marca; en `/wallet` esos mismos componentes siguen neutros.
- [ ] `getEnrollLanding` devuelve el branding y **NUNCA** `logoObjectKey` (verificado por test).
- [ ] `readableTextColor` devuelve el color de mayor contraste para colores claros y oscuros.
- [ ] `pnpm run typecheck` (3/3), `pnpm run lint`, `pnpm run test`, `pnpm run build` (3/3) verdes.

## Plan de pruebas y verificación

- [ ] **Unit** (`brand-color.test.ts`): `readableTextColor('#176548')` → blanco; `('#E78132')` →
      el de mayor contraste (afirmar el ratio, no adivinar); `('#ffffff')` → negro; `('#000000')` →
      blanco; entrada inválida → default documentado.
- [ ] **Integración (Neon)** (`consumer-enrollment.neon.integration.test.ts`): sembrar un negocio
      con logo (`logoObjectKey` + `logoVersion`) y otro sin logo; `getEnrollLanding` devuelve
      `hasLogo` correcto, los 3 colores y `businessId`/`logoVersion`; el objeto **no** contiene
      `logoObjectKey` (aserción explícita `expect(landing).not.toHaveProperty('logoObjectKey')`).
- [ ] **Regresión:** la suite de enrolamiento (0028) y el resto siguen verdes.
- [ ] **Comandos:** `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build`;
      integración Neon en rama efímera.
- [ ] **Verificación manual (owner):** abrir `/enroll/<programId>` de un negocio con logo y color de
      marca no-default → ver el logo y el botón en color de marca con texto legible; registrarse →
      la confirmación mantiene el branding; probar un negocio sin logo → cae al nombre sin romperse.

## Handoff requerido

Implementador + revisor independiente (`docs/AGENT-WORKFLOW.md`). Foco del revisor: que
`getEnrollLanding` no filtre `logoObjectKey` (anti-fuga), que el contraste del texto sea correcto
(no texto ilegible sobre un color claro), que `/wallet` quede **neutro** (los componentes
compartidos no se brandean sin `accentColor`), y el fallback sin logo. Rama Neon efímera para la
integración.

## Abierto

Nada bloqueante.
