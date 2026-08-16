---
fecha: 2026-08-16
resumen: La atribución por **local** (`location_id`) es una **dimensión estándar de todo evento de valor** del programa (alta/enrolamiento, venta, acumulación de punto/sello, y canje futuro), no un agregado ad-hoc por pantalla. El local se captura de una de **dos fuentes** según quién origina el evento: (a) **eventos del operador** (venta, acumulación, canje) → el local viene del **counter** (el operador está físicamente en un local; el counter ya scopea por `?location=` y persiste `order.location_id`, spec 0030); (b) **eventos self-service del consumidor** (alta en el programa) → el local viene del **QR escaneado**, cuyo afiche por-local (brand kit, spec 0041) codifica `/enroll/<programId>?loc=<locationId>`, y el alta lo persiste en `program_membership.origin_location_id`. Con esto "separar estadísticas por local" es un `GROUP BY location_id` sobre cada tabla de evento — sin lógica especial. El **evento de canje** todavía no existe (spec 0036 solo define premios); cuando se construya nace con `location_id`. El **dashboard** de estadísticas por local es una feature aparte, no este ADR.
estado: aceptada; consume el modelo de `core.order` (spec 0030) y la marca real (spec 0025); habilita la spec 0041 (brand kit + alta por local); fija el contrato para el canje futuro (spec 0036+) y para el tablero por local
---

# ADR 0042 — Atribución por local como dimensión universal de eventos de valor

## Contexto

El owner quiere **separar estadísticas por local**: en qué local se dio de alta un
consumidor, en qué local se hizo una venta, en qué local se acreditó un punto/sello, y en
qué local se canjeó un premio. Un negocio puede tener N locales (`core.location`, spec 0023);
hoy solo hay **un programa operativo por negocio** (índice único parcial
`core_loyalty_program_one_operational`), así que "el programa de la marca" es 1:1 con el
negocio y el local es la única dimensión que subdivide su actividad.

El estado real de la captura del local hoy es desparejo (verificado en código):

- **Venta + acumulación:** son el **mismo** registro. `core.order` (spec 0030) es el asiento
  append-only de un grant de puntos/sellos, y **ya tiene `location_id`**
  (`schema/order.ts`, FK `set null`). El operador elige el local en el counter (`?location=`,
  validado contra el negocio por `assertLocationInBusiness`). Es **nullable/opcional** hoy.
- **Alta / enrolamiento:** `program_membership` (`schema/consumer.ts`) **no** guarda de qué
  local vino el alta. La landing de enrolamiento apunta a `/enroll/<programId>` — la URL **no
  lleva el local**. Es el hueco real de captura.
- **Canje:** **no existe como transacción**. La spec 0036 solo define los premios
  redimibles (`loyalty_reward`); el evento de canje está marcado "future feature" en el
  schema. No hay dónde registrar su local porque no hay registro de canje.

Sin un modelo común, cada evento resolvería el local a su manera y el tablero terminaría con
tres fuentes incompatibles. Peor: una decisión tomada solo para el alta (brand kit) dejaría
el canje futuro sin atribución y habría que reabrir todo.

## Decisión

**`location_id` es una dimensión estándar de todo evento de valor del programa.** Cada tabla
de evento (alta, order, canje futuro) lleva una referencia al local, y el reporte por local
es un `GROUP BY location_id` — nunca lógica por pantalla.

**El local se captura de dos fuentes, según quién origina el evento:**

1. **Eventos originados por el operador** (venta, acumulación, canje): el local viene del
   **counter**. El operador está físicamente en un local; el counter ya lo scopea por
   `?location=` y lo valida contra el negocio. `order.location_id` ya materializa esto; el
   futuro asiento de canje nace igual.
