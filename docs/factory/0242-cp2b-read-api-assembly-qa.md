# 0242 CP2b.7 — QA independiente del ensamblado HTTP

Resultado: PASS de entrega y combinación sobre candidato congelado `9ee11e981da63c80685e163b6e4454c61f73a66c`, integración de main local aceptado `da3cfbc56a481c105d7251bc8bc7ce426c5102cd` y entrega documental final `bec11e2a41094ffd67b33d53a0ca3285070be666`. Sin hallazgos bloqueantes dentro del alcance. Lectura independiente de AGENTS, protocolos, ficha, contrato0242 §2/4, handoff, diff y conexiones aceptadas. El informe es el único archivo escrito por QA; autor conserva fixes, coordinador controla factory e integración.

## Aceptación observada

El delta de producto se limita a imports y handlers GET orders/POST resolve en routes.ts. GET selecciona contrato antes de query/dominio y usa cuarto argumento literal `2` del overload aceptado, sin detalle/settlement completo ni consultas adicionales. POST selecciona contrato antes de leer cuerpo y llama directamente resolveMeasuredScan para2 o resolveScan legacy para ausente/1. No resuelve legacy para recortar. Selector existente conserva409 pos_client_upgrade_required para desconocido.

Inspección del dispatcher y posRoute confirma guard POS/módulo antes de scope optional, luego handler/selector; no agrega permiso business. El envoltorio private,no-store cubre éxito y errores de guard/scope/contrato/dominio. Business proviene del guard; lectores restringen tenant. Resolver valida cuerpo/token/local antes de enrolamiento/last_scan y devuelve allowlist PosResolveV2 desde el reader aceptado, sin catálogo/rewards/shortcuts/rawconfiguration/QR/objectKey. PosSummaryV2 y legacy no se reimplementan en HTTP. No cambios a void/close/UI/cutover.

## Evidencia HTTP reutilizada y fallo inicial

Se inspeccionaron logs íntegros e identidades en `/private/tmp/checkpass-pos-0242/read-api-evidence-cf98327a/` y `/private/tmp/checkpass-pos-0242/read-api-evidence-d8222eef/`. `git diff d8222eef HEAD` no muestra diferencias en routes/list/measured-resolve/http/contracts, configuración Vitest/setup ni lockfile. Delta cf98327a→d8222eef solo sustituye la fixture dentro del caso minimal QR y sus imports; no modifica producto, setup ni otros cuatro casos. Delta d8222eef→bec11e2a es únicamente handoff.

- CI inicial cf98327a EXIT1: cuatro casos HTTP PASS y uno FAIL por fixture imposible0.499, constraint product_unit_price_legacy_check/SQLSTATE23514. Se conserva el fallo; no se afirma suite inicial verde.
- Los cuatro PASS reales cubren guard401/403, módulo403, scope A→B409 antes de contrato/cuerpo, header desconocido, no-store, staff POS sin business, listado V2/legacy/query/tenant, cuerpo/token/local inválidos/ajenos/archivados sin efectos, cupón seleccionado/veredicto/tenant sin canje.
- CI corregida d8222eef EXIT0 focal `-t 'minimal QR'`: **1 PASS y4 filtrados/skipped**. Los filtrados no son aprobación. QR real, enrolamiento único/reintento, last_scan sin last_visit, allowlists y efectos SQL reales permanecen cubiertos. Un spy de catálogo que lanza409 demuestra V2 independiente y legacy fallido; no acredita representación incompatible ni masa canónica real. Spies rewards/shortcuts no invocados; legacy ausente/1 conserva shape tras restaurarlos.

Se acepta la composición de cuatro PASS compatibles más el PASS corregido por aislamiento del delta inspeccionado. **No hubo corrida integral HTTP verde posterior.** Ambas corridas completaron teardown sin hook failure; el código ejecuta aserciones cero por IDs propios sobre negocios/consumidores/membresías/proyección/owners/staff/sesiones. QA no abrió DB/env/wrapper ni repitió migraciones. El wrapperCI del autor y su entorno seleccionado constan en handoff y logs; el aviso consumer URL ausente no corresponde a los casos ejecutados.

## Combinación y verificaciones propias

Node24.20.0/pnpm11.4.0 tras `source ~/.nvm/nvm.sh && nvm use`. Logs completos privados ligados al SHA en `/private/tmp/checkpass-pos-0242/read-api-qa-evidence-9ee11e98/`: identity.log, types.log/types.exit, pure.log/pure.exit. Lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`; Vitest config/setup idénticos a evidencia autor. Config pura externa inspeccionada SHA256 `47a5904225923e544be8fa46b781e84081168ccc695fc4b4d579041781fbdc8c`, entorno Node sin setup DB ni env.

- `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0 sobre candidato integrado.
- `pnpm exec vitest run --config /private/tmp/checkpass-pos-0242/exact-benefit-evidence/pure.config.mjs`: EXIT0,130/130 en seis archivos, sin skips/retries. Cubre financial legacy, descuento exacto, medidas, contrato, beneficio y preview financiero POS.
- `git diff --check`: EXIT0 antes del informe.

La inspección de combinación confirma FinancialInput legacy intacto; solo FinancialInputV2 admite descuento amount/originalAmount exclusivo. Descuento exacto aceptado cambia helper/tipos/settlement puro, sin delta en las rutas/readers de esta entrega ni en configuración CI. Tipos merchant y130 pruebas verifican compatibilidad integrada. Se reutilizan tipos DB/domain y lint/formato/UIguard/56tools del autor por identidad compatible; QA no afirma haberlos repetido.

## Límites

Sin nuevos cambios de producto/tests, estados/índices, refs principales/ajenas, subdelegación, push/PROD, servidores/túnel/3201, browser/build/M0/M1/fullverify. No certifica cierre/void V2, masa canónica ni cutover. Sin hallazgos que requieran reproducción DB adicional. Cero checks/procesos propios activos al redactar entrega; worktree se conserva para integración/cleanup del coordinador.
