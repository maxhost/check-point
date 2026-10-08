# Handoff 0172 — Caché POS en memoria

2026-10-08. Rama dev, sin merge ni push. Reserva 69191fc. Spec cerrada, no marcada implementada
hasta QA/entrega según proceso del repo. API, servidor, kit, CSS, migraciones y tooling intactos.

PosCache es privado a un montaje de PosConsole y a user.id/business.id. Conserva detalle por
ID, historial y catálogo por local; deduplica GET en vuelo y descarta generaciones anteriores.
No TTL, intervalos, listeners de foco/visibilidad ni persistencia. Crear/guardar publica la
respuesta real y parchea historial. Cerrar/anular reconcilia historial una vez; anular lee antes
de confirmar porque 0169 no lleva versión. Actualizar órdenes invalida explícitamente y
conserva borrador en edición; cambio de identidad/autorización lo destruye. Lecturas fallidas
con copia la conservan; una respuesta vieja no sustituye guardados/conflictos ni otra mesa.

## Evidencia ejecutada

Node 24.20.0. Config temporal de Playwright con testDir del repo, worker 1 y sin webServer;
harness existente, UI/CSS reales y HTTP simulado. No se modifica config/tooling del repo.

| Comprobación | Resultado |
|---|---|
| pnpm typecheck | 6 paquetes correctos, merchant recompilado tras el cambio final |
| ESLint de los 5 archivos de código/pruebas cambiados | Verde |
| Prettier de archivos cambiados | Verde |
| node tools/ui-guard.ts | 22 archivos, sin aumentos |
| node tools/check-numbers.ts | Sin números duplicados |
| git diff --check | Verde |
| Playwright POS + counter-mobile + counter-coupon-verdict | **37 pasan, 24,7 s**: 32 POS (incluidas 2 pruebas de caché sin navegador) y 5 Mostrador |
| Capturas 390 px / 1100 px | Vistas; paridad con catálogo compartido, sin overflow de página |

Comando ejecutado:

```sh
pnpm exec playwright test --config /private/tmp/checkpoint-pos-playwright.config.ts tests/e2e/pos.spec.ts tests/e2e/counter-mobile.spec.ts tests/e2e/counter-coupon-verdict.spec.ts
```

Salida final en /private/tmp/pos-0172-e2e-final.log. No build/full verify sobre dev local activo
(L2, ADR 0129); pnpm verify completo corresponde antes de pasar a main. ci:status no pudo
consultar GitHub (fetch failed, informativo). No se usan conexiones de DB en estos tests.

## Solicitudes comprobadas por aserciones

| Recorrido | GET observados |
|---|---|
| Crear → editar/guardar → historial → abrir | **0 adicionales** de sesión, historial, detalle y catálogo después de primera carga |
| Mesa nunca visitada → volver → abrir | 1 detalle total; segunda apertura no lee |
| Avanzar 1 h → foco/visibilidad → reabrir | 0 adicionales |
| Centro → Norte → Centro | 1 catálogo por local; no mezclar productos |
| Actualizar desde edición | Una nueva sesión/historial y catálogo del local activo; conserva mesa, lineId, versión y precios guardados |
| Cerrar/anular | Una lectura adicional de historial para Cerradas hoy; reabrir la cerrada/anulada no lee detalle |
| Anular | Una lectura previa; si cambió, revisar y accionar nuevamente antes de confirmar |

La navegación compartida del harness también consulta sesión al montar; el test de ahorro
compara el total después de carga contra el total después de todo el recorrido, sin atribuir
a PosConsole ese GET de navegación. No se midió latencia de DB ni se promete un número de ms.

Cobro con pase mantiene el sondeo de cupones existente: esta caché no lo cambia. UUID/cuerpo
congelados ante transporte/5xx siguen probados. Avisos entre operadores quedan para trabajo
futuro; mesas nuevas/cambios externos se sincronizan con Actualizar órdenes o un conflicto.

## QA pendiente del owner

Con pnpm dev:local: crear, volver y reabrir; editar/guardar y comprobar producto/precio; cerrar
y anular, comprobar grupos del historial. Con dos operadores, editar la misma versión y
verificar conflicto sin sobrescritura; Actualizar órdenes debe descubrir mesas del otro.
En Network, comprobar cero GET al esperar, recuperar foco y reabrir una mesa cacheada.
Recargar o salir de POS destruye caché y hace la carga inicial normal. Probar pase/cupón reales
sin alterar los reintentos. No pasar a main ni publicar sin QA y gate correspondientes.
