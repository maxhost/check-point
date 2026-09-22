---
adr: 0082
fecha: 2026-09-21
estado: aceptada
resumen: La IA nunca escribe el catálogo directamente: analiza archivos temporales y produce un borrador revisable; la aceptación idempotente crea categorías y productos en una sola transacción. El dominio depende de un contrato de extracción propio, no de OpenAI, Anthropic, Kimi ni de sus formatos, y los originales se borran al aceptar, cancelar o vencer. Enmienda del 2026-09-21 (seis decisiones, §8-§12): el trabajo largo NO corre en nuestra funcion —el adaptador delega en el proveedor (`background: true`) y lo retomamos por un callback firmado, con el scheduler externo como reconciliador—, `missing` nace sin precio y no bloquea, el limite de analisis es un valor centralizado con ventana (1/dia, los fallos no lo consumen), el PDF se cuenta con `node:zlib` sin dependencias, y se avisa por email al terminar.
---

# 0082 — Importación de catálogo con IA agnóstica y borrador revisable

## Contexto

El catálogo de la spec 0034 se carga producto por producto. Para un comercio que ya tiene un menú
en PDF o papel, esa fricción está justo al principio: puede tomar fotografías con el teléfono o
subir un archivo, pero hoy debe volver a tipear categorías, nombres y precios.

La extracción visual es probabilística. Confundir `$3,50` con `$35,00`, fusionar dos columnas o
inventar una categoría no puede convertirse en escritura automática. También sería un lock-in
innecesario hacer que las rutas o el dominio hablen en términos de `response_id`, tools o esquemas
propios de un proveedor. El rendimiento relativo de GPT, Claude, Kimi u otros cambia; la elección
debe poder cambiar sin migrar datos ni reescribir la API móvil.

Hechos del sistema: el catálogo ya está aislado por `business_id`; `catalog` autoriza lectura,
creación y edición, pero el borrado duro sigue reservado al owner (ADR 0079/spec 0086); existe R2
privado, subida firmada, limpieza diferida e imágenes normalizadas (ADR 0029); los secretos viven
en entorno (ADR 0024); y Vercel no es el canal para transportar archivos grandes.

## Decisión

### 1. La IA produce un borrador; nunca escribe el catálogo

El análisis termina en un recurso `catalog_import` revisable. Sólo una acción explícita de
`accept` crea categorías y productos. La aceptación revalida el borrador, exige que no queden
precios ambiguos sin resolver y corre en una única transacción. Un error no deja medio catálogo.

### 2. Contrato propio y proveedor intercambiable

El dominio consume `CatalogExtractionProvider`, cuyo resultado normalizado contiene categorías,
productos, precio detectado, estado del precio, fragmento fuente y advertencias. Cada adaptador se
encarga de archivos, Structured Outputs equivalentes, errores, timeouts y métricas de su proveedor.

La salida se valida siempre contra el esquema propio del servidor aunque el proveedor garantice
JSON Schema. Proveedor y modelo se eligen por configuración de servidor; el navegador no los
elige. La primera entrega incluye `fake` y un adaptador real `openai`; Anthropic, Kimi u otros son
adaptadores posteriores, no cambios de contrato. El modelo concreto no vive en el dominio y puede
cambiar por entorno después de una evaluación reproducible.

### 3. Archivos privados y efímeros

El cliente sube directo a R2 con URL firmada. La API nunca recibe el cuerpo grande del archivo.
Los objetos son privados y sólo existen mientras el import está abierto. Se borran al aceptar,
cancelar o vencer a las 24 horas; una cola de limpieza idempotente cubre fallos parciales. Si un
adaptador crea un archivo remoto, debe borrarlo en `finally` y registrar sólo su resultado.

No se conserva el PDF o fotografía como activo del negocio ni como imagen de producto.

### 4. Proceso asíncrono y estados observables

El análisis no mantiene una petición móvil abierta. `analyze` encola y responde `202`; un worker
toma el trabajo y el cliente consulta el recurso. Hay un solo import activo por negocio para
evitar carreras y llamadas duplicadas. Reintentar la misma transición es idempotente.

Estados cerrados: `pending_upload → queued → analyzing → ready → accepted`, con salidas terminales
`failed`, `cancelled` y `expired`. Ninguna transición terminal vuelve atrás.

### 5. Los duplicados se resuelven en el borrador, nunca borrando existentes

El servidor marca coincidencias exactas normalizadas contra el catálogo actual; no fusiona por
similitud. Un producto detectado puede descartarse, renombrarse o importarse como nuevo. Una
categoría coincidente puede mapearse a la existente; al descartar una categoría, el merchant debe
mandar sus productos a otra categoría, dejarlos sin categoría o descartarlos también.

La importación no edita ni borra productos/categorías existentes. La historia del catálogo y los
snapshots de ventas de la spec 0030 quedan fuera de riesgo.

### 6. Precio ambiguo visible y bloqueante

Un precio que el modelo no puede confirmar se normaliza a `0`, conserva el texto observado y lleva
`priceStatus: "ambiguous"`. La UI lo muestra en rojo. Aceptar queda bloqueado hasta que el merchant
escriba otro precio o confirme expresamente que cero es correcto; el número por sí solo no prueba
esa intención.

