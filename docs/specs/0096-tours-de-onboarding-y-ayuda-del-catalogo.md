---
spec: 0096
fecha: 2026-09-25
estado: cerrada
resumen: Codex implementa la UI del tour de Catalogo con cuatro pasos de onboarding y ocho ayudas operativas, consumiendo las APIs existentes; avance por estado confirmado, seleccion por id, permisos y recuperacion de errores mobile-first.
disjunta: no
archivos: apps/merchant/src/app/backoffice/catalog, apps/merchant/src/app/backoffice/onboarding, apps/merchant/src/app/components/tour-events.ts, apps/merchant/src/app/globals.css, tests/e2e
---

# 0096 — Tours de onboarding y ayuda del catálogo

> Plantilla chica ampliada con recorridos y contrato de responsabilidades: un dominio de
> producto, sin migraciones y con alcance aprobado por el owner el 2026-09-25. ADR 0087.
> **UI implementada localmente con PASS independiente acotado; QA real pendiente.**
> Evidencia y límites: [handoff UI](../archivo/spec-0096-handoff-ui.md).

## Problema medido antes de implementar

- `backoffice/onboarding/onboarding-view.ts:ONBOARDING_TOUR_HREFS` sólo publica Locales y Staff;
  `catalog` ya existe en `server/onboarding/tours.ts:ONBOARDING_TOURS` pero aparece Próximamente.
- `backoffice/catalog/catalog-page.tsx:CatalogPage` tiene las operaciones y no tiene controlador
  de tours ni Ayuda. `category-manager.tsx`, `catalog-list.tsx` y `product-editor.tsx` carecen
  de anchors de catálogo para Driver.js.
- `use-catalog-import.ts:choose` analiza el PDF al elegirlo; las fotos esperan `analyze`.
  `catalog-ai-import-result.tsx` muestra el catálogo ya escrito. La ayuda debe seguir ese flujo.
- `use-catalog.ts:reload` absorbe errores; `mutate` puede devolver `true` después de una
  recarga fallida. La UI del tour debe distinguir escritura confirmada y lista actualizada.
- El motor `onboarding-tour.ts` permite `onSaveError`, pero el cierre no restaura el checklist:
  `onboarding-checklist.tsx:hiddenForTour` sólo se activa con el evento de inicio.

## Alcance y responsables

**Entra:** orientación de cuatro pasos, ocho ayudas, anchors, copy español en archivo tipado,
selección de entidad, integración con tabs/modales/importador, avance por resultados, errores,
permisos, mobile-first y pruebas. Se corrige el copy del banner a «La IA crea categorías,
productos y precios. Después podés revisar y completar tu catálogo».

**No entra:** API nueva, cambios de dominio/schema, CMS, textos del tour por HTTP, traducción
a un segundo idioma, importación simulada, analítica nueva ni reescritura de Staff/Locales.

| Responsable | Archivos y decisiones |
|---|---|
| Codex — UI completa | `backoffice/catalog/**`, `backoffice/onboarding/**`, `components/tour-events.ts`, CSS y pruebas de UI; clientes HTTP locales; adaptador de sesión/permisos en `catalog/page.tsx` |
| Claude Code — API | `app/api/**`, `server/**`, Drizzle, guards, writer y proveedor IA; contratos HTTP de esas rutas |
| Owner | QA visual y cámara/archivos en dispositivos reales; decisiones de producto si cambia el alcance |

**Trabajo necesario de Claude Code para esta spec: ninguno identificado.** No editar sus rutas
ni módulos de servidor. Si la implementación descubre una respuesta incompatible, registrar
ruta, request, respuesta observada y contrato esperado; coordinar un cambio antes de consumirlo.

## API consumida y límites entre roles

