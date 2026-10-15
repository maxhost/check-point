---
spec: 0229
fecha: 2026-10-14
estado: implementada
resumen: Guardar tres datos fiscales por comercio en Marca, sin usarlos hoy en precios, cobros ni costos.
disjunta: si entre dominios; esquema0228/0229 serializado por A, sin dependencia de cálculo fiscal.
archivos: packages/db/src/schema/business.ts; packages/domain/src/server/brand.ts y brand/; apps/merchant/src/app/api/brand/route.ts; apps/merchant/src/app/backoffice/brand/; pruebas focales de Marca; futura migración generada de packages/db.
---

# 0229 — Datos fiscales del comercio en Marca

Pieza 1.2. Piso L2; ADR0144 y `docs/VERIFICACION.md`. **Este encargo entrega solamente la spec:** no implementa código, no genera ni ejecuta migraciones, no modifica `INDEX`, `TASKS` ni estados y no autoriza publicación.

## Problema

Marca permite editar nombre, identidad visual, zona horaria y moneda, pero no conserva si el comercio cobra IVA, su tasa de venta ni si recupera IVA de compras. `core.business` ya tiene `country_code`, pero ninguno de esos tres datos (`packages/db/src/schema/business.ts`). La pantalla termina con Configuración regional y Guardar marca (`apps/merchant/src/app/backoffice/brand/brand-page.tsx`).

Se necesitan esos datos para dos funciones futuras diferentes: venta con IVA facturado en POS y estimación del IVA recuperable de compras. Guardarlos hoy **no activa esas funciones**.

## Alcance y diseño

### Decisiones cerradas y respuestas del owner

Los tres datos pertenecen al comercio, nunca a un local, producto o insumo. El modelo no se ata a un país ni deriva valores fiscales de `country_code`.

El catálogo y el POS siguen sin IVA. El costo del insumo es lo que pagó el comerciante, **IVA incluido**: no se desglosa ni se resta IVA y no se lee ningún dato fiscal del comercio para calcularlo. Esto también rige para el promedio ponderado de la pieza 1.1/spec0228. Los datos de esta spec no entran hoy en ningún cálculo.

Preguntas presentadas antes de escribir; respuesta del owner: **«1. acepto. 2. acepto. 3. si»**.

| Pregunta y recomendación presentada                                                                                                                                                           | Respuesta y regla cerrada                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Defaults para comercios existentes y nuevos: no cobra IVA, no recupera IVA y tasa sin cargar; sin inferir del país.                                                                        | «1. acepto»: `false`, `false`, `null`, respectivamente, para ambos grupos. Son valores iniciales editables; no una certificación de la situación fiscal. |
| 2. Tasa obligatoria cuando cobra IVA; rango inclusivo 0–100 %, hasta dos decimales exactos. Al desactivar, conservar la tasa y deshabilitar el campo; puede ser `null` mientras no cobra IVA. | «2. acepto»: todas estas reglas. Al reactivar debe haber una tasa válida; no completar automáticamente.                                                  |
| 3. Sección Datos fiscales después de Configuración regional y antes de Guardar, con los textos de abajo y aviso explícito de que hoy no afecta precios ni costos.                             | «3. si»: ubicación, labels y ayuda aceptados.                                                                                                            |

### Persistencia y migración futura

Agregar tres columnas a `core.business`, junto a los datos de configuración del comercio:

| Propiedad de dominio/HTTP | Columna y tipo propuesto                                    | Default |
| ------------------------- | ----------------------------------------------------------- | ------- |
| `chargesVat`              | `charges_vat boolean NOT NULL`                              | `false` |
| `saleVatRate`             | `sale_vat_rate numeric(5,2) NULL` — porcentaje, no fracción | `null`  |
| `recoversPurchaseVat`     | `recovers_purchase_vat boolean NOT NULL`                    | `false` |

Restricciones DB: tasa `NULL` o dentro de `[0, 100]`, valor decimal finito; si `charges_vat = true`, tasa no nula. Los booleanos son independientes: recuperar IVA no obliga a cobrarlo. `0.00` es una tasa cargada válida y **no equivale a `null`**.

