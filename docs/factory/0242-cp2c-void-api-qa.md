# 0242 CP2c.9 — QA independiente HTTP void V2

Dictamen: **PASS focal de entrega y combinación**, sin defectos bloqueantes encontrados. Candidato congelado auditado: `2a983a6e4f71b2aebd237e88efb5daa9dc67c727`, sobre dev `cd777d93`, entrega autor `b290c57f1ab4c5f6fb31b4b0993adc9da1495246`, fuente verificada `e6c9bbed381e9489ec50e65b2f374882d02e200f`, base autor `b68127aa9fbb0beb2121af26e5609eb1702df68b`. QA NUEVO independiente en `/private/tmp/checkpass-pos-0242/pos-qa-0242`, ref `pos-qa-0242`; único archivo editable: este informe. No equivale a verify global ni publicación.

Leídos AGENTS, protocolos ADR0144, ficha/handoff y contrato0242 pertinente. Se revisaron diff, prueba HTTP completa, dispatcher, política de scope, lector estricto, negociación, errores y dominio de anulación aceptado. No se implementaron fixes ni se ejecutó DB/env/wrapper.

## Identidad y combinación

- Checkout inicialmente limpio y HEAD exacto. Ambos padres dev/autor son ancestros del candidato. El delta contra dev contiene únicamente import/handler void en `routes.ts`, prueba HTTP nueva y handoff.
- `git diff --exit-code e6c9bbed HEAD -- <paths>` EXIT0 para fuente HTTP completa, contratos, dispatcher/guard/server-registry/scope, todo `packages` y `tools`, lockfile, package.json raíz/merchant, .nvmrc, workspace, tsconfig y configuración/setup Vitest merchant. El diff completo e6c9bbed→candidato solo incorpora UI/browser de cobro aceptado y documentos: no hay otra fuente backend/config/dependencia alterada. Raíz Vitest también sin delta.
- El handler y prueba HTTP son idénticos a la revisión r2 probada. El handler tampoco cambió entre `065e1122` y `e6c9bbed`. Dominio void/snapshot idénticos a entrega aceptada `3511c9d28852b5e88604e4986363379cc8dd9441`. Lector HTTP, dispatcher, guard, close legacy/medido y void interno no cambian desde base b681. La única modificación de la tabla de rutas es void; cobro/cierre conserva su ensamblado aceptado. UI POS y e2e son idénticos a dev cd777d93.
- Runtime propio: Node `24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`; TypeScript `5.9.3`, ESLint `9.39.1`, Prettier `3.9.8`. Todos los comandos Node/pnpm precedidos por `source ~/.nvm/nvm.sh && nvm use`. SHA256 lockfile `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`, coincidente con evidencia; `cmp pnpm-lock.yaml node_modules/.pnpm/lock.yaml` EXIT0. No se instalaron dependencias.

## Contrato observado

- Dispatcher ejecuta guard ordinario y scope antes del handler; posRoute conserva scope optional y traduce errores. Header desconocido arroja409 `pos_client_upgrade_required` antes de `posOrderId`, body y dominio. Prueba real cubre guard401/403, módulo403 y scope409 precediendo negociación, stream intacto y cero llamadas legacy/medidas. Orden desconocido-header antes de UUID se verifica por secuencia directa de código; no se atribuye un caso dinámico inexistente.
- Header2 llama exclusivamente a `voidMeasuredPosOrder` aceptado. `request.body === null` entrega undefined y mantiene versión opcional; JSON presente pasa por `readPosBody`. Vacío/whitespace/malformed no se convierten en comando válido; null/array/escalar y versiones inválidas conservan sus errores y estado intacto. Ausente/1 llama legacy y mantiene cuerpo ignorado incluso malformado y DTO anterior.
- DTO2 atraviesa la ruta sin adaptación legacy ni conversión de cantidades/tarifas a Number. Prueba real compara DTO íntegro contra reader canónico y comprueba strings, metadatos, lineId y total. Stale409 lleva la orden V2 completa; tenant ajeno404 no revela orden. UUID inválido404 precede consumo de body.
- Éxito y todos los errores ejercitados verifican `private, no-store`. Cerrada409 `pos_order_not_open` conserva pagos/venta y estado completo. Replay devuelve el mismo snapshot, incluso con versión99, sin cambio de estado ni segundo evento; se verifica exactamente una fila `pos.order.voided` con event_version2.