| Recurso existente | Uso desde UI |
|---|---|
| `GET /api/onboarding/checklist` | Orden, obligatoriedad, textos de los items y `done`; no pasos ni selectores |
| `POST /api/onboarding/tours/catalog` | `{ status: "completed" \| "skipped" }`, sólo orientación del owner |
| Sesión de backoffice / `GET /api/merchant/session` | Rol y `permissions`; reutilizar sesión resuelta, sin consulta redundante |
| `GET /api/catalog` | Productos, categorías, locales, moneda e `importInProgress` |
| `POST /api/catalog/category`; `PUT` / `DELETE /api/catalog/category/{id}` | Crear, renombrar y eliminar por los clientes existentes |
| `POST /api/catalog/product`; `PUT` / `DELETE /api/catalog/product/{id}` | Crear, editar y eliminar por los clientes existentes |
| `/api/catalog/imports/*` | Reservar/subir/analizar/consultar/cancelar con `useCatalogImport`; contrato normativo 0090 |

No mandar `businessId`, selectores ni nombres de tours de ayuda al servidor. El dinero mantiene
la representación del contrato de cada recurso: no copiar los strings del resultado de IA sobre
los campos numéricos del editor manual. El progreso sigue siendo por negocio, sin nueva versión.

**Errores:** onboarding conserva el cliente 0084 y muestra fallo/reintento de persistencia.
CRUD acepta `{ error, code? }`; no asume códigos donde no los hay. Importación consume los
códigos y `retryAfterSeconds` de [0090](0090-contratos-de-api.md), sin duplicar su lista ni fijar
cupo/tamaño/páginas en el copy. Un `401` o `403` termina la ayuda con mensaje de sesión/permisos;
validación/conflicto/red mantiene contexto y permite corregir o reintentar. Un `409
catalog_import_in_progress` refresca el estado y explica el bloqueo de altas; el importador
conserva su recuperación del import existente. No inferir causas a partir del texto del error.

## Orientación: exactamente cuatro pasos

Inicio desde `/backoffice/catalog?tour=onboarding`, una vez por solicitud, después de cargar
catálogo y montar anchors. `href` y parser se derivan de constantes compartidas. Consumir sólo
ese parámetro al iniciar, conservando los demás; una recarga posterior no relanza el tour.
Sólo el owner inicia este modo; un staff con esa URL conserva el acceso normal sin persistir.

| Paso | Anchor propuesto | Copy inicial |
|---|---|---|
| 1. Importar con IA | `catalog-import-entry` | «Cargá tu menú con IA». «Importá un PDF o fotos desde el celular. La IA crea lo que falta; después podés revisar y completar el catálogo.» |
| 2. Productos | `catalog-products-entry` | «Creá y gestioná productos». «Desde Nuevo producto cargás uno a mano. En Productos podés editar sus datos y, si sos owner, eliminarlo.» |
| 3. Categorías | `catalog-categories-entry` | «Organizá tu menú». «En Categorías podés crear y renombrar grupos. Al eliminar una categoría, sus productos quedan sin categoría.» |
| 4. Ayuda | `catalog-help-entry` | «Aprendé una tarea cuando la necesites». «Abrí Ayuda para importar, crear, editar o eliminar con una guía paso a paso.» |

Anchors sobre controles o contenedores siempre montados, sin exigir filas existentes ni pulsar
acciones. No abrir tabs/modales ni APIs de dominio al pulsar Siguiente. Primer paso permite
Saltar; cierre voluntario guarda `skipped`, Listo guarda `completed`. Durante el tour se oculta
el checklist; al terminar se vuelve a consultar, sin inventar `done` local.
Si falla el POST: aviso «No pudimos guardar tu progreso» y Reintentar que repite sólo ese POST
con el mismo estado. El checklist vuelve a estar disponible y el item conserva el estado API.

## Ayuda: ocho recorridos

Ayuda abre un diálogo accesible de opciones. Al elegir se cierra el diálogo y se prepara el
recorrido. Sólo uno activo a la vez. Todos usan `persist: false`, incluso si los termina el owner.
El texto indica que las acciones se aplican al catálogo real.

