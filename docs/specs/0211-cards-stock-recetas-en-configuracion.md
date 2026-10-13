---
spec: 0211
fecha: 2026-10-12
estado: implementada
resumen: Dos cards Stock y Recetas en Configuración, con activación mediante el contrato 0210 y dependencias visibles.
disjunta: si
archivos: apps/merchant/src/app/backoffice/settings/module-settings.tsx, apps/merchant/src/app/backoffice/settings/pos-settings.tsx, tests/e2e/module-settings.spec.ts
---

# 0211 — Cards de Stock y Recetas en Configuración

Owner clasifica este ajuste como **L1** (ADR 0129): mini plan y pruebas menores de 3 minutos, sin verify global ni revisor. Se conserva esta reserva documental previa a su aclaración; no agrega requisitos L2/L3.

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

- [x] E2E: dos cards visibles, persistencia tras recarga y dependencias respetadas; fallo y reintento sin estado ficticio; no-owner no consulta módulos.
- [x] Capturas a 390 y 1280 px vistas, sin overflow.
- [x] Typecheck merchant, ESLint de archivos, formato y guardia UI en verde.
- No se corre `pnpm verify`: cambio L1, por instrucción del owner.
- Revisión directa del diff, sin subagentes (L1).

## Mutaciones — presupuesto: 0

Cambio acotado con pruebas de comportamiento HTTP; sin mutaciones adicionales.

## Declarado afuera

Backend 0210 y migración local pueden estar en curso: el E2E simulado no prueba su disponibilidad real.

## Handoff

GPT implementa la UI. Solo dev local; verificación acotada L1.

## Abierto

Ninguna decisión de producto abierta para estas dos cards.

## Verificación real L1

Node 24: typecheck merchant, ESLint archivos, formato, guardia --base HEAD y diffcheck salida 0. Chromium: 3/3 en 2.3 segundos, HTTP simulado; capturas 390/1280 vistas, sin overflow. Primer intento bloqueado por listen EPERM del sandbox; repetición autorizada verde. No verify global ni revisor, por L1. Backend y base local no verificados por estas pruebas. Capturas en `/private/tmp/checkpass-0211-results/`.

## Ajuste L1 — panel compacto

Owner pidió conservar información y reducir espacio al sumar módulos. POS, Stock y Recetas se agrupan en un panel con filas separadas por línea; descripción izquierda y estado/acción derecha en escritorio, controles bajo el texto en móvil. Impresión conserva su bloque. Contratos y controles intactos.

Owner pide reemplazar botones por Switch del kit, como impresión. Nombre accesible POS/Stock/Recetas, estado real conservado hasta confirmación HTTP, Guardando… y controles deshabilitados durante PUT; dependencias intactas.

## Activación y navegación real — 2026-10-12

Owner pide conectar el menú con los toggles según contrato0210 ya implementado. Los toggles conservan GET/PUT; cada lectura/guardado confirmado publica el estado completo al menú. Navegación hace GET sin caché para owner o permiso catalog, oculta Stock/Recetas hasta lectura real y filtra desktop/móvil y delegados por enabled. GET anterior no pisa un evento posterior. Fallo de PUT no publica ni cambia menú; dependencias existentes intactas. Pantallas Stock/Recetas siguen como prototipos, no se conecta su contenido ni se cambia API/servidor. Verificación breve sin Chrome por owner: tipos, ESLint, guardia y diffcheck0; 9 aserciones Node de visibilidad/evento verdes.
