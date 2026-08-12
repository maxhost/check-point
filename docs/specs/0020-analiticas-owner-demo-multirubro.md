---
spec: 0020
fecha: 2026-08-11
estado: cerrada
resumen: Dashboard owner demo multirubro con núcleo universal, embudo de campaña, calidad de dato y lentes Bar/Restaurante, Hotel y Retail.
disjunta: no
archivos: apps/merchant, pruebas merchant y e2e, docs
---

# 0020 — Analíticas owner demo multirubro

## Problema

El owner necesita entender campañas y fidelidad sin que Mi Pasaporte invente ventas o
ROI. Analíticas es hoy un placeholder y no prueba que el producto sea multi-rubro.

## Alcance

**Entra:** ruta `/backoffice/demo/analytics`; KPIs universales, tendencia, embudo,
distribución temporal y calidad de dato fixture; filtros visuales de periodo/local; switch
flotante accesible **Vista demo** para Bar/Restaurante, Hotel y Retail; estados sin datos e
insuficientes representables por fixture. Retail incluye datos transaccionales fixture;
Bar y Hotel no fingen ticket/ROI.

**No entra:** backend, POS, agregados, CSV, cohortes, segmentación, demografía, A/B,
atribución causal, ROI, persistencia del switch o comparación entre negocios.

## Diseño

En móvil: header/filtros, cuatro KPIs, calidad de dato, tendencia, embudo, heatmap y lente
del rubro. El selector queda fijo abajo a la derecha, anuncia que cambia sólo la vista y
no tapa controles. Los charts usan HTML/CSS y alternativa textual, no una librería pesada.

### Especificación técnica

- `analytics.ts` expone fixtures inmutables tipadas `bar_restaurant`, `hotel`, `retail`,
  con KPIs, serie, embudo, heatmap, lente y calidad `observed`, `configured_estimate`,
  `transactional` o `unavailable`.
- La ruta es Client Component. El sector es estado local inicial `bar_restaurant`; no
  escribe `merchant-demo`. Lee ese fixture sólo para el estado sin onboarding.
- Extraer presentación repetida para KPI, embudo, heatmap y switch. Reutilizar
  `ModuleHeader` y estilos/tokens existentes.
- Validar que el embudo no aumenta y que `unavailable` no tiene valor numérico. Foco
  visible y controles táctiles de 44 px.

### Arquitectura de referencia

ADR 0017, ADR 0018, ADR 0020, ADR 0021; Specs 0003, 0004, 0007 y 0009.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/demo/analytics/page.tsx` | crear dashboard |
| `apps/merchant/src/app/analytics.ts`, `analytics.test.ts` | crear fixtures/validación |
| `apps/merchant/src/app/components/**`, `globals.css` | crear/reutilizar presentación |
| `tests/e2e/analytics.spec.ts` | crear flujo de cambio de lente |
| `docs/INDEX.md`, `docs/TASKS.md` | editar |

### Disjunta?

No. Comparte home, estilos y componentes merchant con las otras specs demo.

## Definition of Done

- [ ] Owner abre Analíticas y ve filtros, KPIs, tendencia, embudo y distribución legibles.
- [ ] Cada métrica muestra calidad de dato; no hay revenue, ROI o atribución ficticios.
- [ ] El switch flotante cambia con teclado entre Bar/Restaurante, Hotel y Retail sin
  escribir el negocio demo.
- [ ] Los lentes conservan el núcleo y sólo añaden métricas compatibles; Hotel no inventa
  ocupación y Bar no inventa ventas.
- [ ] Responsive, accesible, sin chart pesado y con componentes reutilizables.
- [ ] Unit, E2E, format, lint, typecheck, build y PASS independiente.

## Plan de pruebas y verificación

- [ ] Unidad: embudo no creciente, calidad válida y `unavailable` sin valor.
- [ ] Unidad: cada sector expone su lente sin conceptos de otro.
- [ ] E2E: owner abre Analíticas, cambia sector y no muta `merchant-demo`.
- [ ] Manual: móvil/escritorio, teclado/foco del switch y calidad de dato.
- [ ] Comandos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e`, `pnpm build`.

## Abierto

No hay bloqueos para el mock. Agregados reales, exportación, POS, autorización y métricas
económicas se implementan con la Spec 0007.