| Id local | Pasos y condición de éxito |
|---|---|
| `import-pdf` | Importar con IA → explicar ANTES de abrir archivos que elegir PDF inicia la carga automáticamente y crea datos → Buscar archivos → PDF válido → estado de procesamiento → resultado → Ver mi catálogo |
| `import-photos` | Importar con IA → explicar fotos legibles, menú completo y precios visibles → Tomar foto o Buscar archivos → archivos seleccionados → Analizar catálogo → procesamiento → resultado → Ver mi catálogo |
| `create-category` | Abrir Categorías → nombre → Añadir → API confirma categoría y lista la muestra → Listo |
| `create-product` | Nuevo producto → nombre obligatorio → categoría existente o sin categoría (opción de crear sin salir) → precio/costo opcionales → imagen opcional → disponibilidad si hay varios locales → Guardar → producto confirmado → Listo |
| `edit-product` | Mostrar Productos → usuario elige Editar en una fila → editor de ese id → nombre/categoría/precios → imagen y disponibilidad cuando corresponda → Guardar → actualización confirmada → Listo |
| `edit-category` | Mostrar Categorías → usuario elige Renombrar en una fila → input de ese id → Guardar → renombre confirmado → Listo |
| `delete-product` | Mostrar Productos → usuario elige Borrar → diálogo nombra ese producto y explica que es irreversible → usuario confirma Borrar → eliminación confirmada → Listo |
| `delete-category` | Mostrar Categorías → usuario elige Borrar → diálogo nombra esa categoría y explica que sus productos se conservan sin categoría y que no se puede deshacer → usuario confirma Borrar → eliminación confirmada → Listo |

Los campos de texto y pasos informativos avanzan manualmente. Guardar/Añadir/Confirmar no
ofrecen Siguiente para eludir la operación. Los campos opcionales ofrecen continuar sin
modificarlos; el tour no establece valores ni pulsa toggles. Crear categoría dentro del editor
es opcional y usa el mismo cliente/guard; no se ejecuta al explicar el selector de categoría.

### Selección y prerrequisitos

- Sin productos: editar/eliminar producto deshabilitados con «Primero creá o importá un
  producto». Sin categorías: equivalente para editar/eliminar categoría. Creación sigue visible.
- Sin `canDelete`: ayudas de eliminación deshabilitadas con «Solo el owner puede eliminar».
  El `DELETE` continúa protegido por la API; la UI no agrega una excepción para el tour.
- Con `importInProgress`: crear producto/categoría deshabilitados con motivo; importar ofrece
  «Ver importación en curso» usando el modal existente y una explicación del estado actual,
  sin recorrer picker inexistente. Editar/eliminar conservan su disponibilidad por rol.
- La selección es del usuario entre las filas visibles; nunca se elige automáticamente la
  primera coincidencia de un selector repetido. Mantener filtros; si ocultan todo, explicar
  cómo ajustarlos. Guardar `productId`/`categoryId` en el estado local del recorrido.
- Una entidad que desaparece tras refrescar termina la tarea con aviso y permite volver a
  elegir desde Ayuda. No cambiar silenciosamente el destino a otra fila.
- No iniciar mientras hay formulario/confirmación abiertos o una escritura en vuelo: explicar
  «Terminá o cerrá la acción actual para iniciar la guía». No descartar cambios del usuario.

### Importación móvil y estados asíncronos

- El picker nativo puede ocultar la página; avanzar al recibir archivos/estado de React,
  nunca al pulsar Buscar archivos o Tomar foto. Cancelar el selector deja el paso vigente.
- La cámara agrega una foto al conjunto actual; el selector general conserva su semántica
  actual de reemplazar el conjunto elegido. El copy no promete que ambas opciones agregan.
  En escritorio, ofrecer Buscar archivos y omitir el paso de cámara inexistente.