La implementación futura generará una migración aditiva con esos defaults para todas las filas existentes y altas nuevas. No consulta tablas de movimientos, tasas nacionales ni datos externos; no reconstruye historial ni cambia precios, costos, saldos o `country_code`. No modifica migraciones ya aplicadas. La validación de entrada rechaza exceso de precisión antes de guardar: no confiar en el redondeo implícito de `numeric(5,2)`. Defaults y restricciones son compartidos por cualquier writer de alta del comercio.

No se crea otra tabla ni un dato por local. La nueva configuración participa en el mismo `brandRevision` y `updatedAt` que el resto de Marca.

### Contrato HTTP, validación y permisos

Extender **las rutas existentes** `GET /api/brand` y `PUT /api/brand`, los select/returning de `packages/domain/src/server/brand.ts`, `BrandRecord`, su validador y el DTO `Brand` del merchant. No agregar una API fiscal aparte.

- GET y PUT exitoso: DTO privado de Marca con los tres campos; booleanos JSON estrictos y `saleVatRate` como string decimal canónico de dos decimales (`"15.00"`, `"0.00"`) o `null`. No serializar un float; el porcentaje se representa y valida con decimales exactos/enteros escalados a dos decimales.
- PUT: conserva el payload de Marca y `revision` obligatoria. Cada campo nuevo puede omitirse por compatibilidad con clientes anteriores; **omisión conserva el valor guardado**, sin restablecer defaults. La UI actualizada envía los tres.
- Booleanos presentes: únicamente `true` o `false`; rechazar strings, números y `null`, sin coerción.
- Tasa presente: `null` o string de dígitos decimales con punto y hasta dos decimales, dentro de `[0, 100]`. Rechazar vacío, negativos, exponentes, `NaN`, infinitos, número JSON y más de dos decimales; no truncar ni redondear una entrada inválida. Canonizar al responder. La UI transforma una entrada válida de su campo decimal al formato del contrato sin aritmética flotante.
- Validar el **estado resultante completo**, combinando campos presentes y valores conservados. `chargesVat=true` con tasa nula es inválido incluso si la tasa se omitió; tasa nula con `false` es válida. Con `false`, una tasa explícita válida puede guardarse por API, pero desactivar por sí solo nunca borra la tasa.
- Actualización atómica con id del comercio y revisión esperada: un guardado no mezcla configuraciones de dos sesiones. Revisión obsoleta devuelve `409` y conserva todos los valores; validar y escribir sobre la misma versión, no aplicar un merge ciego después de otra edición. Mantener el flujo existente para consultar/adoptar versión guardada y recuperar el borrador.
- `400` para JSON malformado, `422` para datos inválidos, `409` para conflicto y las respuestas de autenticación/permisos existentes; errores accionables en tuteo, por ejemplo «Ingresa una tasa de IVA entre 0 y 100, con hasta dos decimales» y «Ingresa la tasa de IVA de venta para guardar».

Se conserva el permiso `brand` actual: persona propietaria y equipo delegado con ese permiso pueden leer/editar estos datos; no se introduce una excepción owner-only. `requireApiPermission(request, "brand", ...)` resuelve el comercio, y su id viaja a la lectura y al writer (ruta actual, GET/PUT). El body no puede elegir otro comercio; no incorporar `businessId` del cliente al destino de escritura. Conservar los demás guards de sesión, membresía y cuenta existentes.

Estos campos se exponen sólo en el DTO privado de Marca. No propagarlos a respuestas públicas, Wallet, consumer, catálogo o DTO de venta; `brandResponse` sigue excluyendo claves internas de R2. No importar Stock/Recipes/POS ni `modules/decimal.ts` a core: la validación decimal de Marca vive en dominio/Marca. No agregar enganches de cálculo para estos flags.

### Marca

Agregar sección **Datos fiscales** después de Configuración regional y antes de Guardar marca, usando componentes del kit vigente, sin abrir un guardado distinto ni nuevas reglas visuales.

