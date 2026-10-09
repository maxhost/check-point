---
spec: 0179
fecha: 2026-10-08
estado: cerrada
resumen: Navbar mobile POS con POS, Nueva orden central destacada y Mostrador.
disjunta: no
archivos: apps/merchant/src/app/backoffice/backoffice-navigation.tsx, apps/merchant/src/app/backoffice/pos/pos-console.tsx, apps/merchant/src/app/backoffice/pos/pos-navigation.ts
---

# 0179 — Nueva orden destacada en navbar POS

L1, mini plan cerrado antes de código; owner confirmó POS / Nueva orden / Mostrador.

## Problema

backoffice-navigation.tsx:363 ofrece dos accesos iguales en POS. Owner pide que
Nueva orden ocupe el centro, destacada como Mostrador en la navbar general.

## Alcance y diseño

Barra mobile del listado POS: tres columnas iguales. POS izquierda, Nueva orden
central y Mostrador derecha. Centro usa Button del kit, icono Plus y clase existente
mobile-counter-access; colores/tokens generales, sin paleta especial ni CSS nuevo.
POS mantiene destino/estado activo; Mostrador conserva permiso counter y destino.
Nueva orden requiere permiso pos y módulo encendido; es acción local, no enlace.
Si falta counter se conserva columna central y no se ofrece Mostrador.

Evento local compartido con PosConsole, que lo admite solo en listado autorizado
con sesión válida, sin carga/escritura pendiente. Usa la misma función que el
botón existente de nueva orden: limpia selección/error y abre editor, sin guardar
ni refrescar historial. Botón del contenido queda solo en escritorio, evitando
acción duplicada en mobile. Navbar oculta en editor/orden/checkout según flujo
actual. Cache y API sin cambios. Barra general y sidebar conservadas.

## Archivos

Editar navegación y consola; crear pos-navigation.ts con nombre del evento.
Adaptar fixture e2e existente (catalog-harness-server.ts y pos.spec.ts) para que
use segmento pos; antes simulaba loyalty y ocultaría el acceso mobile nuevo.
No se añade una suite ni se ejecuta el navegador.
No disjunta con 0173/0178. Sin kit, servidor, API, CSS ni dependencias.

## Definition of Done

- [x] Typecheck, lint y guardia de archivos cambiados sin aumentos.
- [x] Formato y números de specs correctos.
- [ ] Owner verifica mobile POS / Nueva orden / Mostrador; centro abre editor,
      X vuelve a listado, sin cambiar navegación general/escritorio.

## Mutaciones y límites

0, L1. Sin nueva suite ni build global sobre dev activo. Owner pidió detener
pruebas durante entrega anterior; QA visual local a cargo del owner.
Spec sigue cerrada hasta evidencia real de QA; no marcar implementada por inferencia.
Commits propios en dev, sin merge ni push. Sin decisiones abiertas.

## Evidencia de entrega

Typecheck 6 paquetes verde (4,618 s); ESLint de 3 archivos de UI sin errores;
guardia UI 3 archivos sin aumentos; números sin duplicados y diff-check limpio.
Formato aplicado. Fixture POS usa segmento pos para conservar acceso a Nueva orden
en las pruebas existentes; otros fixtures conservan loyalty por defecto.
Sin ejecución adicional de suites ni QA visual de GPT; owner debe revisar en
pnpm dev:local antes de main. La paleta es la misma que el resto del backoffice.
