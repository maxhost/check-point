---
spec: 0097
fecha: 2026-09-25
estado: cerrada
resumen: Cinco pasos de orientación y seis ayudas de Marca, con guardado confirmado del borrador completo, recuperación de errores y acceso por permiso brand; afiche separado.
disjunta: no
archivos: apps/merchant/src/app/backoffice/brand/**, apps/merchant/src/app/backoffice/backoffice-navigation*, apps/merchant/src/app/backoffice/onboarding/**, apps/merchant/src/app/components/tour-events.ts, apps/merchant/src/app/globals.css, apps/merchant/src/server/upload-image-formats.test.ts, tests/e2e/brand-*.spec.ts, tests/e2e/support/brand-*, tests/e2e/support/catalog-harness-server.ts
---

# 0097 — Tours de onboarding y ayuda de Marca

## Problema y evidencia del árbol

- `backoffice/brand/brand-page.tsx`: editor de identidad, logo, colores y región sin Ayuda
  ni anchors de tour. Un único `save()` envía todos los campos y actualiza el borrador con
  el DTO devuelto. `use-brand-logo.ts` difiere la subida hasta ese guardado.
- `onboarding/onboarding-view.ts`: `brand` todavía no tiene destino disponible.
- `brand/page.tsx`: exige `requireOwner()`; `backoffice-navigation.tsx`: Marca no tiene
  `delegado: true`. Las rutas `api/brand/route.ts` y `api/brand/logo-upload/route.ts` ya
  exigen permiso `brand`. El adaptador de UI no refleja el ADR 0079.
- `server/brand.ts`: la revisión se compara al escribir; `409` puede ser conflicto de
  revisión o carga expirada/consumida. Los errores de dominio no tienen `code`.

Evidencia: lectura de esos archivos, validación de Marca y ruta de progreso. No se visitó
la página autenticada ni se verificó despliegue en esta fase documental.

## Alcance y responsables

Entra: orientación aprobada de cinco pasos, seis ayudas, integración del checklist,
adaptación de permisos en página/navegación, clientes HTTP y recuperación necesarios para
acompañar el editor actual, anchors y accesibilidad móvil. Codex implementa toda esta UI.
Claude Code conserva rutas API, dominio, persistencia, guards y assets.

No entra: implementar el recorrido de afiche, cambiar Brand Kit o sus permisos, convertir
precios, rediseñar la identidad, actualizar Wallet ni modificar API/schema. Ningún cambio
backend requerido identificado. Coordinar cualquier incompatibilidad HTTP antes de consumirla.

Consume ADR 0078/0079/0087/[0088](../adr/0088-los-tours-de-marca-acompanan-el-borrador-y-el-guardado.md),
specs 0084/0085/0086/0096 y el contrato de progreso 0084.

## Autorización y entrada

- `brand/page.tsx` reutiliza `requireBackofficeSession()` y el patrón de Catálogo:
  validar `membership.permissions.includes("brand")`, redirigir a `/backoffice` sin alcance,
  pasar `isOwner` al cliente. El resolvedor ya entrega todos los permisos al owner.
- Marcar Marca delegada en navegación; probar el resultado real de `delegatedLinks`.
  No editar el guard compartido ni duplicar su resolución en un request de sesión del cliente.
- Owner: orientación y ayudas. Staff con `brand`: seis ayudas, sin POST de onboarding ni
  enlace Crear afiche porque `brand/kit/page.tsx` aún exige owner. API conserva su autorización.
- Entrada owner: `/backoffice/brand?tour=onboarding`, constante compartida con checklist y
  parser local. Iniciar después de GET válido y anchors montados; consumir sólo ese parámetro,
  conservar los demás. Recargar no relanza. Staff ignora el modo sin registrar progreso.
- Un único recorrido activo. Iniciar orientación/ayuda no borra cambios pendientes ni
  establece valores; no iniciar mientras hay recorte, preparación de imagen o guardado activo.

## Orientación: cinco pasos, sin operaciones

| Paso | Anchor propuesto | Copy inicial |
|---|---|---|
| Identidad y logo | `brand-identity-logo` | «Dale identidad a tu negocio». «Elegí el nombre y un logo que tus clientes reconozcan. Podés continuar sin logo.» |
| Paleta y vista previa | `brand-colors` | «Usá los colores de tu marca». «Ajustá primario, complementario y acento. La vista previa muestra el borrador antes de guardarlo.» |
| Configuración regional | `brand-regional` | «Revisá horarios y moneda». «La zona horaria define fechas y horarios; la moneda se usa para mostrar los precios del catálogo.» |
| Guardar marca | `brand-save` | «Aplicá tus cambios cuando estén listos». «Guardar marca aplica todo el borrador. Elegir o quitar un logo todavía no guarda esos cambios.» |
| Ayuda y Crear afiche | `brand-help` | «Encontrá una guía cuando la necesites». «Ayuda te acompaña para cambiar tu marca. Desde Crear afiche podés preparar un afiche con QR para sumar clientes.» |

Agrupar Identidad/Logo en un contenedor estable; resaltar Paleta y explicar la preview
sin buscar dos anchors simultáneos. Ayuda es el anchor final siempre montado; el enlace
afiche se explica sin pulsarlo. Siguiente/Anterior sólo cambian paso; no escriben Marca,
no abren archivos ni navegan. Deshabilitar interacción operativa durante orientación.

Saltar en primer paso y cierre voluntario registran `skipped`; Listo registra `completed`.
Ocultar checklist mientras hay tour; al cerrar restaurarlo y refrescar la lectura, sin
inventar `done`. Fallo de progreso: aviso y Reintentar sólo el mismo POST; el editor queda
disponible. Desmontaje técnico limpia el tour sin registrar Saltar.

## Ayuda: seis tareas

Ayuda abre diálogo accesible de opciones; elegir cierra el diálogo e inicia el recorrido.
Todas usan `persist: false`. Campos/pasos informativos avanzan manualmente; Guardar no
ofrece Siguiente para eludir la respuesta. Cada tarea termina con DTO guardado y Listo.

| Id local | Secuencia y condición |
|---|---|
| `change-name` | Nombre → explicar límite de 120 caracteres y completar → vista previa → Guardar → PUT exitoso con nombre confirmado |
| `change-logo` | Elegir/Cambiar logo, o Tomar foto si existe → archivo válido → recorte si el navegador lo permite → preview del logo elegido → Guardar → preparación/subida/PUT exitosos y `logoPath` confirmado |
| `remove-logo` | Quitar → preview sin logo → explicar que se aplica al guardar y se mostrará el nombre/iniciales según la superficie → Guardar → PUT exitoso con `logoPath: null` |
| `change-colors` | Primario → Complementario → Acento → preview → Guardar → PUT exitoso con paleta devuelta |
| `change-timezone` | Zona horaria → explicar fechas/horarios → elegir valor → Guardar → PUT exitoso con zona devuelta |
| `change-currency` | Moneda → explicar que cambia la moneda mostrada, sin convertir los importes existentes → elegir valor → Guardar → PUT exitoso con moneda devuelta |

No obligar a modificar campos informativos ni a elegir valores diferentes para continuar.
En logo sí se espera selección válida o Quitar real antes de ir al guardado; no se elige
una imagen ni se pulsa Quitar automáticamente. Quitar está deshabilitado en Ayuda cuando
no hay logo visible, con motivo «Primero agregá un logo». No introducir confirmación
destructiva: Quitar prepara un borrador y Guardar sigue siendo la acción que lo aplica.

Antes del paso Guardar, en todas las tareas: «Se guardarán todos los cambios pendientes
de la marca, incluidos los de otras secciones». Conservar el borrador previo al iniciar.
Salir retira sólo la guía: conserva campos, logo seleccionado y cropper si está abierto.
Cancelar recorte conserva la semántica actual del editor y termina esa ayuda, sin guardar.
Cancelar picker no avanza ni termina el recorrido; se permite elegir nuevamente.

## Borrador, asincronía y recuperación

- Reutilizar `useBrandLogo`, validación y cropper diferido. Resolver fases con estado React:
  archivo elegido, imagen preparando, recorte montado, archivo seleccionado y guardado.
  Nunca avanzar por clic del picker ni exigir cropper al fallback de imagen no decodificable.
  Copy de formatos/tamaño derivado de constantes existentes, sin prometer soporte adicional.
- Un único `save()` para uso normal y ayuda. Bloquear Guardar durante preparación/recorte;
  mientras guarda, congelar controles de edición/archivo/Quitar para que una respuesta no
  descarte cambios hechos después del request. Evitar submits duplicados en vuelo.
- Capturar snapshot de guardado e instancia de tarea; resultado sólo avanza esa instancia.
  Salir/reiniciar ayuda durante un request no hace que su respuesta avance la nueva guía.
  El editor sí procesa el resultado de su operación normal al completarse.
- El PUT devuelve el DTO definitivo, incluidos normalización y revisiones; actualizar
  `brand`/`draft` desde esa respuesta y recién entonces limpiar selección de logo/mostrar éxito.
  No añadir GET obligatorio ni repetir PUT para refrescar después de un guardado confirmado.
- Validación, preparación, PUT a URL firmada, procesamiento o guardado fallidos conservan
  borrador y error; el paso no avanza. Reintento de guardado es explícito y prepara otra carga
  si hace falta, porque el upload anterior puede estar consumido. No reusar uploadId fallido
  ni reintentar escrituras por timers del tour. Liberar object URLs al reemplazar/desmontar.
- `409` mantiene el mensaje API sin inferir causa por texto; ofrecer «Consultar marca actual»
  que hace sólo GET y muestra los datos guardados sin reemplazar el borrador. Para adoptar esa
  versión se requiere acción explícita «Usar versión guardada», confirmando que descarta el
  borrador local; termina la ayuda. No actualizar sólo la revisión para sobreescribir otra
  sesión silenciosamente. GET fallido conserva ambos estados y permite reintentar sólo lectura.
- Fallo de red o cuerpo no válido tras PUT no equivale a éxito: el resultado puede ser
  desconocido. Ofrecer la misma consulta de estado antes de volver a guardar; no anunciar
  «no se guardó» ni confirmar por comparar únicamente valores locales.
- GET inicial fallido muestra error y Reintentar; no iniciar recorrido ni buscar anchors
  dentro del skeleton. `401`/`403` termina ayuda/orientación sin guardar progreso por ese
  cierre, mantiene error de acceso y evita ofrecer reintentos de escritura no autorizada.
- Anterior sólo entre campos/información montados. No retroceder a fases que reabran picker,
  repitan Quitar/subida/PUT o busquen elementos desmontados.

## Contratos HTTP existentes

| Recurso | Entrada / respuesta |
|---|---|
| `GET /api/brand` | DTO: `id`, `name`, `timezone`, `currencyCode`, tres `brand*Color`, `brandRevision`, `logoVersion`, `logoPath`; no claves internas de R2 |
| `POST /api/brand/logo-upload` | `{ contentType, byteSize }` → 201 `{ uploadId, uploadUrl, expiresAt }`; subir archivo con PUT a `uploadUrl` y su Content-Type |
| `PUT /api/brand` | Campos editables, `revision: brandRevision`, `logoAction: keep/replace/remove`; sólo replace incluye `uploadId` y `cropped` → 200 DTO definitivo |
| `GET /api/onboarding/checklist` | Consumir orden, obligatoriedad y `done` de la API existente |
| `POST /api/onboarding/tours/brand` | `{ status: completed/skipped }` → 200; reutilizar cliente/contrato 0084, sólo owner |

Marca: rechazos de guard 401 `unauthorized`; 403 `not_member`, `missing_permission`,
`email_not_verified` (owner), `business_suspended`, `business_closed`; dominio devuelve
`{ error }` sin code: 400 cuerpo ilegible, 422 validación/imagen, 409 conflicto/carga no
usable, 503 fallo genérico de escritura/preparación. GET/guard pueden fallar fuera del
catch y devolver respuesta no JSON: cliente debe tolerarlo sin inventar code ni causa.
Subida firmada usa el status real del storage; no esperar el DTO de errores de Marca.
Onboarding conserva todos los errores normativos del contrato 0084, sin duplicar su lista.
No enviar businessId, pasos, selectores ni ids de tareas de ayuda al servidor.

## Accesibilidad, lifecycle y archivos

Contenido/selectores/controlador locales, decisiones puras separadas de efectos y anchors
`data-tour` estables. Limpiar Driver.js, listeners y timers en cierre/desmontaje; no writes
de dominio ni progreso por limpieza. Restaurar checklist. Ampliaciones del motor compartido,
si fueran necesarias, compatibles por defecto y con regresión de Catálogo/Staff/Locales.
Diálogo con nombre, Escape, foco inicial/retorno y teclado; cropper y popover utilizables
juntos. Scroll y spotlight visibles con teclado móvil abierto; controles ≥44 px, ancho
desde 320 px, claro/oscuro y movimiento reducido. CSS acotado a Marca/tour.

| Archivo (desde raíz) | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/brand/brand-tour-{definitions,controller,state}.*` | Definiciones, copy y decisiones/controlador locales |
| `apps/merchant/src/app/backoffice/brand/brand-page.tsx`, `use-brand-logo.ts`, `regional-fields.tsx` | Ayuda, anchors, callbacks, guardado y recuperación; extraer cliente HTTP/componentes a módulos hermanos para respetar tamaño |
| `apps/merchant/src/app/backoffice/brand/page.tsx` | Adaptar permiso y prop de rol |
| `apps/merchant/src/app/backoffice/backoffice-navigation*` | Publicar Marca delegada y pruebas |
| `apps/merchant/src/app/backoffice/onboarding/{onboarding-view,onboarding-checklist}.*` | Destino brand, lifecycle y pruebas |
| `apps/merchant/src/app/components/tour-events.ts`, `backoffice/onboarding/onboarding-tour.ts`, `globals.css` | Sólo ajustes compartidos necesarios y compatibles |
| Pruebas junto a módulos; `tests/e2e/brand-*.spec.ts`, `tests/e2e/support/brand-*` | Reglas, cableado, componentes reales y smoke autenticado separado |
| `tests/e2e/support/catalog-harness-server.ts` | Reutilizar servidor de componentes con entrada opcional; conservar entrada de Catálogo por defecto |
| `apps/merchant/src/server/upload-image-formats.test.ts` | Actualizar sólo la ruta de la superficie UI extraída a brand-identity; conservar las mismas aserciones de formatos |

**Disjunta: no.** Comparte navegación, checklist, motor y CSS con 0096/0088 y los tours
de Locales. Serializar cambios de esos archivos; Brand Kit permanece fuera del diff.

## Definition of Done y verificación

- [x] Checklist inicia exactamente cinco pasos con/sin logo; Siguiente no modifica el
  borrador ni envía requests de Marca. Persistencia completed/skipped y fallo/reintento
  de sólo progreso; desmontaje sin POST y parámetro consumido sin perder los demás.
- [x] Seis ayudas, cero POST de progreso. Salir preserva borrador/cropper; callbacks
  tardíos no avanzan otra tarea; POST tardío de progreso no oculta errores del editor.
- [x] Picker cancelado/archivo inválido/recorte cancelado/fallback probados con editor real;
  logo/Quitar esperan PUT; success usa DTO definitivo y normalizado.
- [x] Nombre/colores/región incluyen los otros cambios pendientes en el PUT y lo explican;
  422, subida fallida, 503 y doble clic no producen avance/requests duplicados.
- [x] 409 y red desconocida conservan borrador; consulta reintenta sólo GET; adoptar versión
  requiere confirmación. GET inicial fallido se recupera; 401/403 termina sin progreso.
- [x] Staff con brand accede a página y navegación, usa ayudas y no ve afiche; sin alcance
  rebota; owner conserva orientación/afiche. Probar adaptador y navegación, no sólo helper.
- [ ] Playwright monta componentes reales con CSS y HTTP controlado: orientación, seis
  ayudas, fallo/éxito, conflicto, late callbacks, salida y teclado móvil/escritorio. Separar
  estos casos de smoke autenticado contra página real merchant en 3001 con owner/staff
  de desarrollo aislado; registrar skips si faltan fixtures. No usar datos de producción
  ni agregar endpoints de prueba ni suplantar el guard server-side con `page.route`.
- [ ] QA iOS/Android: picker/cámara/recorte, teclado y scroll, regreso a edición, claro/oscuro
  y movimiento reducido; registrar dispositivo/resultado. `setInputFiles` no prueba cámara.
- [x] Gates root Node 24 una vez al final: `pnpm run typecheck`, `pnpm run lint`,
  `pnpm run test`, `pnpm run format:check`, `pnpm run build`, `pnpm run test:e2e`.
- [x] `rg -n MUTATION apps tools` vacío; handoff y PASS independiente con límites declarados.

**Presupuesto: seis mutaciones de errores plausibles**, máximo dos rondas: ayuda persiste
onboarding; Quitar/seleccionar avanza sin PUT exitoso; error avanza; salir borra borrador;
respuesta vieja avanza otra tarea; staff sin brand entra por adaptador. Son objetivos del
código futuro, no mecanismos/oráculos ya existentes. Tras implementar, localizar cada
mecanismo y ejecutar primero regla y cableado; documentar shasum limpio y bitácora antes
de mutar, etiqueta MUTATION y restauración comprobada contra copia limpia.

Condición de corte: dos rondas consecutivas donde el fix abre otra rotura llevan el resto
a QA, sin tercera ronda automática. Storage real, concurrencia entre sesiones y propagación
de Marca a otras superficies no quedan demostrados por HTTP controlado. No correr suites
Neon contra producción; no se modifica backend en esta entrega.

## Handoff y estado

Diseño cerrado con aprobación del owner. UI implementada y verificada el 2026-09-25,
con [PASS independiente de la UI verificable](../archivo/spec-0097-revision-ui.md).
La spec conserva `cerrada` por QA real pendiente, siguiendo el criterio de 0096.
Publicación y SHA en TASKS; el owner autorizó commit y push y luego indicó explícitamente
«no necesitamos verificar el deploy en vercel». La ayuda de afiche se diseña por separado.

Evidencia local: [handoff de UI](../archivo/spec-0097-handoff-ui.md) y
[bitácora de seis mutaciones](../archivo/spec-0097-bitacora-de-mutaciones.md). Seis gates
root verdes: 1801 tests passed / 595 skipped; navegador 48 passed / 5 skipped, incluidos
27 casos de Marca aprobados y dos smoke autenticados de Marca omitidos. Las casillas
marcadas tienen evidencia automatizada y PASS independiente acotado; no equivalen a QA nativo.

Pendientes: smoke con sesiones reales owner/staff de desarrollo
aislado y QA iOS/Android. Orientación con/sin logo y respuestas tardías de progreso
200/503 frente a error de guardado están comprobadas en `brand-progress.spec.ts`.
Storage real, formatos HEIC/AVIF reales y concurrencia entre sesiones quedan fuera de la
evidencia de fixtures. Los archivos nuevos `brand-skeleton` y `brand-identity`, el cliente
HTTP y el hook del editor son extracciones previstas para mantener módulos pequeños;
el motor compartido conserva su implementación.

Corrección de revisión R1: Quitar durante preparación invalidaba la selección pero dejaba
`isAnalyzing` activo. La invalidación limpia ese estado para Quitar/cancelar/reset; la
resolución vieja se descarta y libera su recurso. Reproducción roja del revisor y del
implementador; regresión real `brand-logo-lifecycle.spec.ts` verde y seis gates actualizados.
El checklist flotante puede cubrir Guardar en desktop; colapsar el resumen permite clic
real. Limitación recuperable documentada para QA autenticado, no declarada corregida.

**QA del owner y handoff:** después del commit/push (`0c1c847` UI; `0e78f3f` docs), el
owner indicó «quedo perfecto» y pidió handoff/clear para continuar. Se registra aprobación
general de la entrega sin atribuir dispositivos ni escenarios no informados. La siguiente
entrega propuesta es la ayuda de afiche, separada; punto de retorno en TASKS.
