---
spec: 0142
fecha: 2026-10-03
estado: cerrada
resumen: Las notificaciones Web Push usan el mismo icono que la PWA instalada en la pantalla de inicio.
disjunta: si
archivos: apps/consumer/public/sw.js, docs/INDEX.md
---

# 0142 — Icono de la PWA en Web Push

## Problema

- `apps/consumer/public/sw.js:19` usa `/checkpass-icon-192.png` al mostrar una notificación.
- El manifest de la PWA instalada y `layout.tsx` usan `/checkpass-icon-192-v2.png`. Los dos PNG son distintos: el primero muestra una «C» más grande que el icono actual de la pantalla de inicio.

## Alcance

**Entra:** cambiar el `icon` de `showNotification` al PNG de 192 px de la PWA instalada.

**No entra:** cambiar el `badge` monocromo de Android, payload, texto, navegación, entrega, permisos o suscripciones. Apple y Google Wallet se revisan por separado: su iconografía pertenece al pase y a las plataformas, no al service worker.

## Diseño

`sw.js` seguirá leyendo `title`, `body`, `url` y `clickId` del payload actual. En las opciones de `showNotification`, `icon` será `/checkpass-icon-192-v2.png`, la misma URL declarada en el manifest para el propósito `any`. `badge` seguirá siendo `/checkpass-badge-96.png`, la «C» monocroma que Android puede enmascarar. No se agrega fetch ni imagen al payload.

La PWA y el service worker comparten el mismo origen. El worker ya está instalado con scope `/`; la siguiente versión del archivo se instala según el ciclo de actualización del navegador. Los avisos ya mostrados conservan su imagen original.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/consumer/public/sw.js` | editar |
| `docs/INDEX.md` | agregar fila |

**Disjunta?** Sí. Solo archivos públicos de la UI y documentación; no modifica el constructor ni la entrega de Wallet.

## Definition of Done

- [ ] El `icon` de Web Push usa `/checkpass-icon-192-v2.png`; coincide con la entrada de 192 px del manifest.
- [ ] `badge`, texto, click y destino siguen intactos.
- [ ] `pnpm verify` con Node 24 termina verde y su tabla queda en el handoff.
- [ ] El diff no toca servidor, API, paquetes ni migraciones.

## Mutaciones — presupuesto: 0

Un cambio de URL estático y reversible; la prueba de click existente y el gate completo cubren la regresión funcional. QA visual de una notificación real queda pendiente del dispositivo y sus permisos.

## Handoff

Implementación y verificación de GPT. La spec se marca `implementada` tras PASS independiente y QA visual, según `docs/AGENT-WORKFLOW.md`.

## Abierto

Nada para este canal.
