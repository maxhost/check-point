# 0242 CP1b.3 — quantity y tarifas snapshot string

Base limpia confirmada `e12216feb0809fb276b86fbb5a531bce26599764`; worktree `/private/tmp/checkpass-pos-0242/pos-data-0242`, rama `pos-data-0242`. Código congelado inicial `f9f6d52c`; corrección de ruta de fixture congelada `65119bd183f1fa9e6e648389f704061ba127860e`; corrección de fixtures de guard congelada `34d9203eae829a69f8f1b0e21b7ba48be69874dd`. SQL/producto idénticos entre esos candidatos. Sin push/PROD ni servidores. Factory entrega/aceptación/integración a cargo del coordinador.

## Implementación

Drizzle `pos.pos_order_item` y `core.order_item`: quantity y unit_price_snapshot numeric(24,9), modo string, metadatos escalares `measureKind`, `quantityUnit`, `priceUnit`, `conversionVersion` NOT NULL con defaults unit/unit/unit/mass-si-1. `0103_quantity_legacy_storage_expand.sql` generado offline desde journal0102 sin config/deps/generador modificados. Barreras temporales: cantidad positiva (check previo conservado), integral e INT32; tarifa centavos exactos en rango numeric(12,2); metadatos exclusivamente defaults históricos coherentes. Core no tenía check de tarifa no negativa: se preserva su rango negativo anterior, sin ampliación de captura/dominio. POS conserva su check >=0. No activar mass/V4/precisión comercial; retirar barreras sólo con futura migración serial compatible CP2c.

JSONdiff semántico0102→0103: únicamente cuatro tipos de columna, ocho columnas/defaults nuevos, seis checks y id/prevId del snapshot. Todas las FKs/índices y demás tablas iguales; no carga/revisión textual de las16k líneas ni drift histórico. SQL SHA256 `370a8472343161f0dc2e551c72d4b7868316286fc75a5bb8fa193e6eab58873b`.

POS stringify en insert y update de cantidades ya validadas unit. Counter valida cantidad histórica unit con helper aceptado y cambia sólo cast de quantity a numeric; puntos/sellos continúan integer. Readers/HTTP unit, importes financieros, payloads/eventosV1–V3 y JSON sin cambios. Fixture pos-measurement: únicamente inserción Drizzle quantity1→"1", sin setupM0 ni RAW/control. Ampliación de reserva autorizada por root para dos aserciones DB de unit-expand: precio12,2/cantidad number→padded9/string; DTO/HTTP/eventos/rollback/retry conservados.

## Identidad y checks offline

Node24.20.0, pnpm11.4.0, Vitest4.0.18. Lock SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`; drizzle.config.ts `e53ee9595e5f28ecb1034088a2ead25255dfb9f42c6a6b1281707a37f69721cc`; merchant vitest.config.ts `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81`.

- Types db/domain/merchant EXIT0; ESLint focal schema/writers/fixtures/test nuevo EXIT0.
- Prettier focal schema/writers/tests/journal/snapshot EXIT0; git diff --check EXIT0.
- Puras lines y unit-expand:46/46 PASS,0skips.
- Boundary primera corrida3 suites:3 fallos/23PASS. Aunque existían en la base, root identificó dos regresiones propias0242 que debían corregirse: catálogo storage0102 en core importaba supportPOS; fixture decoder nombraba provider recipes. Reserva ampliada explícitamente: movido íntegro catálogo a `modules/pos/server`, ajustando sólo imports/URL; provider cambiado a `provider-a`, con formato obligado por longitud. Ningún caso/oráculo eliminado.
- Tras esos fixes: decoder68/68PASS; guard principal10/10PASS. Between/literals:2fallos/14PASS, sólo backlog confirmado por root anterior00efff: expenses immediate→stock/count y literales en context-controller/context-refresh/checklist-context-resource/policy-simulation/analytics-lifecycle. Ya sin offender0242. No editar guardias ni atribuirles PASS global. La invocación combinada94tests termina EXIT1 por esos2 casos;92PASS.

## CI protegida

Exclusivamente `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh ... --no-file-parallelism`, recurso exclusivo hasta teardown. Sin conexiones directas/local/PROD. Interlock validó endpoint privado; no credenciales expuestas. Wrapper avisa consumerURL ausente: no se ejecuta ni certifica oráculo de rol consumer.

Primera invocación en f9f6d52c aplicó migración0103 canónica, pero suite nueva falló antes de colectar por URL relativa un nivel de más (ENOENT,0tests). Corrección propia en65119bd1; no se oculta ese fallo ni se considera PASS la primera ejecución. Git add de la corrección recibió EPERM; escalación Git propia acotada autorizada completó commit.

En65119bd1: nueva suite quantity-storage-expand3/3PASS,0skips (24.38s); hash de migración contra drizzle.__drizzle_migrations, tipos/defaults/constraints/FKs/índices reales; antes/después en esquema propio con definición antigua de columnas afectadas y sentencias SQL canónicas sustituyendo estrictamente sólo identificador cualificado de cada tabla. Preserva IDs, extremos legacy (incluido core negativo),0, importes12,2 y JSON; no ALTER inverso ni TRUNCATE global. Negativos de cantidad/rango/escala/NaN/metadatos en ambas definiciones migradas; rechazo real POS conserva fila idéntica. Fixture propia con dropPosWorld, borrado owner explícito, aserciones negocio/owner/esquema ausentes.

En65119bd1, wrapper selección serial `src/modules/pos/server/unit-expand-compat.neon.integration.test.ts src/server/catalog-storage-expand.neon.integration.test.ts src/modules/modules-fk.neon.integration.test.ts --no-file-parallelism`:13/13PASS,0skips (62.92s). Incluye catálogo4,lectores6,FK3. Extremos precio legacy máximo×1, INT32×0, lectura/listado/nota, nueva adición, rechazoHTTP de string/fraction y overflow, rollback422 cabecera/version/líneas intactas, cierre con/sin pase/cupón y retry sin duplicación, core dinero/cantidad y eventoV1–V3. Teardown lectores verifica owners/consumers/negocio ausentes. Catálogo teardown verifica owner/negocio/esquema ausentes. No ejecutar pos-close/settlement aparte: root autorizó reutilizar estos6 casos completos y no ampliar sus fixtures con cleanup ajeno.

Repetición catálogo por ruta nueva sobre34d9203e con wrapper y --no-file-parallelism:4/4PASS,0skips (15.84s), teardown completo. Merchant typecheck y Prettier de ambos fixtures confirmados EXIT0 tras move/provider. Código/SQL de storage/lectores/FK sin cambios: evidencia65119bd1 compatible y reutilizable, sin repetición ceremonial.

## Límites y salida

M0/M1 y control archivado no ejecutados ni modificados. El smoke del control contra almacenamiento nuevo y nuevo freeze siguen siendo requisito antes de M1; la lectura del driver integer no lo certifica. Numeric conserva semántica typmod PostgreSQL; checks garantizan representación almacenada legacy, no un parser HTTP de texto arbitrario. No nuevas capturas de precisión/mass. QA independiente pendiente sobre candidato final. Inventario final OS con ps escalado sólo muestra propio ps/rg:0vitest/drizzle/servidores/neon-test de este worktree. Ningún servidor lanzado, todos los comandos completados y fixtures/esquemas propios retirados/asertados. CI queda libre; worktree se conserva limpio para QA/root, sin factory deliver ejecutado por worker.
