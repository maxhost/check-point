---
spec: 0180
fecha: 2026-10-08
estado: cerrada
resumen: Nueva orden con selección, revisión y guardado separados, sin tabs ni resumen fijo al seleccionar.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/pos-editor.tsx, tests/e2e/pos.spec.ts
---

# 0180 — Nueva orden: seleccionar, revisar, guardar

L1. Mini plan cerrado antes de código; simplificación UI solicitada por owner.

## Problema

pos-editor.tsx:358 ofrece tabs Productos/Pedido y :429 dos botones de alternar/guardar;
:419 repite cantidad/total en footer aunque el mesero todavía selecciona artículos.
Permite crear sin pasar por revisión; navegación duplicada ocupa pantalla.

## Alcance y diseño

Solo nueva orden (order null). Selección abre catálogo existente con mesa/local,
sin tabs ni resumen global de cantidad/importe, con única CTA Revisar pedido.
No muestra Guardar orden en selección. Revisión muestra líneas editables,
cantidades/precios, Total en contenido y única CTA Guardar orden. Botón discreto
Volver a productos permite ampliar pedido manteniendo búsqueda/categoría/borrador;
catálogo permanece montado, sin GET extra ni guardado al avanzar o regresar.

Mesa/local y validaciones actuales conservados; revisión admite corregirlos.
Crear mesa vacía sigue permitido tras revisar, según contrato vigente. No se
introduce auto-save, cobro ni creación en DB antes de confirmar revisión.
API/payload sin cambios; precios/lineId/helpers, cache, autorización y errores iguales.
Guardar falla conserva revisión/borrador; éxito muestra orden abierta existente.

X/links mantienen salida protegida. Desde selección nueva, el Dialog ofrece
Revisar pedido en lugar de Guardar y salir; lleva a revisión sin escribir ni salir.
Desde revisión mantiene Guardar y salir. La función save impide crear fuera de
revisión, incluso por salida protegida. Busy bloquea acciones actuales.

Footer reutilizado del sistema, únicamente acción en nueva; reserva inferior
compacta para selección, suficiente para botón/validación en revisión. Nueva no
repite total en footer. Orden existente conserva tabs, resumen y botones actuales.
Sin cambios en Mostrador, navbar, márgenes, kit, CSS, servidor o API.

## Archivos

Editar pos-editor.tsx; adaptar escenarios e2e existentes al paso de revisión.
No disjunta con 0178. Sin nuevas suites por preferencia del owner.

## Definition of Done

- [x] Typecheck, lint, formato, guardia UI y números verdes.
- [ ] Owner verifica selección sin tabs/importe/Guardar, revisión con cantidades,
      total y Guardar; volver conserva catálogo, X protege cambios, fallo no pierde.

## Mutaciones y límites

0, L1. Sin suites adicionales ni build global; QA owner con pnpm dev:local.
Spec cerrada hasta evidencia real de QA. Sin merge/push; commits propios dev.
Sin decisiones abiertas.

## Verificación local

Typecheck 6 paquetes verde (3,59 s), ESLint, formato, guardia UI 4 archivos sin
aumentos, números sin duplicados y diff-check. Escenarios e2e existentes adaptados
a revisión previa y ausencia de resumen global; no ejecutados por preferencia del
owner. Sin nuevas suites ni QA visual de GPT; owner debe probar pnpm dev:local.