- «¿Cobras IVA?» — sí/no.
- «Tasa de IVA de venta (%)» — campo decimal; obligatorio y habilitado cuando cobra IVA. Al desactivar se muestra la tasa conservada, con el campo deshabilitado; si nunca hubo una, permanece vacío. Rehabilitar no elige una tasa.
- «¿Recuperas el IVA de tus compras?» — sí/no, independiente del anterior.
- Ayuda visible: **«Guardamos estos datos para funciones futuras. Hoy no cambian los precios del catálogo, los cobros del POS ni los costos de tus insumos».**

Los cambios participan en el mismo borrador, Guardar marca, estados de carga/error, bloqueo durante guardado o falta de acceso y recuperación de conflicto. Una recarga recupera lo persistido; un error conserva el borrador. No añadir cálculos, estimaciones fiscales, tasas por país ni efectos sobre la vista previa de marca.

### Fuera de alcance y filas propuestas para TASKS

Fuera: cualquier cálculo con estos datos, venta o facturación con IVA, desglose/resta del IVA de compras, tasas por categoría/insumo/producto, integración con organismos fiscales o inferencia de reglas por país. Las siguientes son **dos filas propuestas para que el owner agregue a `docs/TASKS.md`**, no se edita ese archivo. No constituyen autorización de implementación futura:

| Tarea futura propuesta                    | Datos disponibles y finalidad                                                                                                                                                                      | Decisiones por cerrar antes de implementar                                                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Venta con IVA facturado en POS            | Usar `chargesVat` y `saleVatRate` del comercio cuando se diseñe la venta con IVA facturado.                                                                                                        | Hallazgo a decidir: alcance fiscal/facturación, tratamiento y presentación de precios, redondeo, persistencia histórica y requisitos por país. Spec propia; hoy no implementada ni autorizada por 0229.      |
| Estimación del IVA recuperable de compras | Usar `recoversPurchaseVat` para estimar más adelante cuánto IVA recupera el comercio según sus compras y tasas por categoría publicadas por el organismo fiscal correspondiente (SRI, ARCA, etc.). | Hallazgo a decidir: fuentes y vigencia de tasas por categoría, clasificación de compras, reglas de recuperabilidad y presentación de la estimación. Spec propia; hoy no implementada ni autorizada por 0229. |

## Archivos y paralelismo

El único archivo entregado ahora es esta spec. Para implementación futura: esquema `packages/db/src/schema/business.ts` y migración generada; dominio `packages/domain/src/server/brand.ts`, `brand/core.ts`, `brand/validation.ts`; ruta `apps/merchant/src/app/api/brand/route.ts`; UI `apps/merchant/src/app/backoffice/brand/` (DTO, borrador, campos y recuperación); pruebas focales de esas capas.

Un writer de esquema/migración y un contrato HTTP compartido. Antes de código, el coordinador asigna paths y recursos y serializa cualquier modificación común de esquema/journal o DB de pruebas. La spec0228 es independiente: el promedio de insumos no consulta esta configuración. Las dos filas futuras quedan propuestas aquí; ningún worker edita índices, TASKS ni estados comunes. No se necesita un ADR nuevo para extender la configuración y el contrato de Marca ya existentes.

## Definition of Done

Los criterios siguientes corresponden a la **implementación futura**, no se declaran cumplidos por entregar este documento:

- [x] Tres datos por comercio con defaults y restricciones acordados; existentes y nuevos quedan consistentes.
- [x] Sección, textos, habilitación, guardado/recarga y recuperación de Marca cumplen lo aprobado.
- [x] GET/PUT privados preservan compatibilidad, permiso `brand`, aislamiento y control de revisión.
- [x] Precios, cobros, costos y consumidores públicos permanecen ajenos a estos datos.
- [x] Pruebas focales y aceptación de tarea/combinación sobre SHA verificable; sólo entonces el coordinador podrá marcar implementada.

## Pruebas pertinentes

