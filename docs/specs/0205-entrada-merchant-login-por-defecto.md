---
spec: 0205
fecha: 2026-10-11
estado: implementada local
resumen: El dominio del comercio abre login por defecto; signup=1 abre el registro y los CTA públicos de alta llevan ese parámetro.
disjunta: no
archivos: apps/merchant/src/app/page.tsx, apps/merchant/src/app/[locale]/(merchant)/business/onboarding/page.tsx, apps/merchant/src/app/[locale]/(merchant)/business/onboarding/_components/onboarding-wizard.tsx, apps/public/src/app/site-config.ts, tests/e2e/merchant-entry.spec.ts, tests/e2e/merchant-login-code.spec.ts, tests/e2e/onboarding-google-places.spec.ts
---

# 0205 — Entrada merchant con login por defecto

## Problema

`apps/merchant/src/app/page.tsx` envía visitantes sin sesión a onboarding;
`onboarding-wizard.tsx` restaura la etapa business y muestra el registro por
defecto. El owner pide login como entrada habitual y registro mediante parámetro.

## Alcance

**Entra:** login por defecto en la raíz y onboarding; registro explícito con
`?signup=1`; conservar el cambio manual entre login y registro; CTA públicos de
alta con el parámetro. Commit en dev, sin push ni merge, por instrucción vigente.

**No entra:** API, servidor, paquetes, cookies, guard de permisos, kit, estilos,
reglas del alta/login ni rutas de rebote. Sesión válida sigue al panel.

## Diseño

La raíz conserva la prioridad de `?e=` y la comprobación de sesión. Para una
sesión ausente/inválida, propaga solo `signup=1` al destino de onboarding cuando
el valor es exactamente el string `1`; otros valores y duplicados no abren alta.
La página de onboarding lee searchParams y pasa un boolean al wizard. Después
de restaurar el estado, sin sesión abre login salvo signup=1; con sesión mantiene
el destino actual. El prefill se carga como hoy para que Crear un negocio funcione.
El título/metadata del onboarding corresponde al login o al registro solicitado.
El URL compartido de alta pública suma signup=1, preservando los parámetros del
MERCHANT_ONBOARDING_URL configurado. No hay destino arbitrario del query.

## Archivos

Los enumerados en el frontmatter, y docs/INDEX.md/estado/gpt.md para el cierre.

**Disjunta?** No: amplía el wizard del login 0202 ya commiteado.

## Definition of Done

- [x] E2E: raíz y onboarding sin parámetro muestran login; signup=1 muestra alta;
      signup=0 sigue en login; Crear un negocio permite alta desde login.
- [x] E2E existentes de código y alta pasan con sus entradas actualizadas.
- [x] Typecheck, ESLint y formato de merchant/public, guardia UI y diffcheck en 0.
- [x] El URL público de alta tiene signup=1 y se preserva el override de entorno.

## Mutaciones

Presupuesto 0: cambio de entrada de UI cubierto por navegación e2e existente.

## Declarado AFUERA

No se publica; QA del owner y verify global quedan para el pase conjunto a live.

## Handoff

GPT implementa y verifica; revisión del owner en local. Reserva local por la
instrucción vigente de no push en dev. No hay subagentes.

## Abierto

Nada.

## Cierre

Commit UI `0af3d6a38a1d538fb631b91dfda32935c725998c` en dev. Reserva local `b8201e3`. Sin push ni merge.
Node 24.20.0: typecheck merchant/public, ESLint ambos paquetes y e2e,
Prettier ambos paquetes y archivos tocados, guardia UI y diffcheck, salida 0.
E2E 18/18: ocho de entrada, siete de código y tres de alta/Places; reporte
`/private/tmp/0205-report/index.html`. Unit existentes 4/4 (entry-billing y
onboarding-flow). URL público de alta comprobado con default y con override
`MERCHANT_ONBOARDING_URL` que conserva campaign=qa. Sesión y rebotes mantienen
su manejo; no se cambió autenticación ni se ejecutó integración contra la base.
Revisión del owner y pase conjunto a live pendientes.

## Ajuste L0 aprobado y merge local (2026-10-11)

Owner aprobó en local las pestañas «Iniciar sesión» / «Crear un negocio» y pidió
commit + merge de todo a main. Commit UI `7797b242f19fd9afdc11361fef7542d117ab8a07`.
Reemplazan los accesos inferiores; alternar actualiza signup=1 (registro) o lo
quita (login), preservando el resto de la URL. Alta deshabilitada mientras se
solicita el código. Componentes Tabs del kit, sin CSS ni cambios de autenticación.
Typecheck, ESLint y guardia UI en 0; formato y diffcheck en 0. Selector del e2e
existente actualizado a tab; sin ejecutar suites para este ajuste L0.
Main local actualizado a ese commit por fast-forward desde a480692. El owner
indicó expresamente no correr suite completa: pnpm verify no llegó a iniciarse.
Los 18 e2e y 4 unit de la entrada original son evidencia anterior al ajuste de
pestañas, no se presentan como reejecutados. Sin push ni deploy.
