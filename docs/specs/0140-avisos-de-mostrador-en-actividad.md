---
spec: 0140
fecha: 2026-10-02
estado: cerrada
resumen: Actividad muestra los avisos de mostrador junto con beneficios y programas, usando el contrato de la 0139.
disjunta: si
archivos: apps/consumer/src/app/(consumer)/wallet/{page,wallet-shell,activity-view}.tsx, tests/e2e/**
---

# 0140 — Avisos de mostrador en Actividad

## Problema

- `wallet/page.tsx` carga programas y cupones, pero no `listConsumerNotices`.
- `wallet/activity-view.tsx` compone entradas solo de cupones válidos y programas. Los avisos de mostrador quedan fuera del historial aun cuando existen en la cola (ADR 0116 §1).

## Alcance

**Entra:** conectar la lectura de avisos de la spec 0139 §3 a Actividad y mezclarlos por fecha; ajustar subtítulo y estado vacío.

**No entra:** cambios de API, servidor, paquetes, migraciones, push o estados de entrega; fetch del cliente.

## Diseño

La página obtiene `listConsumerNotices(account.id)` en el `Promise.all` existente, después de resolver la sesión. Pasa `NoticeDTO[]` por `WalletShell` a `ActivityView`. El origen del ID es exclusivamente la sesión. Si no hay sesión se mantiene la pantalla de acceso actual, sin consulta de avisos.

Cada aviso aporta `key: notice-${notice.id}`, título `notice.title`, detalle `notice.body`, fecha `new Date(notice.createdAt)`, icono de movimiento y acción `onShowPrograms`. Se ordena por fecha con las entradas existentes. El DTO no incluye estado de envío y la UI no lo infiere. El listado respeta el límite de 30 avisos del contrato. La presentación de fecha conserva el formato usado por Actividad.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/consumer/src/app/(consumer)/wallet/page.tsx` | editar |
| `apps/consumer/src/app/(consumer)/wallet/wallet-shell.tsx` | editar |
| `apps/consumer/src/app/(consumer)/wallet/activity-view.tsx` | editar |
| `tests/e2e/**` | editar solo si una prueba existente cubre esta vista y permite una aserción útil |

**Disjunta?** Sí: la 0139 ya entregó el contrato; esta spec toca solo la zona UI de GPT.

## Definition of Done

- [ ] Una cuenta con aviso de mostrador muestra el comercio, el texto exacto y la fecha en Actividad aunque no tenga notificaciones activadas.
- [ ] Los avisos, cupones válidos y programas aparecen juntos en orden de fecha; tocar un aviso abre Mis programas.
- [ ] El subtítulo y el estado vacío mencionan movimientos en comercios; no aparecen estados de envío.
- [ ] `pnpm verify` pasa con Node 24, incluido e2e, y su tabla final queda en el handoff.
- [ ] El diff solo toca UI, e2e y documentación propia de esta spec.

## Mutaciones — presupuesto: 0

El cableado por props es reversible y de bajo impacto. El gate de tipos/build y la inspección de la pantalla cubren el riesgo concreto de omitir o mostrar mal campos. Queda fuera el QA manual con una cuenta que tenga un sello reciente: requiere acceso a esa cuenta y al mostrador.

## Handoff

Un implementador entrega diff y tabla de `pnpm verify`. Un revisor independiente comprueba la spec, la ruta de datos y la evidencia antes de marcar `implementada` (ADR 0071).

## Abierto

Nada.
