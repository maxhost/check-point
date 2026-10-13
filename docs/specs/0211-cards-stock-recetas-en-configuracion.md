---
spec: 0211
fecha: 2026-10-12
estado: cerrada
resumen: Dos cards Stock y Recetas en Configuración, con activación mediante el contrato 0210 y dependencias visibles.
disjunta: si
archivos: apps/merchant/src/app/backoffice/settings/module-settings.tsx, apps/merchant/src/app/backoffice/settings/pos-settings.tsx, tests/e2e/module-settings.spec.ts
---

# 0211 — Cards de Stock y Recetas en Configuración

## Problema

`apps/merchant/src/app/backoffice/settings/pos-settings.tsx:82` muestra solo el módulo POS; Stock y Recetas del contrato 0210 no tienen controles en Configuración.

## Alcance

Entra: dos cards con el mismo kit, espaciado y estructura del POS; carga, reintento, activación y desactivación; dependencia Recetas → Stock visible.
No entra: pantallas de gestión de insumos o recetas, navegación nueva, API, servidor, kit, migraciones ni publicación.

## Diseño

Componente montado solo para owner, después de POS y antes de tickets. GET `/api/modules` carga el estado real; PUT `/api/modules/:id` envía `{ enabled }`, sustituye solo el módulo confirmado y refresca el router. Contrato y autorización: spec 0210. No importa código de servidor.

Siempre muestra Stock y Recetas. Mientras carga o falla no inventa un estado y deshabilita acciones; fallo de GET permite reintentar. Un lock compartido evita cambios simultáneos. Recetas apagado sin Stock impide activar y explica «Activa Stock para usar Recetas». Stock encendido con Recetas impide desactivar y explica «Desactiva Recetas antes de desactivar Stock». 409 module_requires/module_required_by explica la dependencia y vuelve a leer estados; otros 4xx/5xx/red mantienen el estado y permiten reintentar. Sin activaciones en cascada. 401/403/404/422 se muestran como error sin anunciar éxito.

Copy Stock: «Registra tus insumos, compras y ajustes para consultar el stock estimado y el último costo de compra». Copy Recetas: «Define los insumos y cantidades de cada producto para calcular su costo y margen con los últimos costos de compra»; requiere Stock. Botones Activar/Desactivar Stock/Recetas.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/settings/module-settings.tsx` | Crear |
| `apps/merchant/src/app/backoffice/settings/pos-settings.tsx` | Montar cards |
| `tests/e2e/module-settings.spec.ts` | Verificar con HTTP simulado |

Disjunta: sí, de 0210 (API/servidor) y 0209 (POS).

## Definition of Done

- [ ] E2E: dos cards visibles, persistencia tras recarga y dependencias respetadas; fallo y reintento sin estado ficticio; no-owner no consulta módulos.
- [ ] Capturas a 390 y 1280 px vistas, sin overflow.
- [ ] Typecheck merchant, ESLint de archivos, formato y guardia UI en verde.
- [ ] `pnpm verify` una vez al final con tabla real; fallos ajenos se declaran.
- [ ] Revisión independiente con evidencia antes de marcar implementada.

## Mutaciones — presupuesto: 0

Cambio acotado con pruebas de comportamiento HTTP; sin mutaciones adicionales.

## Declarado afuera

Backend 0210 y migración local pueden estar en curso: el E2E simulado no prueba su disponibilidad real.

## Handoff

GPT implementa la UI; revisor independiente al cierre. Solo dev local.

## Abierto

Ninguna decisión de producto abierta para estas dos cards.
