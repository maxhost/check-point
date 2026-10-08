---
spec: 0173
fecha: 2026-10-08
estado: cerrada
resumen: La navegación mobile en POS muestra accesos directos POS y Mostrador con los estilos existentes.
disjunta: no
archivos: apps/merchant/src/app/backoffice/backoffice-navigation.tsx
---

# 0173 — Navegación mobile del POS

L1 (ADR 0129), mini plan cerrado antes del código.

## Problema

`backoffice-navigation.tsx:361` muestra en POS la barra general con menús de administración.
El owner pide dos accesos simples: POS y Mostrador.

## Alcance y diseño

Cuando el segmento seleccionado es `pos`, la barra mobile reutiliza NavLink para POS
y Mostrador, en ese orden, con sus destinos actuales. POS requiere permiso pos y
Mostrador permiso counter; no se ofrece un destino sin permiso. La página POS sigue
validando módulo y autorización como hasta ahora. Cada acceso ocupa una columna igual
mediante utilidades Tailwind sobre el contenedor existente. POS conserva aria-current
y el estado visual activo. Sin menús desplegables en esa barra.

Escritorio y navegación de las otras vistas mantienen su comportamiento.
No cambia el botón Actualizar órdenes ni la caché de 0172. Sin API, kit, CSS nuevo,
migraciones, polling ni cambios de sesión.

## Archivos

Editar `apps/merchant/src/app/backoffice/backoffice-navigation.tsx`.
No disjunta con cambios en la navegación del backoffice.

## Definition of Done

- [x] Navegador móvil con Next real: POS y Mostrador visibles, destinos correctos,
      POS activo y dos columnas iguales; captura vista, sin errores de página.
- [x] Escritorio conserva sidebar y oculta barra mobile.
- [x] Typecheck, lint del archivo, formato, guardia UI sin aumentos y números verdes.

## Mutaciones y límites

0, L1. Sin nueva suite ni build sobre el servidor dev activo. Revisión global antes
de main; QA del owner con pnpm dev:local. Commits locales en dev, sin merge ni push.
Sin decisiones abiertas.

## Evidencia

Next real local con sesión de semilla y lecturas POS simuladas: móvil 390 px,
dos enlaces con destinos correctos, POS aria-current page y columnas 189 px/189 px;
escritorio 1100 px conserva sidebar y oculta barra mobile. Capturas vistas en
/private/tmp/pos-0173-mobile.png y pos-0173-desktop.png. Nueva orden y catálogo
visibles, cero pageErrors. Node 24.20.0: typecheck 6 paquetes, ESLint, Prettier,
guardia UI 22 archivos sin aumentos, números y diff-check verdes.