Mínimas para cuando se implemente, reutilizando `brand.test.ts`, `brand.neon.integration.test.ts`, `permisos-brand-loyalty.neon.integration.test.ts`, validación/DTO y pruebas de la pantalla:

1. **Defaults reales DB:** negocio previo migrado y alta nueva dan `false/null/false`; no dependen de país. Restricciones rechazan tasa fuera de rango y cobrar sin tasa. DB sólo por `tools/neon-test.sh`, entorno protegido reservado; DDL sin concurrencia.
2. **Validación:** aceptar extremos `"0"`/`"100.00"`, dos decimales y `null` cuando no cobra; rechazar tasa ausente resultante al cobrar, rangos inválidos, exceso de precisión, coerción de booleanos y formas no decimales. Verificar `null` frente a `"0.00"` y canonicalización exacta.
3. **Contrato/atomicidad:** PUT/GET persisten los tres; cliente legacy que omite campos los conserva. Desactivar conserva tasa, reactivar exige válida. Dos ediciones con misma revisión: la segunda devuelve `409`, sin perder configuración fiscal ni sobrescribir otros campos.
4. **Aislamiento y permiso reales:** sesiones de dos comercios con valores diferentes sólo leen/escriben su comercio, incluso intentando indicar otro id en el payload. Equipo con `brand` puede; sin permiso no puede, sin cambios persistidos. Confirmar DTO público sin campos fiscales.
5. **UI:** ubicación y ayuda visibles; tasa vacía/habilitada/obligatoria según estado, conservación al desactivar y al fallar guardado, payload correcto, recarga y consulta/adopción tras conflicto. Aprovechar el flujo existente de Marca; browser de componentes para interacción y API/DB para cableado y permisos.
6. **Sin efectos de cálculo:** guardar configuraciones fiscales diferentes no cambia un precio de catálogo, total de una venta comparable ni costo de un insumo. Regresión focal de los consumidores pertinentes y comprobación de que no leen estos campos; no crear un cálculo fiscal para probar esta pieza.

Hoy sólo se verifican integridad y formato del documento, unicidad del número y alcance del diff; no se afirma PASS de producto, DB o UI sin implementación.

## Handoff y abierto

Spec cerrada por las respuestas citadas, pendiente de encargo de implementación. La ficha operativa conserva base, worktree, reserva y SHA de entrega; esos datos no forman parte del contrato del producto. No hay hallazgos bloqueantes en esta pieza. Los hallazgos de las dos filas futuras permanecen **a decidir** y no se atribuyen al owner como reglas aprobadas.

El encargo termina al entregar esta spec y las filas propuestas. No ejecutar su migración, modificar código, integrar/pushear ni marcar implementada por esta entrega.

## Implementación y aceptación — 2026-10-14

Implementación autorizada posteriormente por el [handoff0228/0229](../handoff-0228-0229-implementacion.md), conservando las decisiones funcionales anteriores. Producto combinado verificado `07393f2cacbad43cc3d92fd98b028ab1f8ff8a70`, entrega A `bc9b29bd674452e11f70943f06850be0d2bb277e` y B `4b25cfabf857c480400c475f4aaa2d4a61579b35`; [informe QA independiente](../factory/0228-0229-qa.md), [entrega A](../factory/0228-stock.md), [entrega B](../factory/0229-brand.md). QA funcional y combinación PASS:29DB afectados y1probe fiscal bruto independientes,77unitarios, tipos/lint/guardias y build Merchant; browser23 y visual390/1280, API/DBMarca20, DDL3 y regresiones compatibles de autores según identidad registrada. Cierre documental final comprobado separadamente; ningún PASS por skips/retries ni cambios de presupuestos.

Migración0084 aplicada sólo a CI protegida; conserva EXPAND0227, flag de consumo y costo bruto IVA incluido. No publicación, seed ni migración PROD. Main local permanece anterior hasta autorización explícita del owner. Las restricciones iniciales de entrega documental describen el encargo original; esta implementación se autorizó por el handoff citado, sin habilitar funciones fiscales futuras.
