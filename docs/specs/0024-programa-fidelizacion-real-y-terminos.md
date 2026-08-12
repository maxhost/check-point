---
spec: 0024
fecha: 2026-08-12
estado: cerrada
resumen: Owner configura un programa real versionado de Puntos o Sellos, con transición fechada y términos comerciales compuestos desde biblioteca editable.
disjunta: no
archivos: apps/merchant, migraciones Drizzle, Neon, pruebas y docs
---

# 0024 — Programa de fidelización real y términos

## Problema

El programa demo sólo existe en `sessionStorage`; no tiene aislamiento por negocio,
autorización, versiones, transición de beneficios ni términos que puedan mostrarse y
auditarse en la wallet. Las campañas y el check-in futuros necesitan una configuración
publicada y estable a la que referenciar.

## Alcance

**Entra:**

- Sustituir la configuración demo por un programa real por negocio, visible y editable por
  el Owner autenticado desde `/backoffice/loyalty`.
- Activar Puntos o Sellos; nunca ambos. El modelo tipado incluye `tiers` y `cashback`, sin
  hacerlos seleccionables u operables.
- Publicar una primera versión y nuevas versiones de la misma modalidad.
- Al sustituir una versión o cambiar modalidad, exigir `earning_ends_at` y
  `redemption_ends_at` futuros para la versión anterior.
- Configurar Puntos (nombre singular/plural) o Sellos (nombre, objetivo 2–50 e imagen
  opcional preparada para R2).
- Biblioteca inicial de cláusulas de términos, selección, orden, copia editable por owner,
  cláusula custom, variables permitidas y publicación de una copia renderizada inmutable.
- Autorización por sesión/membresía owner, aislamiento por `business_id`, toasts, estados
  de carga/error, responsive y accesibilidad.

**No entra:**

- Acumulación, saldo, progreso, canje, campañas conectadas, wallet consumer, notificaciones
  reales, aceptación consumer, Niveles operables, Cashback operable o migración automática
  de saldos.
- Subida real a R2: se persiste `stamp_image_object_key` sólo cuando el flujo de R2 exista;
  esta primera entrega muestra el campo preparado sin aceptar archivos persistentes.
- Publicar plantillas como asesoría legal o habilitar nuevas jurisdicciones sin aprobación
  editorial/jurídica.

## Diseño

```text
/backoffice/loyalty
  → sin programa: elegir Puntos | Sellos → configuración → términos → publicar V1
  → programa activo: editar → publicar nueva versión de la misma modalidad
  → cambiar modalidad o desactivar: transición con cierre de acumulación/canje de Vn
```

La página carga el negocio de la sesión; nunca acepta un `business_id` como autoridad del
navegador. Una versión publicada se vuelve inmutable. El Owner puede guardar un borrador,
pero sólo una publicación cambia la versión activa.

### Modelo de datos

```text
loyalty_program
  id, business_id UNIQUE, status(active|inactive), active_version_id, timestamps

loyalty_program_version
  id, program_id, kind(points|stamps|tiers|cashback), schema_version,
  configuration_json, effective_from, earning_ends_at?, redemption_ends_at?,
  status(draft|active|retiring|retired), published_at?, created_by, timestamps

loyalty_program_transition
  id, program_id, from_version_id, to_version_id?, earning_ends_at,
  redemption_ends_at, created_by, created_at

terms_template
  id, key, jurisdiction_scope, locale, category, title, template_markdown,
  variables_allowlist, version, status(draft|published|retired), published_at

loyalty_terms_version
  id, program_version_id UNIQUE, rendered_markdown, content_hash,
  acceptance_required, published_at

loyalty_terms_clause
  id, terms_version_id, position, source_template_id?, source_template_version?,
  rendered_clause, edited_by_owner

loyalty_terms_acceptance (futuro)
  id, terms_version_id, consumer_identity_id, accepted_at, acceptance_channel
```

Invariantes:

- Un negocio tiene una única fila de programa y a lo sumo una versión `active`.
- `active_version_id` refiere una versión del mismo programa con estado `active`.
- Una transición exige `earning_ends_at <= redemption_ends_at`, ambas posteriores a su
  creación y a la activación de la versión saliente.
- Al activar una nueva versión, la anterior pasa a `retiring`; no admite acumulación tras
  `earning_ends_at` y permanece canjeable hasta `redemption_ends_at`.
- `configuration_json` se valida antes de persistir: Puntos exige unidades; Sellos exige
  unidad y entero 2–50. Los esquemas de Niveles/Cashback existen como contratos cerrados,
  pero las rutas rechazan su publicación hasta una spec posterior.
- Las variables de términos se resuelven sólo desde allowlist:
  `business_legal_name`, `program_name`, `program_kind`, `effective_from`,
  `earning_ends_at`, `redemption_ends_at`, `country_code`. No se evalúa HTML, JS ni
  variables arbitrarias.
- Al publicar, se persiste el markdown renderizado, hash SHA-256, cláusulas finales y la
  procedencia de plantilla. La plantilla posterior puede cambiar sin alterar el texto ya
  publicado.

### Contratos y rutas

- `GET /api/loyalty-program`: devuelve el programa, versión activa, versiones retirándose y
  términos publicados sólo para el Owner del negocio de sesión.
- `POST /api/loyalty-program/drafts`: crea/actualiza un borrador tipado del programa.
- `POST /api/loyalty-program/publish`: publica V1 o Vn. Para reemplazo recibe ambas fechas
  de transición y términos finales; el servidor valida e inserta de forma transaccional.
- `POST /api/loyalty-program/deactivate`: exige fechas de cierre y deja el programa sin
  versión activa; la historia sigue disponible.
