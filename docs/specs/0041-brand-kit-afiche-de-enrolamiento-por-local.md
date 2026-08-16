---
spec: 0041
fecha: 2026-08-16
estado: cerrada
resumen: Brand kit — generador (wizard) en el backoffice de "Marca" del afiche imprimible con el QR de enrolamiento. Wizard de 3 pasos (elegir plantilla → chequear logo/colores → preview editable) con 5 plantillas curadas por rubro (bar/alojamiento/retail/…), pintadas con logo + colores de marca, QR generado server-side (lib `qrcode` ya presente, SVG, sin dep nueva) con un par de estilos básicos (negro / teñido de marca / con logo al centro a EC nivel H). Salida = vista HTML/SVG con CSS de impresión A4 y A5 (imprimir → "Guardar como PDF" del navegador, sin dep nueva). Alcance del QR: Global, o por local si el negocio tiene 2+ locales (oculto con 1 local). El QR por local codifica `/enroll/<programId>?loc=<locationId>` y el alta lo persiste en `program_membership.origin_location_id` (nueva columna nullable) — atribución de la primera pieza del ADR 0042. NO incluye el tablero de estadísticas por local ni el evento de canje.
disjunta: no
archivos: ver sección Archivos
---

# 0041 — Brand kit: afiche de enrolamiento por local

> **Nada de codigo empieza sin esta spec en `cerrada`.** Cerrada con el owner el
> 2026-08-16 (todas las decisiones de producto resueltas; ver "Decidido con el owner").

## Problema

El QR de "sumate al programa" no tiene hoy **ninguna superficie que lo genere**. La ruta de
enrolamiento `/enroll/<programId>` existe y está brandeada (spec 0028/0039), pero no hay
dónde, en el backoffice, producir el afiche imprimible con ese QR que el comercio pega en su
local. El owner tampoco puede controlar su diseño (plantilla, colores, textos) ni imprimirlo.

Además, **el enrolamiento no se puede atribuir a un local**: la URL no lleva el local y
`program_membership` no lo guarda (solo la venta lo tiene, en `order.location_id`). Sin eso,
"un QR por local para separar estadísticas de alta" es imposible — es la primera pieza del
ADR 0042.

## Alcance

**Entra:**

- **Nueva sub-sección en el backoffice de "Marca"**: `/backoffice/brand/kit`, alcanzable
  desde un enlace/botón en la página de marca ("Generar afiche de enrolamiento"). Autorizada
  igual que el resto del backoffice del owner (sesión de owner → su negocio).
- **Wizard de 3 pasos:**
  1. **Elegir plantilla** — 5 plantillas curadas y bien diferenciadas por rubro (ej.
     bar/gastronomía, alojamiento, retail, servicios, minimalista genérica). Cada plantilla
     es un layout que consume `{logo, brandPrimaryColor, brandComplementaryColor,
     brandAccentColor, businessName, qrSvg, headline, subheadline}`. Si el negocio tiene
     **2+ locales**, en este paso también elige el **alcance del QR**: **Global** (un afiche,
     QR sin `loc`) o **por local** (un afiche por cada local, cada uno con su `loc`); con
     **1 local** la opción no se muestra (el afiche apunta a ese negocio sin `loc`).
  2. **Chequear logo y colores** — muestra el logo y los 3 colores traídos de la marca
     (`GET /api/brand`, DTO `brandResponse`, `logoPath` público, sin exponer la clave R2).
     Read-only con un enlace "Editar marca" a `/backoffice/brand`; **no** duplica el editor
     de marca. Si **no hay logo** o **no hay programa operativo**, el wizard bloquea con un
     estado guía (ver Estados).
  3. **Preview editable + imprimir** — render en vivo del afiche de la plantilla elegida,
     con controles para **modificar** (solo para esta impresión, no persiste en la marca):
     - **Colores** del afiche (arranca con los de marca; se pueden ajustar).
     - **Textos**: `headline` y `subheadline` (arrancan con un default según `kind` del
       programa; editables).
     - **Estilo del QR**: un par de opciones **sin dependencia nueva** — (a) negro clásico,
       (b) teñido con `brandPrimaryColor`, (c) con el **logo del negocio al centro** (el QR
       se genera a **error-correction nivel H** para que el logo no lo rompa).
     - Selector **A4 / A5** (tamaño de impresión).
     - Botón **Imprimir** → `window.print()`; el CSS `@media print` deja **solo el afiche**
       en la página, al tamaño elegido, para "Guardar como PDF" del navegador.
     - Si el alcance es "por local", el preview permite recorrer los locales (cada uno con su
       QR) y ofrece imprimir el actual o todos.
