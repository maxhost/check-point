---
spec: 0205
fecha: 2026-10-11
estado: cerrada
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

- [ ] E2E: raíz y onboarding sin parámetro muestran login; signup=1 muestra alta;
      signup=0 sigue en login; Crear un negocio permite alta desde login.
- [ ] E2E existentes de código y alta pasan con sus entradas actualizadas.
- [ ] Typecheck, ESLint y formato de merchant/public, guardia UI y diffcheck en 0.
- [ ] El URL público de alta tiene signup=1 y se preserva el override de entorno.

## Mutaciones

Presupuesto 0: cambio de entrada de UI cubierto por navegación e2e existente.

## Declarado AFUERA

No se publica; QA del owner y verify global quedan para el pase conjunto a live.

## Handoff

GPT implementa y verifica; revisión del owner en local. Reserva local por la
instrucción vigente de no push en dev. No hay subagentes.

## Abierto

Nada.