## Evidencia reutilizada y comprobación propia

Se abrieron los logs reales en `/private/tmp/checkpass-pos-0242/void-api-v2-evidence/`, no solo el handoff:

| Evidencia | Resultado |
| --- | --- |
| `static-r2.log`, fuente e6c9bbed/base b681 | Tipos merchant, lint focal, formato focal y UIguard EXIT0; guardia 1 archivo sin aumentos. |
| `neon-r2.log`, fuente e6c9bbed/base b681 | Wrapper CI exclusivo del autor, migración completada, 1 archivo y **5/5 PASS, 0 skips/retries, EXIT0**, duración50.43s. Config seleccionada registrada: `/private/tmp/checkpass-pos-0242/private/ci.env`. QA no leyó ni cargó el env ni afirma verificar su contenido secreto. |
| `typecheck.log`, `static.log`, `neon.log` iniciales, fuente065e1122 | Tipos/formato/guardia EXIT0; lint EXIT1 por eq/paymentMethods sin uso; Neon **3 PASS/2 FAIL, EXIT1**. No se cuentan comoPASS. |
| `neon-r2.log`, teardown | Identidades propias registradas; comprobaciones de negocio/membership, owners y sesiones vacíos completadas sin fallo. |
| `processes.log` del autor | Solo shell/rg de inspección; sin procesos persistentes ni CWD del worktree autor. |

Los dos fallos iniciales fueron oráculos erróneos: UUID esperado422/invalid_input frente al404/unknown_pos_order existente, y código cerrado esperado not_open frente a pos_order_not_open existente. La inspección de `errors.ts` confirma los contratos anteriores; no se relajó producto para obtener verde. El diff r2 corrige esos oráculos, usa imports antes ociosos al acotar paymentMethods al negocio y hace observable el teardown. La segunda corrida es una revisión corregida, no un retry sin cambios.

QA ejecutó una señal acotada propia sin DB: Request real Node24 para ausencia, string vacío, whitespace, malformed y `{}`. **5 casos PASS**: solo ausencia tiene body null; los tres JSON inválidos rechazan y `{}` parsea. Esto comprueba semántica del runtime, no se presenta como nueva ejecución de la suite HTTP. `git diff --check` EXIT0. No surgió duda que justificara repetir DB o todos los estáticos con fuente/configuración idénticas.

Se reutiliza CP2c.8 aceptado, informe `0242-cp2c-measured-void-qa.md`/QA `10fd918484268191de9ffce308cc5f1253c6f826`, sin recertificar su matriz financiera, locks, carreras, rollback, snapshots ni analytics. Aquel informe preserva boundaries EXIT1 (24 PASS/2 FAIL preexistentes), sin convertirlo aquí en gate global verde. Cobro preparado conserva su QA aceptada `0242-cp2d-measured-payment-qa.md`; no se repite su browser/matriz por este handler aislado.

## Límites y cierre

Harness dispatcher/guard explícito con dominio/transacciones reales y fixture canónica unit; **no certifica autenticación nativa Next ni masa canónica HTTP**. Sin browser/build/fullverify/M0/M1, migración propia, activación o retirada legacy. Avisos existentes: falta NEON_CI_CONSUMER_DATABASE_URL (sin oráculo de rol consumer en esa selección), driver websocket Neon y MODULE_TYPELESS_PACKAGE_JSON. No se ocultan skips/retries ni fallos con estos avisos.

QA no inició procesos persistentes. `ps` fue bloqueado con EPERM de sandbox y se avisó de inmediato al coordinador; la escalación propia acotada aprobada ejecutó ps/lsof desde `/private/tmp`: solo shell/rg transitorios, cero procesos de prueba y cero CWD del worktree QA. Sin cambios de producto/tests/factory/estados/índices ni refs principales, sin push/PROD/3201/túnel/demos/artefactos ajenos. Informe único para commit local, sin bypass de hooks; aceptación/integración/cleanup corresponden al coordinador.
