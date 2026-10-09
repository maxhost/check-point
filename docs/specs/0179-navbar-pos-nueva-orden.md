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
No disjunta con 0173/0178. Sin kit, servidor, API, CSS ni dependencias.

## Definition of Done

- [ ] Typecheck, lint y guardia de archivos cambiados sin aumentos.
- [ ] Formato y números de specs correctos.
- [ ] Owner verifica mobile POS / Nueva orden / Mostrador; centro abre editor,
      X vuelve a listado, sin cambiar navegación general/escritorio.

## Mutaciones y límites

0, L1. Sin nueva suite ni build global sobre dev activo. Owner pidió detener
pruebas durante entrega anterior; QA visual local a cargo del owner.
Spec sigue cerrada hasta evidencia real de QA; no marcar implementada por inferencia.
Commits propios en dev, sin merge ni push. Sin decisiones abiertas.
