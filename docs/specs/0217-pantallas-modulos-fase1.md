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

Entra: traslado de pantallas, menú y Ajustes genéricos, permisos de módulo en Equipo, e2e y corrección portable de capturas POS. No entra: API, servidor, kit, migraciones, fase 2 POS, publicación.

## Diseño

ADR 0139 y MODULOS.md. Las pantallas se mudan completas a modules/<id>/ui, con imports al core/dependencias corregidos; las páginas fijas desaparecen y ui-registry apunta a las consolas. El despachador existente decide sesión, permiso y enabled; URLs intactas.

GET /api/modules (cualquier integrante) aporta id/name/description/requires/enabled/suggested/navigation/permissions. El menú llama moduleNavigation con rol y permisos, resuelve iconos por nombre y oculta módulos hasta lectura confirmada; un GET antiguo no pisa eventos de guardado. Ajustes conserva POS como hasta ahora; los demás switches salen del DTO, con dependencias derivadas de requires y enabled, sugeridos visibles y errores/reintento. PUT /api/modules/:id {enabled} confirma estado antes de publicar; 409 module_requires/missing y module_required_by/dependents se traducen usando nombres del DTO y recargan estado; otros fallos conservan estado.

Equipo carga los módulos sin bloquear el listado ante fallo; ofrece reintento y no permite nuevos permisos de módulo sin estado confirmado. Labels/descriptions del manifiesto se usan tanto en selector como listado. Permisos apagados se muestran deshabilitados y conservan selección preexistente; no se conceden nuevos, tampoco se borran silenciosamente al guardar. 422 module_disabled_permission tiene copy accionable. Se conserva protección de administrador/propios y contratos de alta/edición. Layout y componentes existentes, tuteo, sin cambios de estilos/kit.

## Archivos

| Archivo | Acción |
|---|---|
| app/backoffice/{stock,recipes}/** | mover pantallas y tests; borrar páginas fijas |
| modules/{stock,recipes}/ui/**; modules/ui-registry.ts | destino e imports |
| app/backoffice/backoffice-navigation.tsx; settings/module-{navigation,settings}.tsx/ts | menú/activación genéricos |
| app/backoffice/staff/{staff-contract,permission-picker,staff-views,staff-console}.tsx/ts; hook UI módulos | permisos desde DTO |
| modules/modules-boundary*.test.ts | vaciar listas exactas según encargo |
| tests/e2e/{module-settings,modules-ui,staff-modules,pos,ticket-settings}.spec.ts; support/** | fixtures completos, nuevas regresiones, capturas portables |
| docs/INDEX.md; docs/estado/gpt.md | reserva y evidencia |

No disjunta con 0216 por ui-registry y tests de frontera: servidor ya entregado, cambios serializados. Sin otros archivos de Claude.

## Definition of Done

- [ ] PENDING_GPT={} y PENDING_GPT_DIRS=[]; ambas suites de frontera verdes.
- [ ] Typecheck, lint, formato y node tools/ui-guard.ts --base origin/main sin nuevos hallazgos.
- [ ] e2e POS nota 390/1280, Ajustes/dependencias, permisos de Equipo, Stock/Recetas desde ubicaciones nuevas verdes.
- [ ] pnpm verify ejecutado una vez al final; tabla real y límites documentados.
- [ ] Revisión adversarial de Claude sobre ambas partes antes de marcar implementada.

## Plan de pruebas y verificación

Fixtures HTTP completos para navegación/permisos, un módulo adicional sintético prueba extensión sin nombres fijos, permisos propios con y sin enabled, fallos GET/PUT/422 y preservación de selección. Navegador a 390/1280, pruebas de consolas de módulos movidas y payloads sin alterar. Pruebas de frontera existentes actúan como oráculo independiente.

## Handoff requerido

GPT implementa; Claude revisa ambas partes según encargo. Sin merge/push. Evidencia ejecutada en estado GPT al cerrar.

## Abierto

Ninguna decisión de producto. QA final del owner y PASS Claude posteriores a implementación.