- Reutilizar el estado de `useCatalogImport` y sus transiciones, sin segundo polling. Si un
  PDF ya pasó a procesamiento o resultado al renderizar, ir a ese estado sin buscar Analizar.
- Procesamiento es un paso de espera con salida del tour disponible. No obliga a esperar más
  de 60 s buscando un resultado: el spotlight acompaña el estado visible. No ofrecer reenvío
  de `analyze` por timeout del tour ni botón ficticio de Aceptar.
- `accepted` con `result` muestra creados/reutilizados/omitidos/sin precio/descartados según
  DTO; el catálogo ya está escrito. Explicar que la corrección se hace editando en Catálogo.
- `failed`, `cancelled`, `expired` y errores de red mantienen el mensaje y acciones normales
  del importador; la ayuda se detiene con salida/reinicio explícitos. Cancelar importación es
  su botón operativo existente: no se ejecuta al cerrar el popover.
- Reabrir conserva la conducta 0093: el último `accepted` vuelve al picker. Una recarga no
  reanuda el tour ni conserva archivos locales. Si el servidor sigue procesando, abrir el
  modal retoma el import existente. No prometer que siempre reaparece el resumen anterior.

## Controlador, limpieza y accesibilidad

- Definiciones/copy/selectores en módulos de catálogo; estado local con modo, tarea, fase e
  id elegido. Separar funciones de decisión de efectos; anchors `data-tour` estables.
- Avanzar tras montar el modal/edición inline y después de resultado API. Los callbacks
  locales incluyen destino e instancia de recorrido para ignorar respuestas tardías. El
  evento global actual basado sólo en selector no identifica entidad/instancia: no usarlo
  como único guard del éxito. No usar `advanceOnClick` para escrituras asíncronas.
- Distinguir escritura exitosa y recarga fallida: mostrar «Se guardó, pero no pudimos
  actualizar la lista» y Reintentar lectura. No repetir POST/DELETE al reintentar esa lectura
  ni cerrar con una pantalla de éxito que muestre datos viejos como actuales.
- En acciones, Anterior no retrocede a una fase que repita una escritura ni reabre controles
  desmontados. Se admite volver entre pasos informativos/campos todavía presentes.
- Salir retira sólo el tour; conserva modal, archivos y edición. Cancelar el formulario o
  confirmación termina esa ayuda sin ejecutar la operación. Durante subida/procesamiento
  se mantienen las restricciones de cierre 0093 del modal, aunque se pueda salir del tour.
- Desmontar la página limpia Driver.js, listeners y timers del tour, sin llamadas de dominio
  ni guardar progreso por un cierre técnico. Si requiere ampliar el motor, opciones
  compatibles por default y pruebas de Staff/Locales. Restaurar el checklist en cierre y
  guardar/refrescar según causa; una limpieza técnica no equivale a Saltar voluntariamente.
- Diálogo de Ayuda con nombre accesible, Escape, foco inicial/retorno y navegación por teclado.
  Resolver interacción entre popover y focus trap del modal; el usuario puede acceder a ambos.
  Spotlight visible dentro del scroll del modal con teclado móvil abierto. Controles ≥44 px,
  desde 320 px, sin scroll horizontal; animación/scroll respetan movimiento reducido.
- Modificaciones de CSS acotadas a catálogo/tour; comprobar diálogos compartidos en claro y
  oscuro. No repetir el cambio global de fondo que rompió seis pantallas en la spec 0088.

## Archivos

Rutas relativas a `apps/merchant/src/app/`, salvo donde se indica otra raíz.

