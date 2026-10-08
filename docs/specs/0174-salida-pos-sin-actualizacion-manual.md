---
spec: 0174
fecha: 2026-10-08
estado: cerrada
resumen: Retirar Actualizar órdenes y ofrecer una X para volver al inicio desde POS.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/pos-console.tsx, tests/e2e/pos.spec.ts
---

# 0174 — Salida del POS sin actualización manual

Cambio acotado solicitado por el owner. Spec chica, sin migraciones.

## Problema

`pos-console.tsx:318` muestra Actualizar órdenes. El owner pide retirarlo y usar
una X arriba a la derecha para volver a la pantalla principal.

## Alcance y diseño

Reemplazar la acción del PageHeader por un enlace Next a `/backoffice`, con Xmark,
clase close-module existente y nombre accesible Cerrar POS. Contenedor flex para
mantener la X arriba a la derecha también en móvil; reutilizar PageHeader y tokens.
Eliminar el manejador update sin callers. No sustituirlo por polling, TTL ni
actualizaciones al enfocar. La caché por montaje se conserva: salir y volver al POS,
o recargar la página, inicia una lectura nueva; cambios propios siguen publicándose
desde la respuesta de la API. Conflictos y validación previa a anular se conservan.

Sin cambios de API, sesión, servidor, kit o CSS. El enlace no guarda un borrador.
No disjunta con 0172 en consola y pruebas.

## Archivos y verificación

- Editar consola POS y pruebas que dependen de la acción retirada.
- Prueba de navegador: botón ausente, enlace Cerrar POS con destino correcto,
  X arriba a la derecha en móvil y escritorio; navegación de salida comprobada.
- Adaptar pruebas de renovación a recarga; catálogo reutilizado conserva borrador.
  Errores de lectura se prueban con la validación previa a anular. Escenarios de
  GET concurrente con escritura habilitados solo por actualización manual se retiran
  por flujo eliminado; pruebas directas de generaciones/versiones siguen vigentes.
- Pruebas POS afectadas, typecheck, lint, formato, guardia UI y números verdes.
- Sin build sobre dev activo ni mutaciones nuevas. QA owner con pnpm dev:local
  antes de main; sin merge ni push. Sin decisiones abiertas.

## Evidencia

30 pruebas POS pasan (14,1 s), incluida salida al inicio y ausencia del botón.
Lecturas de error cubiertas desde Anular; recarga y reutilización de catálogo verdes.
Typecheck, lint, formato, guardia UI sin aumentos y números verdes. El enlace usa
Link del kit; no se añadió importación directa de next/link. Owner confirmó que
la X funciona. Comprobación visual y salida verificadas junto a 0176;
la X en detalle/edición ahora vuelve al listado según el nuevo encargo.