- **Generación del QR server-side**: reusa `renderQrSvg` (lib `qrcode`, SVG, ya presente)
  pasándole la **URL de enrolamiento** (`/enroll/<programId>` o `…?loc=<locationId>`), a
  **EC nivel H** para tolerar el logo central. El server component de `/backoffice/brand/kit`
  pre-renderiza el QR SVG de cada alcance (global + uno por local) y los pasa al wizard
  cliente; el cliente aplica color/logo sobre el SVG (recoloreo de módulos + overlay del
  logo) sin volver al server.
- **Atribución del alta por local (primera pieza del ADR 0042):**
  - Nueva columna **`origin_location_id`** (uuid, **nullable**, FK `location(id)` `ON DELETE
    SET NULL`) en `program_membership`. **Migración aditiva** (drizzle-kit, próxima ~`0024`).
  - La landing `/enroll/[programId]` y el POST `/api/public/enroll/[programId]` aceptan un
    query param **opcional `loc`**. Se valida que el local **pertenezca al negocio del
    programa** (mismo criterio que `assertLocationInBusiness` del counter). `loc` válido → se
    persiste en `origin_location_id` al crear la membresía; `loc` ausente/inválido/ajeno →
    `null` (el alta **nunca** se rompe por eso).
  - Idempotencia: si la membresía ya existe (re-alta), **no** se pisa `origin_location_id`
    (el primer alta manda; misma semántica de "primer alta" del enrolamiento actual).

**No entra:** (explícito — corta el scope creep)

- **El tablero/estadísticas por local** (contar altas/ventas/acumulación por local). Este
  spec solo **habilita** la atribución del alta; el reporte es otra feature (ADR 0042).
- **El evento de canje** y su atribución por local — el canje no existe como transacción
  todavía (spec 0036 solo define premios); nace con `location_id` cuando se construya.
- **Endurecer `order.location_id`** (que el counter siempre exija local): otra tarea; acá
  sigue nullable.
- **Persistir el afiche/QR como entidad** ("mis kits generados"): no hay tabla de kit; el
  afiche se genera on-demand y la atribución vive en `origin_location_id` (ADR 0042).
- **Módulos de QR artísticos** (redondeados, con degradé): pedirían una librería nueva; el
  set de estilos es el dep-free de arriba.
- **Generar el PDF en el server**: sería una dep nueva; se imprime desde el navegador.
- **Gestión de locales** (crear/editar): fuera; el wizard solo **lista** los locales
  existentes del negocio.

## Diseño

### Especificación técnica

**Server — nuevo dominio `apps/merchant/src/server/brand-kit/`**

- `enroll-url.ts` — `enrollUrl(programId, locationId?)`: arma la ruta pública
  `/enroll/<programId>` con `?loc=<locationId>` opcional. Base absoluta desde el mismo helper
  de URL pública que ya usa el resto (la landing/afiche necesita URL absoluta para el QR).
- `qr.ts` — `renderEnrollQr(url): Promise<string>` envolviendo `renderQrSvg` de
  `server/wallet/core.ts` con `errorCorrectionLevel: "H"` (el actual usa "M"; se parametriza
  o se agrega una variante, sin tocar el uso del pase). Devuelve SVG string.