### 7. Sin cuota comercial en esta entrega

La capacidad no depende todavía del plan ni tiene una cuota de importaciones. Permanecen controles
operativos, no comerciales: un análisis activo por negocio, idempotencia, límites de archivo y el
rate limit común de escrituras. Un plan o cuota futura requiere su propia decisión de producto.

## Consecuencias

- Nacen tablas efímeras de importación y archivos, una cola de proceso y una de limpieza.
- La API es consumible por web o una app móvil: todas las transiciones se expresan por HTTP y el
  progreso no vive sólo en React.
- Cambiar de proveedor no cambia DTO, rutas ni tablas. Sí requiere un adaptador y ejecutar el mismo
  corpus de evaluación.
- Se registran proveedor, modelo, versión de prompt/esquema, duración y uso/costo reportado, pero no
  el original después de terminar.
- Los productos aceptados nacen disponibles en todos los locales. La edición masiva por local es
  otra feature.

## Referencias

- ADR 0017 — estándar production grade.
- ADR 0024 — secretos en entorno.
- ADR 0029 — assets privados, subida firmada y limpieza idempotente.
- ADR 0034 / spec 0034 — catálogo por negocio y snapshots históricos.
- ADR 0035 — precedente de proveedor intercambiable con variante `fake`.
- ADR 0079 / spec 0086 — permiso `catalog` y borrado duro reservado al owner.


## Enmienda del 2026-09-21 — seis decisiones que la revisión contra el árbol obligó a tomar

La spec 0090 se revisó contra el árbol antes de implementarla y aparecieron siete bloqueantes.
Cinco eran de la spec y se arreglan ahí; **estos seis son decisiones de arquitectura o de producto
y por eso viven acá.** El caso completo, con la evidencia de cada medición, está en
`docs/LECCIONES.md`.

### 8. El análisis no corre en nuestra función: corre del lado del proveedor

La decisión §4 («análisis asíncrono, un worker toma el trabajo») **no era implementable en este
plan**: `apps/merchant/vercel.json` ya tiene los **2 crons** del máximo de Hobby y sólo admite
frecuencia diaria — un tercero, o un `*/5`, hace que Vercel **rechace el deploy entero** (medido,
en la skill `gotchas-del-repo`). O sea que `queued` no tenía quién lo levantara. Y el techo de
**60 s** por invocación (`marketing-tick/route.ts:11`) no alcanza para leer 50 MB de R2, correr
diez `sharp` y esperar una llamada de visión sobre diez páginas.

**La decisión: el adaptador delega el trabajo largo en el proveedor y nosotros lo retomamos por
callback.** Verificado en la documentación de OpenAI, no de memoria:

- la Responses API acepta **`background: true`** y devuelve al instante un `id` con estado
  `queued`; el resultado se lee después con `GET /v1/responses/{id}`, y hay `.../cancel`;
- hay **webhooks** con endpoint configurado en el dashboard y evento `response.completed`, cuyo
  payload **trae sólo el `id`** — el resultado se va a buscar aparte;
- la firma es **Standard Webhooks**: HMAC-SHA256 sobre `id.timestamp.body`, base64, header
  `v1,<firma>`, secreto `whsec_` + base64. Se verifica con `node:crypto`: **cero dependencias, ni
  el SDK del proveedor.**

El flujo queda: `analyze` responde **202 al instante** y dentro de `after()` (existe en Next 16 —
`node_modules/next/server.d.ts:21`) prepara los archivos, hace el submit y guarda el
`provider_job_id`; el callback verifica la firma **antes de hacer cualquier otra cosa**, toma
**sólo el id**, lo resuelve contra nuestra tabla y va a buscar el resultado a la API. **El cuerpo
del webhook no se cree para nada**: es entrada pública no autenticada.

**Y el scheduler externo no desaparece: cambia de papel.** Deja de ser el worker y pasa a ser el
**reconciliador** que pollea los imports que quedaron en `analyzing` más de N minutos. Sin eso, un
webhook perdido cuelga un import para siempre — y además es la única forma de que esto funcione en
**local y en preview**, donde el endpoint del dashboard no apunta.

**Consecuencia sobre el contrato, y es la parte que sostiene la promesa de agnóstico:**
`CatalogExtractionProvider` gana una forma **diferida**. `start()` devuelve un resultado completo
**o** un `jobId`; se suman `poll(jobId)` y `verifyCallback(headers, rawBody)`. El `fake`
implementa sólo `start`. No es una concesión a OpenAI: la Batch API de Anthropic es poll sin
webhook y entra en la misma forma.

### 9. Un producto sin precio nace sin precio, y el precio dudoso NO bloquea

**Dos estados, no tres** (decisión del owner, 2026-09-21): `detected` y `ambiguous`. «Si no podemos
tener el valor o no lo sabemos, es ambiguo — `missing` no existe.»