| Archivo | Acción |
|---|---|
| `backoffice/catalog/catalog-tour-{definitions,locales,controller,state}.*` | crear definiciones, copy, controlador y decisiones testeables |
| `backoffice/catalog/catalog-page.tsx`, `page.tsx` | integrar Ayuda, orientación, permisos, selección y resultados |
| `backoffice/catalog/{catalog-list,products-tab,category-manager,product-editor}.tsx` | anchors y callbacks ligados a entidad; copy de confirmación |
| `backoffice/catalog/{catalog-ai-import,catalog-ai-import-picker,catalog-ai-import-result}.tsx` | anchors y transiciones del importador |
| `backoffice/catalog/{use-catalog,use-catalog-import}.ts` | propagar resultado/recarga y observar estado sin requests duplicados |
| `backoffice/onboarding/{onboarding-view,onboarding-tour,onboarding-checklist}.*` | publicar catálogo y gestionar inicio/fin, progreso y limpieza |
| `components/tour-events.ts`, `globals.css` | lifecycle compatible y estilos acotados |
| Pruebas junto a esos módulos; `tests/e2e/catalog-tours.spec.ts` | unidad/cableado y navegador con API controlada |

**Disjunta: no.** Comparte catálogo, motor de tours, checklist y CSS. Claude Code no modifica
estos archivos para esta spec; cualquier arreglo API concurrente se coordina por contrato.

## Definition of Done y verificación

Casillas marcadas: evidencia automatizada de UI con HTTP controlado; no equivalen a
validación de la página autenticada o de dispositivo. Los criterios compuestos con partes
no ejecutadas conservan su casilla abierta. Detalle en handoff.

- [x] Checklist navega al catálogo y arranca exactamente los cuatro pasos, incluso vacío;
  no hay llamadas de dominio durante orientación; `completed`/`skipped` sólo por owner.
- [x] Las ocho ayudas son accesibles y ninguna hace POST de progreso, al terminar ni al salir.
- [x] Tests de cableado verifican selección de la segunda entidad, no sólo la primera;
  misma entidad en formulario, request y confirmación; permisos/prerrequisitos visibles.
- [ ] Guardar fallido/validación/cancelar selector no avanza; éxito avanza una vez; callbacks
  tardíos no avanzan otra tarea. Recarga fallida reintenta GET y no repite la escritura.
- [ ] PDF salta directamente a procesamiento/resultado; fotos esperan Analizar; retomar import
  evita picker inexistente; fallos y cancelación se distinguen de salir del tour.
- [x] Borrado requiere confirmación real que nombra entidad; categoría conserva productos.
- [x] Error de persistencia se muestra y reintenta el mismo estado; checklist se recupera.
- [ ] Navegación/desmontaje limpian tour/listeners; no writes por limpieza, sin relanzamiento
  accidental; iniciar una ayuda después de cerrar otra funciona. Staff/Locales sin regresión.
- [ ] Playwright prueba contra la página real con sesión y API controladas, sin IA ni datos
  de producción: orientación, una creación/edición con fallo y éxito, ambos borrados, PDF,
  fotos, import existente y salida durante análisis. Incluye ancho móvil y teclado de escritorio.
  Navegar al merchant local (puerto 3001, no el `baseURL` 3000 de consumer). Usar sesión real
  de owner/staff de prueba en una rama DB de desarrollo aislada; `page.route` controla sólo
  requests del navegador y no suplanta el guard server-side de `page.tsx`. Preparar fixtures
  en el setup de tests sin agregar endpoints de producción ni modificar la autorización.
  Si faltan fixtures, registrar esos casos como no ejecutados; health verde no los sustituye.
- [ ] QA real iOS/Android: cámara, selector PDF/fotos, teclado abierto, scroll/modal, retorno
  al cerrar ayuda; claro/oscuro y movimiento reducido. Registrar dispositivo y resultado.
- [ ] Gates root, Node 24, una vez al final: `pnpm run typecheck`, `pnpm run lint`,
  `pnpm run test`, `pnpm run format:check`, `pnpm run build`, `pnpm run test:e2e`.

