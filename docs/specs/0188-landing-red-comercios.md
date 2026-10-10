---
spec: 0188
fecha: 2026-10-10
estado: cerrada
resumen: Landing del comercio centrada en red, campañas y POS, con propuesta de planes para QA local.
disjunta: si
archivos: apps/public/src/app/page.tsx, apps/public/src/app/negocios/preview.tsx, apps/public/src/app/negocios/campaign-section.tsx, apps/public/src/app/negocios/closing-sections.tsx, apps/public/src/app/negocios/negocios.css, tests/e2e/landing.spec.ts
---

# 0188 — Landing de la red de comercios

## Problema

- `apps/public/src/app/page.tsx:127` presenta solo visitas recurrentes, sin explicar venta cruzada ni POS.
- `apps/public/src/app/negocios/closing-sections.tsx:92` ofrece Gratis y Plus, mientras el owner pidió prueba de tres meses y dos planes pagos.
- `apps/public/src/app/negocios/preview.tsx:40` ilustra sellos, sin mostrar red ni operación por mesa.

## Alcance

**Entra:** copy, secciones y previews de la landing pública en dev, conservando el lenguaje visual; modos claro/oscuro y QA 390 px/escritorio. Nivel L2, sin subagentes según ADR 0129.

**No entra:** API, billing, planes efectivos, merchant, herramientas, migraciones, merge ni push. La publicación queda bloqueada por billing según el encargo del owner.

## Diseño

Landing estática, sin consultas ni mutaciones. Orden: hero → red → campañas → POS/mostrador → tres pasos → cliente → planes → FAQ → CTA. Hero elegido «Más clientes nuevos. Más razones para volver.»; alternativas propuestas antes del código en la conversación. La red enlaza `/explorar`; las fichas reales se descubren desde allí. Previews explícitamente ilustrativos, sin métricas ni clientes reales.

Nombres recomendados Conecta/Impulso (alternativas Club/Club Pro, Esencial/Crece). Propuesta visual: $20 USD/mes con 1 local, $45 con hasta 3, adicional $12; precios referenciales sujetos al owner. Ambos incluyen fidelización, wallet, mostrador, catálogo, clientes y Bienvenida/Venta cruzada; Impulso suma todas las campañas existentes. Prueba gratis de tres meses con todo incluido, sin afirmar ausencia de tarjeta. POS se explica fuera de columnas: su asignación a planes no se decide aquí. Los puntos/sellos son independientes por comercio. No prometer funciones futuras.

Conservar eyebrow/kicker, títulos con em, tarjetas, plan-grid, final-cta y fotografías; extender CSS local a la landing para ilustraciones y esquema oscuro del sistema. CTA consume onboardingUrl existente; `/negocios` sigue redirigiendo a `/`. Navegación por anclas y FAQ nativos accesibles; sin cuentas ni acceso a base de datos en pruebas.

## Archivos

| Archivo | Acción |
| --- | --- |
| `apps/public/src/app/page.tsx` | copy, orden de secciones y SEO |
| `apps/public/src/app/negocios/preview.tsx` | ilustraciones de red y POS |
| `apps/public/src/app/negocios/campaign-section.tsx` | tarjetas de campañas |
| `apps/public/src/app/negocios/closing-sections.tsx` | propuesta de planes, FAQ, CTA |
| `apps/public/src/app/negocios/negocios.css` | extensiones responsivas y oscuro |
| `tests/e2e/landing.spec.ts` | QA pública sin DB en cuatro combinaciones |

Disjunta de 0187 y de cambios de Claude en API/billing. Reserva local por instrucción explícita de no push.

## Definition of Done

- [ ] Typecheck public y lint de public/prueba en salida 0 con Node 24.
- [ ] Formato de archivos cambiados y git diff --check en 0.
- [ ] E2E landing: 390/1440 px × claro/oscuro, sin overflow horizontal, planes y CTA correctos, FAQ y enlace a red; `/negocios` redirige.
- [ ] Capturas inspeccionadas en las cuatro combinaciones, incluyendo planes y POS.
- [ ] Handoff GPT con evidencia y dependencias de publicación, precios finales y POS.

Pruebas específicas de L2; verify completo reservado al pase a live (ADR 0128/0129). Sin presupuesto adversarial: contenido estático reversible, sin acceso a dinero ni datos. No se modifica lógica de alta o suscripción.

## Abierto

Fuera del alcance local: Claude debe implementar prueba de tres meses y Venta cruzada en plan base antes de publicar, salvo excepción explícita del owner. Owner confirma precio superior, adicional y plan de POS. Esto no bloquea la propuesta local solicitada.
