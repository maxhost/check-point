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
anterior. Reservar `p2-acciones-0242` por factory antes de escribir código.
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
