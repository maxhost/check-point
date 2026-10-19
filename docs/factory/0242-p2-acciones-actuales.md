# 0242 punto 2 — acciones sobre la UI aceptada

Base congelada: `d49d70f2c56b9de454846a3f87402ec76862f7f0` (producto `26222f50`).
Owner autoriza continuar puntos 2–6, sin capturas, sin reactivar agentes históricos,
sin push/PROD y conservando servidor/túnel y cambios ajenos.

## Contrato del corte

Revalidar precuenta persistida y borrador con notas, elección de impresora separada
del gesto de impresión, reimpresión cerrada sin otro cierre y anulación persistida
con cancelación, doble confirmación, conflicto, respuesta perdida, remount y
retirada de identidad. Respetar configuración deshabilitada y permisos; no habilitar
impresión automáticamente. Documentos históricos usan snapshots exactos.

Reutilizar QA CP2d.7/8 y tests de transporte/dominio compatibles. Actualizar los
selectores obsoletos del browser de acciones al editor/receipt aceptados, manteniendo
las aserciones de operaciones, recuperación y aislamiento. No ejecutar capturas.
Los mocks de dispositivo/HTTP no certifican hardware ni auth/DB nativos.

Writer directo: coordinador en WT propio limpio ya existente
`/private/tmp/checkpass-pos-0242/pos-qa-0242`, ref `pos-qa-0242`, adelantado
por fast-forward desde su entrega documental ancestro de dev. No reactivar agente
anterior. La reserva nueva `p2-acciones-0242` fue rechazada por tres slots ocupados; se continuó
la reserva existente `pos-qa-0242` mediante factory antes de escribir código.
El adelanto manual inicial se revirtió sin descartar archivos y factory hizo el FF registrado.
Paths: `tests/e2e/pos-console-actions.spec.ts`,
`tests/e2e/support/pos-console-actions-fixture.ts` y este informe.
Producto fuera de alcance inicial; un defecto concreto amplía ficha/reserva antes
de corregir. No tocar kit, guardias, tooling, esquema o datos en este corte.

Checks: unit de void/documento/transporte; browser acciones sin capturas sobre
fuente actual, lint/tipos pertinentes a los cambios. QA funcional independiente
con contexto fresco para el candidato congelado, sin rediseño ni repetición global.
El CI remoto sigue rojo en `90ebe18f`; no se presenta como verde.

## Continuación

Después de este corte, preparar bloqueo de writers antiguos y dependencias de
acceso antes de activar masa. Mantener reservas visuales antiguas y el listener3201.
Los puntos 3–6 siguen pendientes hasta su evidencia real, incluido M1.

## Entrega y QA independiente

Candidato de tests: `9a43796ba88ad7ba2bac900e5c633efdbcfc72d0`, base
`42d4c5ad`; producto sin cambios, `26222f50`. Único archivo de código cambiado:
`tests/e2e/pos-console-actions.spec.ts`. No se amplió scope de producto.

Revisor nuevo `p2_qa_fresh`, contexto fresco y solo lectura: **PASS funcional focal**.
Reprodujo Node24.20.0 Vitest void/documento/transporte: **50/50**, 0 skips.
Inspeccionó diff y conexión editor/receipt/provider/void; sin hallazgos bloqueantes.
Reutilizó evidencia browser compatible: **14 casos PASS** en `browser-final.log`
más **1/1 PASS** del caso deshabilitado en `browser-disabled-final.log`.
No se presenta como una corrida única15/15. Único cambio posterior a la corrida
14/15: aserción disabled en vez de ausencia del botón, conforme UI aprobada.
Tipos merchant, lint, formato y diff-check PASS. Sin cambios de lock/config.

Recorridos cubren preparación ticket tras listado usable, elegir separado de
imprimir, fallos/reintento/selección tardía, reimpresión sin otro close, ajustes
apagados/error, cancelar/doble confirmación de void, conflicto/revisión,404,
respuesta inválida/perdida,403/remount/replay idéntico y401/cambio de scope.
Caso nuevo móvil390: nota dirty → precuenta marcada Borrador sin confirmar con
nota/total exactos → cero writes; cancelar void conserva borrador y confirmar
emite solo void versionado, sin guardar/cobrar.

Fallos conservados: Chromium no arrancó dentro del sandbox (14 errores de setup,
0 casos ejercidos). Primera corrida funcional11/14: expectativas obsoletas de
precarga, botón ausente y texto de nota. Segunda14/15: quedó sin actualizar una
aserción del botón apagado; corrección focal1/1. No son fallos de producto ni retries
contados como aprobación. Logs privados: `/private/tmp/checkpass-p2-0242/`.
QA independiente confirmó que la precarga ya estaba aprobada y que ticket sigue
fuera del camino crítico; no se relajó ningún comando monetario.

Límites: HTTP/dispositivo simulados, UI/cliente/provider reales. Reutiliza QA
anterior de dominio/HTTP compatible; no certifica nuevamente auth/DB nativos ni
hardware/papel/BLE. Sin capturas, DB, M1, push/PROD. Servidor3201/túnel intactos.
Punto2 cerrado funcionalmente; puntos3–6 conservan sus gates propios.