**Y `ambiguous` deja de bloquear la aceptación.** Esto **enmienda la §6**, y el motivo es que la §6
se apoyaba en algo que ya no es cierto: ahí el precio dudoso se normalizaba a **`0`**, y bloquear
era obligatorio porque **cero es un precio falso que parece válido** y entraba al catálogo real. Con
`unitPrice: null` —que `core.product.unit_price` ya admite (`schema/catalog.ts`)— **no entra nada
incorrecto**: entra un producto sin precio, que es un estado legal del catálogo y lo que el owner
pidió explícitamente («el precio no es obligatorio; si no, puede avanzar y completarlo en el
futuro»). Bloquear además volvía inimportable un menú con muchos precios ilegibles, que es
justamente el menú que más necesita esta feature.

Lo que reemplaza al bloqueo: el `accept` **devuelve cuántos productos nacieron sin precio**, para
que la pantalla lo pueda advertir antes o mostrarlo después. Desaparece `priceConfirmed`, que sólo
existía para desbloquear.

### 10. El límite de análisis es un valor centralizado, no una constante

Arranca en **un análisis por negocio por día** y vive en el catálogo de
`server/entitlements/`, junto a `locations.max`, con **ventana** además de `byPlan`: mover a 10 por
semana, o a 5 por mes según el plan, es cambiar un valor. No contradice la §7 —sigue sin haber
cuota comercial— porque es un control **operativo**: sin él, `cancelar → crear → analizar` en loop
es una llave de costo abierta, y el guard compartido de este repo **no tiene rate limit** (medido:
`api-permission.ts` y `api-owner.ts` no tienen una línea).

**Los fallos no consumen cupo** (decisión del owner). Sólo lo consume un análisis que llegó a
`ready`; un fallo del proveedor o nuestro no le cuesta el día al merchant. Para que un loop de
fallos tampoco queme plata, el mismo catálogo declara un techo de intentos al proveedor por día.

### 11. El PDF se cuenta sin dependencias

El límite de 10 páginas **no tenía mecanismo**: `sharp` no lee PDF (medido:
`sharp.format.pdf.input === false`, vips 8.18.3) y no hay librería de PDF en `.pnpm-store`. Un
contador por bytes falla **abierto**: de 14 PDFs reales, el que tiene `/ObjStm` devuelve **0
páginas** con un escaneo de `/Type /Page`, así que uno de 400 páginas pasaría un check de `<=10`.

**La decisión: contarlo con `node:zlib`** —que viene en Node— inflando los streams y tomando el
**máximo** de dos señales independientes (objetos `/Type /Page` y el `/Count` del nodo raíz).
Medido sobre los mismos 14: el de `/ObjStm` pasa a 1 y las dos señales coinciden en 13; la que
discrepa es un PDF con revisiones incrementales, donde el máximo sobre-cuenta. **Sobre-contar sólo
puede rechazar un archivo válido; nunca deja pasar uno de 400 páginas.** Si ninguna señal da nada,
se rechaza. El cifrado se detecta por `/Encrypt` en el trailer.

### 12. Al merchant se le avisa por email, y el aviso de privacidad es de la UI

Que el proceso sea asíncrono **es una ventaja y se explota**: el merchant sube, cierra la pantalla
y sigue con lo suyo. Para que eso no sea un pozo, el servidor **manda un email cuando el import
queda `ready`** (y otro si falla), una sola vez por import, reusando el canal que ya existe
(`server/email/`: Resend con un fake de consola y `emailChannelFromEnv`).

**El aviso de que el archivo se procesa con un proveedor externo lo escribe el owner en la UI**
(decisión suya, 2026-09-21). No es un hallazgo pendiente y no se vuelve a subir como pregunta.

### 13. La API se adapta a la pantalla que existe, no al revés

La pantalla ya existe (`catalog-ai-import.tsx`, el modal «Probar importar» de
`/backoffice/catalog`) y es **más simple** que lo que la primera spec suponía: manda **un** archivo,
**no edita** el borrador y su botón «Cancelar» **sólo cierra el modal**. Tres consecuencias, y la
segunda evitaba un callejón:

1. **`accept` no exige cuerpo.** Acepta el borrador tal como está guardado. Guardar una revisión
   (`PUT .../draft`) es opcional y existe para cuando la pantalla edite.
2. **`POST /imports` se APROPIA de un import abandonado en `pending_upload`** en vez de responder
   409: una pantalla que cierra el modal sin cancelar dejaría al merchant trabado hasta que el
   import venza. En `queued` o `analyzing` sigue siendo 409 —hay trabajo pago en vuelo— y en
   **`ready` también**, porque descartar un borrador terminado **quema el análisis del día**: ahí lo
   correcto es retomarlo, y para eso está `GET /api/catalog/imports`.
3. **La idempotencia del `accept` la resuelve el servidor**, no el cliente: bajo el lock del import,
   si ya está `accepted` devuelve 200 con el mismo resumen guardado. **No hay `idempotencyKey` en el
   contrato** — si evitar que un doble clic cree el catálogo dos veces dependiera de que el cliente
   invente y reuse una clave, el contrato estaría mal escrito.

La API sigue aceptando **1-10** imágenes: la pantalla manda una hoy y el día que mande cinco no hay
que cambiar el servidor.
