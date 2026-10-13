---
spec: 0217
fecha: 2026-10-13
estado: cerrada
resumen: Pantallas de módulos fuera del core; menú, Ajustes y permisos de Equipo desde manifiestos.
disjunta: no
archivos: apps/merchant/src/app/backoffice/{stock,recipes,settings,staff}/**, apps/merchant/src/app/backoffice/backoffice-navigation.tsx, apps/merchant/src/modules/{stock,recipes}/ui/**, apps/merchant/src/modules/ui-registry.ts, apps/merchant/src/modules/modules-boundary*.test.ts, tests/e2e/**
---

# 0217 — Pantallas de módulos: fase 1

## Problema

El encargo `docs/encargo-gpt-2026-10-13-modulos-fase1.md` mide los literales y directorios pendientes mediante PENDING_GPT y PENDING_GPT_DIRS. El menú fija dos entradas con permiso catalog, Ajustes fija dos cards y Equipo no ofrece los permisos de los manifiestos. CI de main 4208714 falla en pos.spec.ts:3667 por capturas en /private/tmp, inexistente en Linux.

## Alcance

Entra: traslado de pantallas, menú y Ajustes genéricos, permisos de módulo en Equipo, e2e y corrección portable de capturas POS y del presupuesto de carga de imágenes de landing. No entra: API, servidor, kit, migraciones, fase 2 POS, publicación.

## Diseño

ADR 0139 y MODULOS.md. Las pantallas se mudan completas a modules/<id>/ui, con imports al core/dependencias corregidos; las páginas fijas desaparecen y ui-registry apunta a las consolas. El despachador existente decide sesión, permiso y enabled; URLs intactas.

GET /api/modules (cualquier integrante) aporta id/name/description/requires/enabled/suggested/navigation/permissions. El menú llama moduleNavigation con rol y permisos, resuelve iconos por nombre y oculta módulos hasta lectura confirmada; un GET antiguo no pisa eventos de guardado. Ajustes conserva POS como hasta ahora; los demás switches salen del DTO, con dependencias derivadas de requires y enabled, sugeridos visibles y errores/reintento. PUT /api/modules/:id {enabled} confirma estado antes de publicar; 409 module_requires/missing y module_required_by/dependents se traducen usando nombres del DTO y recargan estado; otros fallos conservan estado.

Equipo carga los módulos sin bloquear el listado ante fallo; ofrece reintento y no permite nuevos permisos de módulo sin estado confirmado. Labels/descriptions del manifiesto se usan tanto en selector como listado. Permisos apagados se muestran deshabilitados y conservan selección preexistente; no se conceden nuevos, tampoco se borran silenciosamente al guardar. 422 module_disabled_permission tiene copy accionable. Se conserva protección de administrador/propios y contratos de alta/edición. Layout y componentes existentes, tuteo, sin cambios de estilos/kit.

## Archivos

| Archivo | Acción |
|---|---|
| app/backoffice/{stock,recipes}/** | mover pantallas y tests; borrar páginas fijas |
| modules/{stock,recipes}/ui/**; modules/ui-registry.ts | destino e imports |
| app/backoffice/backoffice-navigation.tsx; app/backoffice/module-icon.tsx; settings/module-{navigation,settings}.tsx/ts | menú/activación e iconos genéricos |
| app/backoffice/staff/{staff-contract,permission-picker,staff-views,staff-console}.tsx/ts; hook UI módulos | permisos desde DTO |
| modules/modules-boundary*.test.ts | vaciar listas exactas según encargo |
| tests/e2e/{module-settings,modules-ui,staff-modules,pos,ticket-settings}.spec.ts; support/** | fixtures completos, nuevas regresiones, capturas portables |
| docs/INDEX.md; docs/estado/gpt.md | reserva y evidencia |

No disjunta con 0216 por ui-registry y tests de frontera: servidor ya entregado, cambios serializados. Sin otros archivos de Claude.

## Definition of Done

- [x] PENDING_GPT={} y PENDING_GPT_DIRS=[]; ambas suites de frontera verdes.
- [x] Typecheck, lint, formato y node tools/ui-guard.ts --base origin/main sin nuevos hallazgos.
- [x] e2e POS nota 390/1280, Ajustes/dependencias, permisos de Equipo, Stock/Recetas desde ubicaciones nuevas verdes.
- [x] pnpm verify ejecutado una vez al final; tabla real y límites documentados.
- [x] Revisión adversarial conjunta de Claude: PASS documentado en 0216 (9204c30).
- [ ] Confirmación de H2 corregido en 3e33436 después de ese PASS.

## Plan de pruebas y verificación

Fixtures HTTP completos para navegación/permisos, un módulo adicional sintético prueba extensión sin nombres fijos, permisos propios con y sin enabled, fallos GET/PUT/422 y preservación de selección. Navegador a 390/1280, pruebas de consolas de módulos movidas y payloads sin alterar. Pruebas de frontera existentes actúan como oráculo independiente.

## Handoff requerido

GPT implementa; Claude revisa ambas partes según encargo. Sin merge/push. Evidencia ejecutada en estado GPT al cerrar.

## Abierto

Ninguna decisión de producto. QA final del owner y PASS Claude posteriores a implementación.

## Extensión mecánica de CI medida en verify

La corrida aislada encontró un fallo en landing.spec.ts:296: naturalWidth del hero desktop seguía en cero al vencer el poll predeterminado de 5 segundos. Se conserva naturalWidth > 0 y el presupuesto total de 120 segundos; el poll de la imagen usa 30 segundos para la optimización en dev bajo carga. No cambia producto ni umbrales de diseño. Se repite el gate e2e afectado sin repetir tipos/unitarios/build/Neon ya verdes sobre el mismo producto.

## Evidencia de implementación

UI `6f2272f` y ajustes e2e `b2482c4`/`8e837c8`, solo dev. [Handoff con tabla real de verify y repetición verde del gate e2e](../handoff-0217-modulos-fase1-2026-10-13.md). El PASS conjunto de Claude está documentado en 0216; la spec sigue cerrada hasta confirmar su H2, corregido en 3e33436.

## Hallazgo H2 de la revisión adversarial de Claude

PASS conjunto documentado en la spec 0216 y commit 9204c30. H2: el mapa cerrado de iconos obliga a editar el core para otro icono de iconoir. Se sustituye por resolución genérica del nombre contra los exports de la biblioteca, cargados en diferido y con componentes cacheados por nombre. Package queda como placeholder mientras carga; un nombre inválido tiene diagnóstico y fallback seguro. E2e usa Planet en el módulo sintético (sin import ni registro específico en el core) y verifica sus formas SVG, en móvil/escritorio. No cambia navegación, permisos ni contratos.

H2 implementado en `3e33436`: frontera13/13, e2e18/18, tipos/lint/guardia38 sin aumentos y build Merchant exit0. Confirmación del revisor pendiente.
