---
spec: 0194
fecha: 2026-10-10
estado: cerrada
resumen: Excluir del índice buscador las pantallas merchant y consumer mediante metadatos noindex.
disjunta: si
archivos: apps/merchant/src/app/layout.tsx, apps/consumer/src/app/layout.tsx
---

# 0194 — Noindex en aplicaciones privadas

## Problema

Los metadatos raíz de merchant y consumer no declaran noindex. El owner pide que business, my y admin no aparezcan en buscadores; solo la web pública del producto interesa.

## Alcance

Entra: robots index false y follow false en los dos layouts raíz. Verificar herencia en rutas representativas y ausencia de robots index true en hijos.
No entra: API, headers de hosting, autenticación ni apps/platform (zona de Claude, petición en handoff).

## Diseño

Usar Metadata de Next, sin bloquear rastreo mediante robots.txt. Noindex es directiva para buscadores, no control de acceso. Las APIs conservan sus guardias. Claude debe aplicar noindex en plataforma y cubrir respuestas no HTML con X-Robots-Tag si corresponde.

## Archivos

Editar layouts raíz de merchant y consumer, sin tocar kits.

## Definition of Done

- [ ] Typecheck de apps afectadas y lint de layouts en 0.
- [ ] HTML de rutas representativas devuelve meta robots noindex, nofollow.
- [ ] Registrada limitación: sin deploy no se afirma exclusión efectiva en índices.

## Mutaciones

Presupuesto 0: metadatos declarativos, comprobación directa de HTML.

## Handoff

Root implementa y verifica. Admin y cabeceras globales quedan en petición concreta a Claude.

## Abierto

Nada bloquea el ajuste local de los dos layouts.

## Evidencia local

Typecheck merchant y consumer, lint layouts y diff check en 0. En HTML de onboarding merchant (3201) y raíz consumer (3200) se verificó meta robots noindex, nofollow. No se afirma estado del índice ni publicación; admin pendiente de Claude.