- `data.ts` — `getBrandKitData(businessId)`: junta lo que el wizard necesita en un solo
  round-trip: negocio (`name`, 3 colores, `logoPath` vía `brandResponse`, sin `logoObjectKey`),
  **el programa operativo** (`status in ('active','closing')`, único por el índice; su `id`,
  `kind`, `configuration.unitName`) y la **lista de locales** (`id`, `name`, ordenados —
  mismo query que `counter/page.tsx`). Devuelve además, por alcance, el `qrSvg`
  pre-renderizado. Si no hay programa operativo o no hay logo, marca el estado bloqueante
  correspondiente (el server component decide la UI).

**Cliente — `apps/merchant/src/app/backoffice/brand/kit/`**

- `page.tsx` (server component): resuelve sesión/negocio, llama `getBrandKitData`, y si el
  estado es "listo" pasa los datos a `<BrandKitWizard>`; si está bloqueado, renderiza el
  estado guía (sin wizard).
- `brand-kit-wizard.tsx` (`"use client"`): contenedor de 3 pasos (mismo patrón de wizard que
  `program-editor.tsx` de loyalty). Estado: `step`, `templateId`, `scope` (`"global"` | un
  `locationId`), overrides de `colors`/`headline`/`subheadline`, `qrStyle`, `paper` (`a4`/`a5`).
- `steps/step-template.tsx` — grilla de 5 plantillas (miniaturas). Si 2+ locales, selector de
  alcance (Global / por local).
- `steps/step-brand-check.tsx` — logo + swatches read-only + enlace "Editar marca".
- `steps/step-preview.tsx` — controles (colores, textos, estilo QR, A4/A5) + `<PosterPreview>`
  + botón Imprimir. Recorrido de locales si el alcance es "por local".
- `poster-preview.tsx` — dado `{template, brand+overrides, qrSvg, qrStyle, headline, sub}`
  renderiza el afiche. Despacha por `templateId` a los 5 layouts.
- `templates/` — 5 componentes de layout puros-props (`template-*.tsx`), cada uno un afiche
  a proporción de página; consumen las CSS vars de color y el `qrSvg`. El estilo fino
  (tipografía, disposición) lo resuelve el implementador dentro del lenguaje visual del repo.
- `qr-render.ts` (cliente) — helpers puros: recolorear los módulos del QR SVG con un color y
  componer el overlay del logo al centro (tamaño acotado a lo que EC-H tolera). Testeable sin
  DOM.
- `print.css` (o reglas en `globals.css`): `@media print` → oculta chrome del backoffice,
  deja solo `.poster`, fija `@page { size: A4 }` / `A5` según `paper`, sin márgenes que
  recorten el QR.

**Enrolamiento — atribución (`?loc=`):**

- `apps/merchant/src/app/(consumer)/enroll/[programId]/page.tsx`: lee `searchParams.loc`
  (opcional), lo pasa al form como hidden/estado para que viaje en el POST.
- `apps/merchant/src/app/api/public/enroll/[programId]/route.ts`: acepta `loc` en el body
  (o query); lo valida y lo pasa al server.
- `apps/merchant/src/server/consumer/enrollment.ts`: la función de alta acepta un
  `originLocationId?` opcional; valida contra el negocio del programa (reusa/replica
  `assertLocationInBusiness`); en el INSERT de `program_membership` setea `origin_location_id`
  (o `null`). En re-alta idempotente **no** lo modifica.
- `apps/merchant/src/server/schema/consumer.ts`: agrega la columna `origin_location_id` a
  `program_membership` (FK cross-a `core.location`, `set null`). Índice opcional
  `(origin_location_id)` para el reporte futuro (barato, aditivo).