**Presupuesto de revisión: 6 mutaciones de errores plausibles** (máximo dos rondas si hay
correcciones). Objetivos: ayuda persiste, avance por clic pese a error, entidad equivocada,
salir cancela import, borrar sin confirmar y progreso fallido fingido como guardado.
Son objetivos para el código futuro, **no una tabla de mecanismos/oráculos ya existentes**.
Después de implementar, localizar archivo/línea de cada mecanismo y ejecutar primero sus
pruebas; sólo entonces registrar y medir cada mutación con el protocolo del repo. Un test
puro no sustituye al test que comprueba que la pantalla invoca la regla.

Condición de corte: dos rondas consecutivas donde corregir descubre otra rotura obligan a
declarar el resto y llevarlo a QA; no abrir una tercera ronda automática. Calidad de extracción
IA, entregabilidad externa y carreras reales entre sesiones quedan fuera de estos oráculos
de UI. La selección nativa/cámara se valida en dispositivo, no se da por probada con `setInputFiles`.

## Handoff y estado

Codex es el único implementador de UI para toda la spec. Revisión independiente al terminar,
con evidencia ejecutada y límites declarados antes de marcar `implementada` (ADR 0071).
Claude Code conserva el backend; no tiene un encargo de implementación pendiente por esta spec.
La aprobación del owner cierra el alcance; no hay bloqueantes de producto abiertos.

Verificación del cierre documental previo a la implementación: lectura de rutas, guards,
clientes y contratos. Ese cierre no ejecutó tours ni gates porque todavía no modificaba
código. La evidencia de la implementación posterior está en el addendum y el handoff.
El contrato 0090 conserva descripciones viejas de la UI (un archivo y resumen al reabrir): para
esas conductas de pantalla prevalecen las specs 0093–0095 y el código actual medido arriba;
para requests, DTOs y errores HTTP sigue siendo la referencia. No se cambia ese contrato API
desde este encargo de UI.

## Addendum de implementación — 2026-09-25

UI completa implementada por Codex sin cambiar API, servidor ni schema. Los oráculos de
navegador montan componentes reales, Driver.js, ReactAria y CSS compilado con respuestas
HTTP controladas. Los smoke tests de página autenticada existen pero requieren sesiones
owner/staff de desarrollo; están omitidos en este checkout. No se sustituyen por health
ni se marca la DoD de página real o QA nativo como cumplida.

Resultados ejecutados, seis defectos plausibles y restauración documentados en
[handoff](../archivo/spec-0096-handoff-ui.md) y
[bitácora](../archivo/spec-0096-bitacora-de-mutaciones.md). La spec conserva `cerrada`
con [PASS independiente de la UI verificable](../archivo/spec-0096-revision-ui.md);
la DoD completa continúa pendiente de sesiones auténticas y dispositivos reales.
Implementación en `3c9be45`, pusheada a `origin/main` por instrucción del owner.
El despliegue de producción no está verificado.

## Addendum de QA — separación de Ayuda (2026-09-25)

Pedido aprobado por el owner: separar el botón Ayuda de la tarjeta Carga inteligente.
La página de catálogo usa flujo normal; `.staff-help-button` sólo tiene margen superior y
`.catalog-ai-banner` no tiene margen superior. Añadir 18 px de margen inferior a Ayuda
con selector acotado a `.catalog-page`, coherente con el espaciado del resumen.
Verificar distancia visible en móvil/escritorio y los seis gates; revisión independiente
acotada al CSS. Presupuesto de nuevas mutaciones: cero, cambio visual reversible.

Verificado: separación medida en Chromium de 0 → 18 px a 390 px y 1280 px, con UI y
CSS reales y API controlada. PASS independiente de `/root/review_catalog_spacing`,
reproducido por el implementador. Sin cambios en Ayuda de Staff/Locales.
Gates root Node 24: typecheck, lint, test, formato, build y Playwright exit 0;
1789 tests passed / 595 skipped; navegador 21 passed / 3 skipped.
