# 0242 CP2b.7 — entrega de ensamblado HTTP

## Revisión y alcance

- Tarea `pos-read-api-v2-0242`, base `d129c68279e87880b9adcfb13947cb78876a040a`.
- Producto congelado en `cf98327aa4de338d4f53c653143ae064cafdb90b`; corrección exclusiva del test en `d8222eef`.
- Paths: `routes.ts` (solo imports, GET orders, POST resolve), nuevo `read-api-v2.neon.integration.test.ts`, este handoff.
- GET orders negocia dentro del handler tras guard/scope. Header 2 llama overload existente con cuarto argumento literal `2`; ausente/1 mantiene V1 y query actual.
- POST resolve negocia antes del cuerpo y usa `resolveMeasuredScan` aceptado en V2; legacy sigue `resolveScan`. No cambia DTO/dominio ni catálogo/PUT/close/void.
- Dispatcher existente conserva permiso POS, scope opcional y `private, no-store` en éxito y errores.

## Evidencia congelada

Node `v24.20.0`, pnpm `11.4.0`, hooks `.githooks`. Identidades completas, hashes de lockfile/config/setup, comandos y logs fuera del worktree:

- `/private/tmp/checkpass-pos-0242/read-api-evidence-cf98327a/{identity.log,static.log,static.exit,neon.log,neon.exit}`.
- `/private/tmp/checkpass-pos-0242/read-api-evidence-d8222eef/{identity.log,commands.txt,static.log,static.exit,neon.log,neon.exit}`.

`cf98327a` estáticos EXIT0: tipos DB/domain/merchant, ESLint y Prettier focales, UI guard base d129c682 (sin aumentos), 56 pruebas de context-budget/UI guard/Neon interlock. Corrección `d8222eef`: merchant tipos, lint y formato del test EXIT0; producto/deps/config idénticos, por eso se conserva el resto de evidencia estática.

Primera corrida Neon `cf98327a` EXIT1: 4 casos HTTP pasaron y uno falló por fixture inválido (`product_unit_price_legacy_check`, SQLSTATE23514 al sembrar precio 0.499). No fue fallo de producto ni se alteraron constraints. El log fallido se conserva. Se reemplazó únicamente ese bloque por fault injection explícita: `businessCatalog` lanza CounterError409, V2 no lo invoca y sigue leyendo/escribiendo identidad real en DB; V1 sí lo invoca y devuelve el error. No se afirma una representación incompatible real en almacenamiento canónico.

Las cuatro pruebas no afectadas demuestran mediante dispatcher/cookies reales: guard401/403, módulo403, scope A→B409 antes de contrato/cuerpo; header desconocido409 sin efectos; cache privado/no-store; POS staff sin permiso business; listado V2 lineCount/saleType/etiqueta/importes abiertos/cerrados/anulados, V1 ausente/1 idéntico, query inválida y tenant aislado; token/cuerpo/local inválido/ajeno/archivado sin enrolamiento ni scan; cupón real seleccionado con identidad/veredicto sin canje, selección persistida y sin cupón de otro tenant.

Corrida focal corregida `d8222eef` EXIT0: **1 passed, 4 skipped** por `-t 'minimal QR'`; los cuatro skips no cuentan como aprobación. Se conservan los cuatro PASS anteriores porque el delta solo reemplaza la fixture dentro del escenario afectado, sin contaminación compartida ni cambio de producto/setup. No se afirma una suite completa EXIT0.

La comprobación corregida prueba QR real, enrolamiento único, reintento sin duplicación, last_scan sin last_visit, allowlists consumidor/programa/respuesta, spies catálogo/rewards/atajos no invocados, lectura legacy fallida aislada y shape legacy ausente/1. SQL comprueba que scan no crea compra/evento/redemption/preparación.

## Entorno y limpieza

DB CI exclusiva asignada, únicamente wrapper `tools/neon-test.sh`, env seleccionado `/private/tmp/checkpass-pos-0242/private/ci.env`, `--no-file-parallelism`; sin copiar credenciales. Wrapper aplicó migraciones pendientes mediante receta autorizada, sin cambio de schema en esta entrega. El aviso de URL consumer ausente corresponde a un oráculo ajeno no invocado por esta selección.

El teardown de la primera corrida terminó sin hook failure y verificó por IDs propios cero negocios, consumidores, memberships, proyecciones business_customer, owners/staff y sesiones. La segunda corrida terminó también sin fallos de teardown y ejecutó las mismas aserciones cero sobre sus mundos propios nuevos. Wrapper y todos los procesos de checks terminaron; DB liberada al coordinador tras teardown. Checkout limpio tras commit documental, sin procesos propios pendientes.

No browser/build/M0/M1/full verify ni certificación nueva de algoritmos de dominio. No push/PROD/servidor/túnel. El coordinador realiza factory deliver/QA independiente/integración. El autor conserva los fixes. Una escritura git propia exigió escalación acotada por bloqueo `index.lock`; resuelto sin bypass.
