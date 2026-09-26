# Handoff de revisión independiente — Spec 0096

Fecha: 2026-09-25. Revisor: `/root/review_catalog_0096`, independiente del implementador.

**Dictamen: PASS para la UI verificable. La DoD completa continúa pendiente de QA
autenticado y dispositivos reales.** No quedan defectos reproducidos abiertos dentro del
alcance revisado. Mantener la spec `cerrada` con esos pendientes explícitos.

Se revisaron spec, ADR, cambios tracked/untracked, motor compartido, permisos, estados,
modales, importador y pruebas. El revisor no modificó archivos del repositorio ni ejecutó
nuevas mutaciones. Presupuesto de seis defectos y máximo dos rondas respetado.

## Evidencia independiente ejecutada

Node 24.20.0. Todos estos comandos devolvieron exit 0:

- `pnpm run test`: 1789 passed / 595 skipped.
- `pnpm exec playwright test`, versión final: 21 passed / 3 skipped, 12.7 s.
- `pnpm run build`, después de la última corrección: tres apps exitosas; merchant compilado.
- `pnpm run typecheck`: tres apps exitosas.
- `pnpm run lint` y `git diff --check`.

## Hallazgos corregidos y corroborados

- GET 401/403 posterior a guardar mantenía la ayuda activa. El revisor reprodujo ambos
  desde crear producto; el implementador también desde crear categoría. La corrección
  termina la guía y conserva la escritura confirmada y el mensaje de sesión/permisos.
- La búsqueda quedaba bloqueada al editar con filtros sin resultados. Se reprodujeron
  `pointer-events:none` y el overlay interceptando el clic; el contenedor persistente
  ahora permite operar buscador/filtros. El implementador midió también borrar producto.
- Resultado rápido de fotos desmontaba el anchor antes del RAF del controlador y cerraba
  la ayuda. La suite final verifica que el recorrido sigue la fase visible del modal.

Medición estable a 320 px después de seleccionar categoría y mover foco: anchors legibles,
`scrollLeft=0`, popover dentro del viewport. No se reprodujo el supuesto corte izquierdo
que sugería una captura transitoria; esa captura no se usa como QA visual estable.

## Límites del PASS

Los casos owner/staff autenticados siguen omitidos; el harness no demuestra guards reales,
DB, IA ni almacenamiento. Cámara, selector nativo, teclado móvil, claro/oscuro y QA
iOS/Android siguen pendientes. No declarar producción verificada ni cerrar la DoD completa.

El implementador reprodujo ambos defectos iniciales con tests propios antes de corregir,
remidió toda la suite y leyó el log de compilación generado. Evidencia y límites completos:
[handoff UI](spec-0096-handoff-ui.md) y [bitácora](spec-0096-bitacora-de-mutaciones.md).