- `GET /api/loyalty-terms/templates?locale=es&country=EC`: entrega sólo plantillas
  `published` aplicables. En esta entrega se siembran cláusulas internas de ejemplo para
  desarrollo, claramente etiquetadas como borrador editorial.

Las respuestas no exponen borradores ni programas de otro negocio. `409` indica conflicto
de publicación concurrente; `422` validación de configuración/transición; `403` falta de
membresía owner.

### UI

- La home real enlaza a `/backoffice/loyalty`; la pantalla demo permanece aislada hasta
  que las otras rutas demo se sustituyan.
- Sin programa se elige Puntos/Sellos y se configura la primera versión. La sección de
  términos permite añadir plantillas, editar su copia y añadir texto custom; muestra una
  previsualización de variables resueltas.
- Con programa se visualiza versión activa, fechas de acumulación/canje y términos
  publicados. Editar crea borrador; publicar una nueva versión solicita la ventana de
  transición. Cambiar modalidad/desactivar usa `ConfirmDialog` reutilizable.
- En móvil, acciones y formulario tienen una columna, controles táctiles >=44px y el texto
  de términos se conserva legible; el guardado no navega ni pierde borrador ante error.

### Arquitectura de referencia

- ADR 0020, ADR 0026, ADR 0005, ADR 0018 y ADR 0017.
- Spec 0003 (campañas), Spec 0004 (wallet) y Spec 0021 (catálogo) consumirán las versiones
  publicadas, sin acoplar esta entrega a sus tablas futuras.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/schema.ts` | añadir tablas, estados y relaciones de programa/términos |
| `apps/merchant/drizzle/0004_*`, `meta/*` | migración versionada y snapshot |
| `apps/merchant/src/server/loyalty-program.ts` | contratos, validación, publicación transaccional y autorización |
| `apps/merchant/src/server/loyalty-terms.ts` | render seguro, hash y biblioteca de cláusulas |
| `apps/merchant/src/app/api/loyalty-*/**` | rutas autenticadas |
| `apps/merchant/src/app/backoffice/loyalty/**` | UI real client/server y estados |
| `apps/merchant/src/app/backoffice/page.tsx` | enlazar acceso real |
| `apps/merchant/src/app/components/**`, `globals.css` | reutilizar UI; sólo estilos necesarios |
| `apps/merchant/src/**/*.test.*`, `tests/e2e/**` | unitarias, integración y E2E |
| `docs/INDEX.md`, `docs/TASKS.md`, `docs/HANDOFF.md` | estado, handoff y cierre |

### Disjunta?

No. Comparte `schema.ts`, migraciones, backoffice y estilos con Specs 0022/0023 y con el
backoffice real futuro. Se implementa en serie.

## Definition of Done

- [ ] Owner autenticado puede crear un programa real de Puntos o Sellos para su negocio y
  sólo uno queda activo.
- [ ] La primera publicación y cada actualización crean una versión inmutable con
  configuración validada, fecha de vigencia y términos renderizados con hash.
- [ ] Sustituir versión o modalidad exige una ventana de cierre válida para la versión
  anterior; la base conserva ambos límites y la transición auditable.
- [ ] El modelo reconoce Puntos, Sellos, Niveles y Cashback, pero rutas/UI rechazan operar
  los dos últimos hasta su spec propia.
- [ ] Owner puede seleccionar plantillas publicadas, editar su copia, añadir cláusula
  custom y previsualizar variables permitidas; ningún cambio altera una plantilla o unos
  términos ya publicados.
- [ ] Owner sin membresía no puede leer ni mutar programa, borrador, términos o transición
  de otro negocio; solicitudes manipuladas son rechazadas.
- [ ] La UI es mobile-first, accesible y mantiene el borrador frente a errores; muestra
  loading, error, confirmación y éxito con componentes reutilizables.
- [ ] Migración reproducible aplicada a Neon; format, lint, typecheck, unitarias,
  integración, E2E y build pasan; revisión independiente emite PASS.

## Plan de pruebas y verificación

- [ ] Unidad: validadores aceptan Puntos/Sellos válidos y rechazan tipo no habilitado,
  campos vacíos, objetivo fuera de 2–50, variable no permitida y markdown no resuelto.
- [ ] Unidad: render de términos sustituye sólo allowlist y produce el mismo hash para el
  mismo contenido; editar copia no modifica la plantilla.
- [ ] Integración Neon: publicar V1 crea programa, versión activa y términos inmutables;
  publicar V2 marca V1 `retiring` con ambas fechas y referencia activa atómica.
- [ ] Integración: dos publicaciones concurrentes no dejan dos versiones activas; una
  transición inválida revierte por completo.
- [ ] Autorización: owner A no puede leer/modificar el negocio B ni inyectar `business_id`.
- [ ] E2E móvil: Owner crea Sellos, añade/edita cláusula, publica, prepara V2 con fecha de
  canje y comprueba ambas versiones visibles.
- [ ] Manual: teclado, foco de confirmación, texto largo, previsualización de variables y
  recarga con borrador/versión publicada.
- [ ] Comandos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e` y `pnpm --filter @mi-pasaporte/merchant build`.

## Handoff requerido

Implementador y revisor siguen `docs/AGENT-WORKFLOW.md`; el revisor aporta un PASS
independiente antes de marcar la spec como implementada.

## Abierto

No bloquea esta entrega: revisión editorial/jurídica y activación por jurisdicción de
plantillas reales; R2; aceptación consumer; economía y operación de Niveles/Cashback;
notificaciones reales de transición.
