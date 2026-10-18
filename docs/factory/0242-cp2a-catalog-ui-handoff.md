# 0242 — CP2a.7 catálogo UI: entrega

Implementación local, sin publicación. Rama `catalog-ui-0242`, worktree
`/private/tmp/checkpass-pos-0242/catalog-ui-0242`, base
`2c05f4db35330f6ffbd5ee256a6b1312bca03bce`. Código final:
`5c31ea38b9de66ac62acd9598a28fba33643003c`; el commit de este handoff añade
documentación. Ficha y contrato §1–2 ya comprometidos antes del código.
Ampliaciones del coordinador: `132e1c7e` autoriza corregir únicamente
`CatalogUpdateV2.expectedSalesRevision` a string; `ddee0a4f` autoriza el contexto
BackofficeProvider del harness existente. No se movió la base ni se incorporaron
ramas ajenas.

## Resultado

- GET catálogo y CRUD producto usan X-Catalog-Contract:2. Tarifas string/null;
  precio vacío es null y cero es válido. Parser aceptado de nueve decimales,
  sin exponentes/comas ni captura fuera del límite. Una tarifa histórica alta
  intacta se conserva literalmente. Formato visible con BigInt/fracción original,
  sin perder precisión significativa bajo las cifras monetarias habituales.
- Checkbox y selector del kit, unidad habilitada por negocio, labels por
  kilogramo/libra/gramo. Nuevo producto unit; cambiar selector no convierte tarifa.
  Se conservan categorías, locales, imagen, importInProgress y recorridos existentes.
- PUT conserva la revisión abierta hasta revisión explícita del conflicto.
  Se muestran nombres de categoría/locales y etiquetas legibles. Reconciliación
  conserva campos editados, adopta campos intactos y muestra solapamientos.
  Medida y tarifas forman un bloque cuando cambia la medida en cualquiera de
  las versiones, para impedir reinterpretar una tarifa local bajo otra unidad.
  Sin cambio de medida, precio y costo se pueden reconciliar por separado.
- Sin retry de escritura. Un conflicto/422 conserva borrador e imagen.
  Producto ausente nunca se convierte en alta. Red/5xx exige lectura autoritativa
  antes de otra escritura; el bloqueo sobrevive a cerrar/descartar un alta incierta.
  La lectura fallida tras escritura confirmada se reintenta sin repetir POST/PUT.
  Ref síncrona bloquea doble envío. 401/403 retira catálogo/editor y no anuncia éxito.
- listCatalog solo agrega salesMassUnits V2 de business_configuration del tenant,
  default kg si falta la fila, sin insertar configuración ni GET business.
  V1 conserva su shape. Writers, guards, esquema y barreras no se reescribieron.

Archivos: los seis archivos de catálogo types/use-catalog/use-catalog-actions/
product-editor/catalog-list/catalog-page; nuevos catalog-product-draft.ts y su test;
core.ts solo proyección; contracts.ts solo tipo; catalog-v2.neon.integration.test.ts
solo metadata; catalog-measures.spec.ts; fixtures catalog-api y catalog-harness;
catalog-tour-crud solo recuperación/expectativas afectadas; este handoff.
Sin dependencias, kit, guards, tooling, estados, índices ni importación IA/imagen backend.

## Evidencia observada

Logs completos fuera del WT:
`/private/tmp/checkpass-pos-0242/catalog-ui-0242-evidence/`.
Cada log contiene SHA, comando exacto, UTC, stdout/stderr completo y exit.
Node24.20.0 y dependencias propias existentes; hooks `.githooks`.

- `types-merchant-cac3.log`, `lint-cac3.log`, `format-cac3.log`,
  `ui-guard-cac3.log`: exit0 en cac3d766. Guardia UI ocho archivos sin aumentos.
  `unit-cac3.log`: cinco tests puros PASS de parseo/formato/reconciliación,
  incluido cruce de medida y tarifas.
- Tipos domain/db exit0 en 4254e4c4; domain volvió a pasar en
  `domain-types-ecd8.log` tras la única anotación MassUnit[] posterior.
  Merchant cac3 cubre todo el runtime final. Cambios posteriores son pruebas,
  documentación e import/assertion de tipo borrados en runtime.
- `affected-ecd8.log`, `tests-lint-5c31.log`: lint de archivos posteriores exit0.
  `format-final.log`: formato focal final exit0.
- `guards-cac3.log`: límites de módulos **24 PASS / 2 FAIL** del backlog conocido,
  más 38 PASS de guardias catálogo (62 PASS / 2 FAIL totales). Fallos:
  expenses→stock y los cinco archivos de literales core ya conocidos.
  El literal nuevo de enlace fijo a Recetas observado en 4254 fue retirado.
  No se modificaron guardias ni se presenta este resultado como verde global.
- `http-cac3.log`: wrapper seleccionado por root, recurso CI exclusivo,
  suite catalog-v2.neon.integration.test.ts --no-file-parallelism,
  **10/10 PASS, exit0 y teardown completo**. Default kg sin inserción; lista
  configurada; staff catalog sin business; tenant/auth/V1/no-store V2;
  barreras reales mass/precisión rechazadas sin efectos. Entorno seleccionado
  `/private/tmp/checkpass-pos-0242/private/ci.env`, sin copiar ni imprimir secretos.
  Recurso liberado por coordinador tras teardown. No más DB.
- `browser-cac3.log`: **13 PASS / 3 FAIL, exit1**, no batería verde.
  Fallaron dos altas por guía abierta interceptando el control y una expectativa
  de error que encontraba toast y formulario. Los trece casos compatibles se
  conservan como evidencia.
- `browser-ecd8.log`: **1 FAIL / 2 no ejecutados**, sin aprobación por skip.
  El runner intentó clicar el input oculto del CheckboxField, cuyo target visible
  es su label. Se cambió al clic real de label con aserción checked.
- `browser-5c31.log`: **6 PASS, exit0**, solo recorridos afectados:
  payload exacto/selector/labels, alta incierta con descarte y lectura fallida,
  conflicto de categoría/locales/imagen, recuperación de tour edición y dos
  regresiones de borrado. Sin fuerza de clic, sin retries. No se afirma una
  ejecución completa final de dieciséis tests: evidencia compuesta de las rondas.
- El fallo inicial `browser.log` (interrumpido) y `debug.log` documentan el harness
  previo sin BackofficeProvider. Diagnóstico exit0 no equivale a PASS producto.
  La ampliación autorizada corrige únicamente el montaje de la fixture.
- Capturas `catalog-editor-390.png` y `catalog-editor-1280.png`, generadas juntas
  en 5c31ea38 y abiertas. Identidad Operate existente, campos legibles sin desborde
  horizontal; modal conserva su scroll. No hubo edición visual ni ronda extra.

## Límites y entrega

Los browsers usan UI/Driver/CSS reales en el harness y API controlada del contrato
futuro. No son guardado auténtico mass en DB: las constraints temporales siguen
activas hasta CP2c; no se activó producer4 ni se publicó. HTTP real sí conserva las
barreras. No smoke autenticado mass ni prueba PROD.

Código y documentación propios comprometidos; sin procesos propios activos al
handoff (comprobación acotada en `processes-final.log`). Sandbox Git/ps EPERM fue
avisado al coordinador y resuelto con escalación acotada a worktree/ref propios y
consulta de procesos; nunca se tocaron refs principales. Sin push/PROD.
QA independiente y factory/integración/cleanup quedan al coordinador; este autor
retiene disponibilidad para fixes de su entrega.