**Modelo de datos:** una sola columna nueva, nullable, aditiva. Sin cambios a `order`,
`business`, `location` ni `loyalty_program`. El resto de la atribución (ADR 0042) ya existe
(`order.location_id`) o es futuro (canje).

**Autorización y aislamiento:** `/backoffice/brand/kit` es owner-only, scopeado a su negocio
(mismo guard que `/backoffice/brand`). El QR no expone secretos (encodea una URL pública de
enrolamiento). `brandResponse` sigue sin serializar `logoObjectKey`. El `loc` que llega al
enroll se valida contra el negocio del programa: **un `loc` de otro negocio se ignora**, no
puede cross-atribuir.

### Estados de interfaz

- **Sin logo de marca:** el paso 2 bloquea con "Subí el logo de tu negocio para generar el
  afiche" + enlace a `/backoffice/brand`. (El afiche depende del logo.)
- **Sin programa operativo** (`status` ninguno en `active`/`closing`): el wizard bloquea con
  "Creá tu programa de fidelización antes de generar el afiche" + enlace a loyalty. (Sin
  programa el QR no tiene a qué enrolar.)
- **1 local:** sin selector de alcance; afiche único sin `loc`.
- **2+ locales:** selector Global / por local; en preview, recorrido por local + "imprimir
  todos".
- **Móvil:** el wizard es usable en móvil, pero la impresión real se espera desde desktop; el
  preview escala a proporción de página.

### Arquitectura de referencia

- **ADR 0042** — atribución por local como dimensión universal; esta spec implementa su
  **primera pieza** (captura del alta) y su **esquema de URL** (`?loc=`).
- **ADR 0031** — merchant-first; el afiche es la superficie física donde vive el QR.
- **Spec 0028/0039** — landing de enrolamiento y su branding (logo + colores); el afiche
  reusa la misma marca y apunta a esa landing.