2. **Eventos self-service del consumidor** (alta en el programa): el local viene del **QR
   que el consumidor escaneó**. El afiche por-local del brand kit (spec 0041) codifica
   `/enroll/<programId>?loc=<locationId>`; el flujo de alta valida ese `loc` contra el
   negocio del programa y lo persiste en **`program_membership.origin_location_id`** (nuevo,
   nullable, FK `set null` — mismo patrón que `order.location_id`).

**Esquema de URL del QR de enrolamiento:** `/enroll/<programId>` sigue siendo válido (QR
"global" o negocio de 1 local); el afiche por-local agrega **un solo query param
opcional**: `?loc=<locationId>`. Se elige query param (no un nuevo segmento de path ni una
tabla de "campañas de QR") porque:

- El `programId` ya identifica al negocio y su único programa; el `loc` es puro dato de
  atribución, no cambia a qué se enrola el consumidor.
- No hace falta **persistir el afiche/QR como entidad**: la atribución vive en el evento
  (`origin_location_id`), no en un registro de "kit". El afiche se genera on-demand.
- Un `loc` inválido o ajeno al negocio del programa **se ignora** (atribución `null`) — el
  alta nunca se rompe por un QR viejo, mal copiado o de otro negocio.

**Alcances explícitos:**

- **Este ADR + la spec 0041 cierran solo la captura del alta** (`origin_location_id` +
  `?loc=`). La venta/acumulación ya está cubierta por `order.location_id`.
- El **evento de canje** se construye en una spec futura (0036+) y **nace con
  `location_id`** capturado del counter — este ADR lo fija como contrato para que no haya
  que reabrir el modelo.
- El **tablero de estadísticas por local** (contar altas/ventas/acumulación/canjes por
  local) es una feature aparte. Este ADR garantiza que los datos existan y sean
  homogéneos; no construye la vista.

**`order.location_id` sigue nullable.** Endurecerlo (exigir que el counter siempre elija un
local) es un ajuste de otra tarea; no se cambia acá para no ampliar el alcance de 0041. Las
filas sin local caen a un cubo "sin asignar" en el tablero futuro.

## Consecuencias

**Positivas:**

- Un único mental model: "todo evento lleva su local, capturado del QR o del counter". El
  tablero por local es un `GROUP BY`, sin casos especiales.
- El brand kit por-local (0041) tiene sentido de negocio inmediato: cada afiche imprime un
  QR distinto y las altas quedan atribuidas al local del afiche.
- El canje futuro no reabre este modelo: ya sabe que debe llevar `location_id`.
- Migración mínima y aditiva (una columna nullable), sin reescribir historia ni romper la
  URL de enrolamiento existente.

**Costos / límites aceptados:**

- La atribución del alta es tan buena como la disciplina de imprimir el QR correcto en cada
  local; un afiche global pegado en un local concreto atribuye `null`, no ese local. Es
  aceptable: el owner elige el alcance del afiche.
- `order.location_id` opcional ⇒ el tablero futuro necesita un cubo "sin asignar" hasta que
  se endurezca la captura en el counter.
- No hay entidad "brand kit" persistida ⇒ no se puede listar "qué afiches generé"; si el
  owner lo pide a futuro, es una tabla nueva, no un cambio de este contrato.

## Alternativas descartadas

- **Un segmento de path por local** (`/enroll/<programId>/<locationId>`): mezcla identidad
  (a qué me enrolo) con atribución (dónde escaneé) en la ruta; el `loc` es opcional por
  naturaleza y un query param lo modela mejor. Descartada.
- **Tabla de "campañas de QR" persistida** (un registro por afiche con su propio id corto):
  agrega una entidad y un join para algo que la URL ya expresa; solo valdría la pena si
  hiciera falta rotar/expirar QR o contar impresiones — no es el caso hoy. Descartada
  (documentada como posible evolución si aparece esa necesidad).
- **Atribuir el alta al local de la primera venta:** no todos los consumidores compran el
  día que se dan de alta, y la pregunta del owner es explícitamente "en qué local se **dan
  de alta**". Descartada.
