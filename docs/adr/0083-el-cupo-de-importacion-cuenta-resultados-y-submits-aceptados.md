---
adr: 0083
fecha: 2026-09-22
estado: aceptada
resumen: El análisis diario se consume sólo al producir un borrador; el guard operativo cuenta únicamente submits que el proveedor aceptó. Validación, preparación, configuración ausente y errores anteriores o durante un submit rechazado no bloquean al merchant. El presupuesto se comprueba antes de reservar archivos y nuevamente antes de invocar al proveedor.
---

# 0083 — El cupo de importación cuenta resultados y submits aceptados

## Contexto

El ADR 0082 §10 separó dos controles: un análisis útil por negocio y día, consumido sólo al
llegar a `ready`, y un techo operativo para que un loop de fallos no abra gasto ilimitado contra
el proveedor. La primera implementación confundió el segundo control con `attempt_count > 0`.

Ese predicado no medía submits: medía imports reclamados por el worker. `runAnalysis` incrementaba
el contador antes de comprobar la configuración, leer R2, contar el PDF o invocar al proveedor.
Tres errores propios cerraban el cuarto import con `catalog_import_rate_limited`, aunque ningún
análisis hubiera producido un borrador y aunque el proveedor pudiera no haber aceptado ninguno.
Además, el rechazo aparecía después del `202 queued`: el merchant subía el archivo para descubrir
tres segundos después que el servidor ya sabía que no había presupuesto.

## Decisión

### 1. El análisis diario sigue contando únicamente resultados útiles

`catalog.imports.analyses` conserva como discriminante `draft IS NOT NULL`. Un import `failed`,
sin importar dónde falló, no consume el análisis diario del merchant. Esta decisión reafirma el
ADR 0082 §10 y el contrato 0090.

### 2. El guard operativo cuenta submits aceptados, no trabajos reclamados

`catalog.imports.attempts` cuenta imports con `provider IS NOT NULL`. Ese campo se escribe sólo
después de que `CatalogExtractionProvider.start()` devuelve con éxito, junto con modelo, versión
de prompt y versión de esquema.

Por lo tanto no consumen el guard:

- configuración ausente o inválida;
- objeto faltante o ilegible en R2;
- PDF cifrado, inválido o fuera del límite de páginas;
- normalización de imagen fallida;
- rechazo o error de red de `provider.start()` sin respuesta aceptada.

Un trabajo aceptado por el proveedor sí consume el guard aunque después termine fallando: ya cruzó
la frontera externa y puede haber generado costo. El análisis diario continúa intacto si no llega
a borrador.

### 3. Rechazo temprano y defensa en profundidad

`POST /api/catalog/imports` comprueba ambos presupuestos antes de crear filas o firmar uploads. Si
alguno está agotado devuelve el `429 catalog_import_rate_limited` normativo con
`retryAfterSeconds`; el cliente no sube un archivo que el servidor ya sabe que no procesará.

`runAnalysis` vuelve a comprobar el guard inmediatamente antes del submit. Esta segunda barrera
protege cambios de ventana/configuración y ejecuciones internas. El índice parcial de un único
import abierto por negocio impide dos submits nuevos concurrentes del mismo negocio; el lease del
worker impide reclamar dos veces el mismo import.

### 4. `attempt_count` queda como contador técnico del import

`attempt_count` limita recuperaciones del mismo trabajo y no define consumo comercial ni
operativo. Se incrementa inmediatamente antes de invocar `provider.start()`, después de preparar y
validar el archivo. Una caída de proceso en esa frontera puede dejar un intento incierto; el límite
por import permanece como fusible, pero no bloquea otros imports del negocio porque el guard
operativo sólo observa el submit confirmado mediante `provider`.

## Consecuencias

- Los imports fallidos existentes con `provider IS NULL` dejan de bloquear inmediatamente, sin
  migración ni reparación manual.
- Un submit aceptado y luego fallido conserva proveedor/modelo para diagnóstico y cuenta contra el
  fusible operativo, pero no contra el análisis diario.
- El `429` vuelve a ocurrir en la frontera HTTP documentada, con un tiempo de reintento utilizable
  por la UI.
- Las pruebas deben distinguir cuatro fronteras: antes de preparar, preparación, submit rechazado
  y submit aceptado; `attempt_count > 0` ya no es oráculo de cuota.

## Referencias

- ADR 0017 — estándar production grade.
- ADR 0082 §8 y §10 — ejecución asíncrona y cupo de análisis.
- Contrato 0090 §2 — `429 catalog_import_rate_limited` y `retryAfterSeconds`.
