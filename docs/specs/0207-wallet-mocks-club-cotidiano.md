---
spec: 0207
fecha: 2026-10-11
estado: implementada
resumen: Mocks HTML/CSS de acceso, inscripción y confirmación mobile first; Club cotidiano con paleta A.
disjunta: si
archivos: docs/qa/0207/**, apps/consumer/PRODUCT.md, apps/consumer/DESIGN.md, apps/consumer/.impeccable/**
---

# 0207 — Mocks de la wallet: Club cotidiano, paleta A

## Problema

El owner eligió concepto 2 y paleta A mediante imágenes y necesita HTML/CSS para ajustar textos y espacios. `apps/consumer/src/app/(consumer)/wallet/page.tsx`, `enroll/[programId]/page.tsx` y `enroll-confirmation.module.css` presentan composiciones distintas.

## Alcance

**Entra:** prototipo local autónomo de login, inscripción sin sesión, inscripción con sesión y confirmación/instalación. Paleta A, tuteo, mobile first. Comparación/vista individual, navegación simulada y controles de texto/espaciado.

**No entra:** rutas reales, OAuth, API, sesiones, datos, inscripción/instalación real, wallet interna, publicación, merge ni deploy.

## Diseño

HTML, CSS y JavaScript estáticos en `docs/qa/0207/mocks/`. Ejemplos Café del Barrio y Ana. Símbolo existente de CheckPass; Google y Apple con identidad propia. Acciones simuladas navegan solo entre estados del mock; inscripción con sesión requiere pulsar el botón. Instalación iOS: Compartir → Añadir a pantalla de inicio → Añadir. Android: instrucciones del menú, botón que simula instalación.

Controles de revisión externos: pantalla, comparación, plataforma, ancho, nombre/comercio, titular, margen y separación. Textos editables sin enviar datos ni persistirlos. Aviso visible de prototipo, foco visible, sin endpoints reales.

## Archivos

| Archivo | Acción |
|---|---|
| `docs/qa/0207/mocks/index.html` | Crear |
| `docs/qa/0207/mocks/styles.css` | Crear |
| `docs/qa/0207/mocks/mock.js` | Crear |
| `docs/qa/0207/README.md` | Evidencia y uso |
| `apps/consumer/PRODUCT.md` | Registrar selección |
| `apps/consumer/DESIGN.md`, `.impeccable/design.json`, `.impeccable/surfaces/**` | Documentar mundo y alcance del prototipo |

**Disjunta:** sí; no modifica componentes de app ni trabajo paralelo.

## Definition of Done

- [x] Cuatro pantallas cargan sin errores JS ni solicitudes a API; Chromium salida0, `docs/qa/0207/captures/checks.json`.
- [x] Inspección y capturas a390px/1440px; sin overflow a320/360/390/430px.
- [x] Funcionan navegación simulada, edición, controles y plataforma; checks.json registra cobertura.
- [x] Revisión independiente con nueve capturas; fix tipográfico aplicado y verdict pass ship, `docs/qa/0207/README.md`.
- [x] `git diff --check` y sintaxisJS verde; documentación distingue mock de implementación real.

## Mutaciones — presupuesto: 0

Prototipo visual reversible; revisión en navegador, sin suites de producción ni mutaciones.

## Declarado AFUERA

OAuth, inscripción, datos, PWA y permisos reales. Verify global no es gate de este prototipo documental aislado. CI main consultado verde, sin afirmar una corrida nueva de suites.

## Handoff

Un implementador y revisión visual independiente según Impeccable. El owner ajusta textos/composición antes de una futura implementación real.

## Abierto

Sin bloqueos para el mock. Textos sujetos a ajuste del owner.
