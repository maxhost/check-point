# 0242 CP2d.4 — QA independiente del editor preparado

**PASS** de entrega y combinación sobre `ee4de9004fbf8762d69f047c633243ed5ba47c9a`: base integrada `f002c84f` (incluye helper `8fa28a66db233f93c4eec53218303c5ae51d25b4`) más entrega editor `02b2160e794b7e8ff0336300d654ddc7b09a4dbc`, base autor `ba9f668438a9dc8261446d5a17344936252d4101`. QA nuevo independiente; sin cambios de producto/tests. Alcance y extensión `9487b1c1` revisados en ficha/handoff. No constituye publicación ni smoke de ruta productiva.

## Contrato y revisión

Revisados los diez paths de la entrega contra spec0242 §2 y contratos de captura/create/guardar/conflicto. `MeasuredEditorSession` es propiedad del padre y conserva borrador, manager y la misma cache/clientV2 entre montajes. `requestExit()`/`requestExit(true)` bloquean pending/uncertain; cambiar selección debe respetar ese contrato. `retireIdentity()` retira permanentemente una identidad real. El contenedor productivo futuro debe cumplir este ownership: esta entrega no sustituye la ruta legacy.

La vista desmontada no completa callbacks pendientes; identidad retirada tampoco. DTO confirmado closed/voided puede informar guardado pero nunca prepara cobro. Mostrador prepara internamente sobre DTO abierto confirmado; no implementa el modal/pago futuro. La cancelación futura conserva esa orden abierta.

Cuatro tipos, local válido, mesa real o etiqueta libre, nota/vistas, catálogo on-demand desde misma cache, búsqueda/categorías/Frecuentes locales, precio0 válido/null bloqueado y masa manual vacía están cubiertos por evidencia compatible del autor y revisión. Snapshots existentes conservan identidad/precio; los nuevos conservan revisión. Conflictos muestran datos actuales y requieren revisión explícita, sin retry automático. El cambio unit↔mass vacía captura; no adivina cantidad. Guardado publica canónico en cache sin GET detalle/history extra.

`measuredEditorAmounts` valida primero y usa `buildFinancialAmountsFromSnapshots` para total y filas; `MeasuredCart.lineAmounts?` conserva compatibilidad por defecto y valida buffer antes de mostrar importe. COP dos líneas0.49 muestran1+0=1. `usePosTables` añade cliente opcional y mantiene cliente legacy por defecto. Kit/COPY tuteo e instrucciones pertinentes de impeccable/harden/craft-floor revisados desde checkout principal; sin init/drift ni cambios de diseño.

## Evidencia propia sobre el candidato integrado

Artefactos externos propios: `/private/tmp/checkpass-pos-0242/editor-qa-evidence/`. `metadata.json` identifica runtime, configuración y SHA256 de runner/harness/logs. Node24.20.0, pnpm11.4.0, Playwright1.63.0, Chromium headless, un worker, retries0/skips0. Lock SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`.

- `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0 (`types.log`).
- `pnpm exec playwright test --config /private/tmp/checkpass-pos-0242/editor-qa-evidence/playwright.config.ts --grep 'QA |identidad cambia|catalog conflict|version conflict'`: EXIT0,8/8 (`browser.log`).
- Confirmación focal de instrumentación `--grep 'QA perdido'`: EXIT0,3/3 (`browser-capture-confirmation.log`). Se reforzó el runner externo para comparar `intent` real y contar `client.capture`; la primera instrumentación consultaba un campo inexistente y esa comparación sola no acreditaba captura. Se conservó su log; los tres casos reforzados sí acreditan intent/capture. No hubo fallo de producto ni relajación de aserciones.

Señal decisiva nueva, en navegador y UI real: POST con respuesta perdida → retry403/422/409 muestra error íntegro y continúa uncertain. Remontar vista conserva sesión; Salir/local/tipo/primaria quedan bloqueados, `requestExit(true)` devuelvefalse, modificar borrador y otra `save()` no crean intento nuevo. Recuperación posterior explícita devuelve canónico abierto y prepara cobro con la misma UUID/body/scope/contrato de las tres peticiones; `client.capture` se invoca exactamente una vez. Sin reintento automático. Los otros focales acreditan revisión de conflicto de versión/catálogo, identidad retirada sin callbacks, unmount pending sin callbacks antiguos y canónico voided sin preparación.

## Evidencia del autor reutilizada

Identidad de los archivos producto/harness/spec del autor frente al candidato integrada comprobada con `git diff --quiet 02b2160e HEAD -- <paths>`: EXIT0. Mismo lock. Metadata y logs originales solo leídos en `/private/tmp/checkpass-pos-0242/editor-evidence/`: tipos/lint/formato/UIguard EXIT0,4/4 puros y8/8 browser finales; full browser previo10/10 con única diferencia final de nota maxLength2000→1000. No se repitieron esos gates por ceremonia.

SHA256 del log focal final `776af0af844d0a0b838e3e85db0fbb2a4feedef5997cf0e7c9519c4ce861f560`; full10 previo `784067086d75911f124b67a8c4b8fcb0a5ff0fcd3f0c949b3f066b57ba08b278`. Fallos iniciales de autor (tipos/import relativo, scope/selector harness, any lint) conservados en handoff/logs, corregidos antes de checks finales; no se presentan como PASS ni como fallos de auth producto.

Abiertas con `view_image` las cuatro capturas originales `editor-{390,1280}.png` y `editor-cop-{390,1280}.png`: textos largos legibles, composición móvil/desktop y pie/panel únicos, sin overflow horizontal; COP1/0 y total1 visibles. El fullPage móvil refleja pie fijo a la altura del viewport, con contenido desplazable debajo. Sin nueva ronda de capturas/polish ni modificación de artefactos del autor.

## Límites y cierre

Harness `startCatalogHarness` con UI/estilos reales y transporte `createPosClient→posRequest→panelRequest→fetch` interceptado en boundary. No prueba Next/auth nativa/servidor/commit real de DB ni integración del contenedor futuro. Sin DB/env/wrapper/build/fullverify/M0/M1/push/PROD/3201/túnel. No se repitieron56 tests helper ya aceptados: se acreditó su interacción nueva con session/UI.

Chromium propio ejecutado escalado desde inicio por MachPort1100 conocido, autorizado en ficha; sin rechazo auto-review. `ps` sandbox de cierre dio EPERM; se avisó al coordinador y se inspeccionó con escalación acotada. Runners terminaron EXIT0, afterAll cerró harness; ps/lsof no encontraron runner/servidor QA ni proceso persistente con CWD en este WT. Puertos ajenos intactos.0checks/servidores/puertos/procesos propios pendientes al entregar. `git diff --check` EXIT0. Único archivo versionado cambiado: este informe; factory/estados/refs principales quedan al coordinador.