- **Spec 0030** — `order.location_id` (la otra fuente de atribución, ya existente).
- **Spec 0025** — marca real y assets R2 (`brandResponse`, logo público).

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/brand-kit/enroll-url.ts` | crear |
| `apps/merchant/src/server/brand-kit/qr.ts` | crear |
| `apps/merchant/src/server/brand-kit/data.ts` | crear |
| `apps/merchant/src/server/brand-kit/data.test.ts` | crear |
| `apps/merchant/src/server/brand-kit/enroll-url.test.ts` | crear |
| `apps/merchant/src/server/wallet/core.ts` | editar (parametrizar EC level en `renderQrSvg` o variante) |
| `apps/merchant/src/app/backoffice/brand/kit/page.tsx` | crear |
| `apps/merchant/src/app/backoffice/brand/kit/brand-kit-wizard.tsx` | crear |
| `apps/merchant/src/app/backoffice/brand/kit/steps/step-template.tsx` | crear |
| `apps/merchant/src/app/backoffice/brand/kit/steps/step-brand-check.tsx` | crear |
| `apps/merchant/src/app/backoffice/brand/kit/steps/step-preview.tsx` | crear |
| `apps/merchant/src/app/backoffice/brand/kit/poster-preview.tsx` | crear |
| `apps/merchant/src/app/backoffice/brand/kit/templates/template-*.tsx` (×5) | crear |
| `apps/merchant/src/app/backoffice/brand/kit/qr-render.ts` | crear |
| `apps/merchant/src/app/backoffice/brand/kit/qr-render.test.ts` | crear |
| `apps/merchant/src/app/backoffice/brand/page.tsx` | editar (enlace "Generar afiche") |
| `apps/merchant/src/app/globals.css` | editar (estilos afiche + `@media print` A4/A5) |
| `apps/merchant/src/app/(consumer)/enroll/[programId]/page.tsx` | editar (`?loc=`) |
| `apps/merchant/src/app/(consumer)/enroll/[programId]/enroll-form.tsx` | editar (propagar `loc`) |
| `apps/merchant/src/app/api/public/enroll/[programId]/route.ts` | editar (aceptar/validar `loc`) |
| `apps/merchant/src/server/consumer/enrollment.ts` | editar (persistir `origin_location_id`) |
| `apps/merchant/src/server/consumer/enrollment.neon.integration.test.ts` | editar (atribución) |
| `apps/merchant/src/server/schema/consumer.ts` | editar (columna `origin_location_id`) |
| `apps/merchant/drizzle/0024_*.sql` | crear (migración, la genera drizzle-kit) |

### Disjunta?

**No.** Puntos de contacto con specs abiertas:

- **Spec 0040 (cropper de imagen, `borrador`):** toca el upload de logo en
  `backoffice/brand/*` (`use-brand-logo.ts` y posiblemente `brand/page.tsx`). Esta spec
  también **edita `brand/page.tsx`** (agrega el enlace al kit). **Único punto de contacto:
  `brand/page.tsx`, aditivo por ambos lados.** Si ambas corren a la vez, **serializar** la
  edición de `brand/page.tsx` (o que el orquestador deje el enlace listo antes). El resto de
  0041 no toca nada de 0040.
- **Spec 0032 (recuperación por OTP, `borrador`):** toca `consumer_account`/auth y
  `wallet/rotate.ts`; **no** toca `program_membership` ni el flujo de enroll. Sin overlap de
  líneas con la columna nueva de 0041.
- **Backlog 0009 (check-in QR por local, `borrador` viejo):** conceptualmente emparentado
  (QR por local) pero es otra superficie (check-in, no enrolamiento) y no está en curso; sin
  archivos compartidos hoy.

### Archivos compartidos

| Qué | Quien lo deja listo | Cuándo |
|---|---|---|
| `renderQrSvg` con EC level parametrizable (`server/wallet/core.ts`) | orquestador | antes de despachar (lo usan `brand-kit/qr.ts` y sigue sirviendo al pase) |
| Enlace "Generar afiche" en `brand/page.tsx` | orquestador (si 0040 activa en paralelo) | antes de despachar, para no colisionar con el cropper |
| `assertLocationInBusiness` (counter) | ya existe | reusar/extraer para el enroll |
| `brandResponse` / `logoPath` público | ya existe | reusar tal cual |

## Definition of Done

- [ ] Desde `/backoffice/brand` hay un acceso a **"Generar afiche de enrolamiento"** que
      abre `/backoffice/brand/kit` (owner-only, scopeado a su negocio).
- [ ] El wizard tiene 3 pasos (plantilla → chequeo de marca → preview) y ofrece **5
      plantillas** visualmente diferenciadas.
- [ ] Con **1 local** no se muestra el selector de alcance; con **2+ locales** se elige
      Global o un local, y el preview permite recorrer los locales.
- [ ] El afiche se pinta con el **logo y los 3 colores de la marca**; en el preview se pueden
      **modificar colores y textos** (headline/subheadline) sin alterar la marca guardada.
- [ ] Hay **≥2 estilos de QR** seleccionables (negro / teñido de marca / logo al centro), sin
      dependencia nueva; el QR con logo al centro **sigue escaneando** (EC nivel H).
- [ ] El botón **Imprimir** deja en la página **solo el afiche**, al tamaño **A4 o A5**
      elegido, apto para "Guardar como PDF" del navegador (verificado con el diálogo de
      impresión).
- [ ] El QR "Global" codifica `/enroll/<programId>`; el QR "por local" codifica
      `/enroll/<programId>?loc=<locationId>` (verificable en el SVG/URL).
- [ ] Un alta hecha desde un QR con `?loc=<localId>` **válido** persiste
      `program_membership.origin_location_id = localId`; sin `loc` o con `loc` inválido/ajeno,
      queda `null` y **el alta se completa igual**.
- [ ] Una re-alta idempotente **no** cambia el `origin_location_id` ya guardado.
- [ ] Estados guía: sin logo → bloquea en el paso de marca; sin programa operativo → bloquea
      el wizard; ambos con enlace a la sección que lo resuelve.
- [ ] Ningún DTO del kit serializa `logoObjectKey` (reusa `brandResponse`).
- [ ] Migración aditiva aplicada y verificada; `core`/`merchant_auth` intactos.
- [ ] Gates: typecheck 3/3, lint, unit, build 3/3.

## Plan de pruebas y verificación

- [ ] Unitaria: `enroll-url.test.ts` — `enrollUrl` con y sin `loc` produce la URL esperada
      (absoluta, param opcional).
- [ ] Unitaria: `qr-render.test.ts` — recoloreo de módulos y overlay de logo sobre un SVG de
      muestra producen SVG válido; el helper no rompe la matriz del QR.
- [ ] Unitaria: `data.test.ts` — el DTO del kit no incluye `logoObjectKey`; incluye
      `logoPath`, colores, `kind` y la lista de locales.
- [ ] Integración (Neon efímera): alta con `loc` válido → `origin_location_id` = ese local;
      alta sin `loc` → `null`; alta con `loc` de **otro negocio** → `null` (no cross-atribuye)
      y el alta igual se crea; re-alta no pisa el valor previo.
- [ ] Integración: aislamiento — el `loc` se valida contra el negocio del programa (un local
      ajeno no se persiste).
- [ ] Regresión: el QR del **pase** del consumidor (`renderQrSvg` con el `qr_token`) sigue
      funcionando tras parametrizar el EC level (no cambia su comportamiento).
- [ ] Comandos: `pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/brand-kit`,
      `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run build`.
- [ ] Manual: en `/backoffice/brand/kit`, recorrer el wizard con un negocio de 2+ locales;
      elegir una plantilla, cambiar un color y el headline, probar los 3 estilos de QR,
      alternar A4/A5, imprimir a PDF y **escanear el QR impreso** para confirmar que abre
      `/enroll/<programId>?loc=<localId>`; completar un alta y verificar por SQL que
      `origin_location_id` quedó en ese local.

## Handoff requerido

El implementador y el revisor usan el formato de `docs/AGENT-WORKFLOW.md`. El revisor
produce un `PASS` independiente (corriendo los gates + la integración Neon en rama efímera)
antes de marcar la spec como `implementada`.

## Decidido con el owner (2026-08-16)

- **Un solo programa a nivel de marca** (ya garantizado por el índice único); el QR apunta a
  ese programa automáticamente, sin selector de programa.
- **Estadísticas por local:** se logran haciendo del `location_id` una dimensión de cada
  evento (ADR 0042). Esta spec cierra la **captura del alta** (`origin_location_id` + `?loc=`).
  La venta/acumulación ya la tiene (`order.location_id`); el **canje** no existe aún y nacerá
  con `location_id`; el **tablero** es otra feature.
- **Salida = PDF por impresión del navegador** (HTML/SVG + CSS `@media print`), tamaños **A4 y
  A5**. Sin librería de PDF.
- **5 plantillas** curadas y bien diferenciadas por rubro (bar/alojamiento/retail/…).
- **Textos/CTA:** defaults según el tipo de programa, **editables** por el owner en el preview
  de la plantilla elegida.
- **Es un wizard:** elegir plantilla → chequear logo/colores → preview (modificar colores,
  textos y estilo del QR).
- **Estilos de QR: los básicos sin dependencia** (negro / teñido de marca / logo al centro a
  EC nivel H); módulos artísticos quedan fuera por ahora.

## Abierto

Nada bloqueante — la spec está cerrada. Notas menores delegadas al implementador dentro del
alcance ya decidido: la disposición fina de cada una de las 5 plantillas y el tamaño exacto
del logo central del QR que EC-H tolera con margen de escaneo (elegir conservador y verificar
escaneando).
