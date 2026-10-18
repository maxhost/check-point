# 0242 — CP2b.1 expansión de intención y tipo de venta de órdenes

Estado: preparada, sin autor/reserva. Próxima entrega de servidor tras liberar un WT/implementador UI; autor nuevo/contexto vacío. Coordinador confirma journal/base y reserva writer serial de esquema antes del código. No subdelegar. Contrato0242 §3/5; ninguna activación mass/precisión/V4 en esta entrega.

## Expansión acotada

Agregar a pos.pos_order sale_type nullable con check table/pickup/delivery/counter/legacy; create_request_id uuid nullable, create_request_fingerprint text nullable y total_snapshot numeric(30,2) nullable. Clave única negocio+create_request_id, nulls históricos permitidos; clave/huella ambas null o ambas presentes y huella canónica SHA256 hexadecimal64. No generar claves para filas históricas ni reutilizar close_request_id. Tipo conocido pickup/delivery/counter no admite dining_table_id real. Los otros checks/FK/índices/locks actuales se conservan. No agregar FK desde core hacia POS.

Backfill exclusivo sale_type de filas existentes: table si dining_table_id real está presente; legacy si no. Nunca inferir tipo de texto/table_label. orderLabel público reutilizará el snapshot físico table_label existente; no duplicar columnas de etiqueta ni reescribir nombres/notas/operadores/versiones/fechas/totales/historia. Inserciones de binario legacy durante expand pueden dejar sale_type null: el futuro reader aplica la misma regla basada en tableId real, nunca nombre. El futuro writer V2 siempre publica tipo explícito. Endurecer a NOT NULL/corte de writers antiguos corresponde al cutover, no a esta expansión.

total_snapshot es proyección privada para listado sin cargar todas las líneas: el futuro writer V2 lo calcula con el núcleo financiero exacto aceptado en la misma transacción de edición, nunca desde precio/total del cliente. NULL significa writer legacy sin captura, no importe0. No backfill monetario ni nuevo cálculo alternativo en SQL en esta entrega. El futuro adaptador de writer legacy debe invalidarlo al editar líneas; el reader conserva fallback unit histórico y no inventa total de una línea medida sin captura. Este campo no es settlement/neto/pagos ni modifica dinero cerrado. Una orden V2 vacía tendrá captura0 calculada por su writer posterior. La capacidad de almacenar el campo aún no certifica ese writer/reader.

DDL solo aditivo sobre pos.pos_order y backfill de tipo, sin tocar órdenes core/líneas/eventos/ledger/permisos/configuración ni retirar barreras previas. Generación canónica Drizzle/snapshot/journal desde base vigente; revisar diff de JSON y frenar drift de otras tablas. Probable siguiente0106, pero confirmar índice libre al asignar y no reservar nombre por esta predicción. No editar migraciones publicadas ni juntar journals concurrentes.

## Paths previstos

- packages/db/src/schema/modules/pos.ts, solo columnas/checks/índice descritos
- packages/db/drizzle/<siguiente>_pos_order_intent.sql
- packages/db/drizzle/meta/_journal.json y <siguiente>_snapshot.json
- apps/merchant/src/modules/pos/server/order-intent-storage.neon.integration.test.ts, nuevo
- docs/factory/0242-cp2b-order-storage-handoff.md

Sin writers/readers/rutas/UI/kit/guard/tooling/deps/estados/índices ni nueva lógica de venta. Ampliaciones concretas a root antes de editar. Asignación explícita de migración por ficha+factory antes de trabajo; worker no opera base local/PROD.

## Gate

Node24, tipos db/domain/merchant, lint/formato y guardias pertinentes (backlog separado). CI exclusivamente wrapper tools/neon-test.sh y recurso asignado por root, --no-file-parallelism hasta teardown propietarios/sesiones/esquemas. Candidato migrado canónico permite antiguo INSERT sin nuevos campos. Test aislado antes/después ejecuta SQL canónico con sustitución estricta solo de identificadores propios, sin downmigration global ni debilitar constraints reales. Fixtures con FK y permisos válidos.

Verificar backfill table/legacy con etiquetas que no permitan inferir tipo, filas open/closed/voided/settlement anterior y tableId null; IDs/versiones/fechas/money/JSON sin cambio. Todos null de intención/total permanecen null; inserts posteriores legacy siguen compatibles. Aceptar tipos conocidos/null transición, rechazar desconocidos y tipo counter/pickup/delivery con mesa real. Par clave/huella requerido, formato inválido rechazado, clave duplicada mismo negocio rechazada y negocio distinto aislado, nulls repetidos permitidos. total_snapshot0/null y valor amplio representable no confunden semántica; no presentarlo como nueva validación financiera. Probar migración/constraints, no pagos ni fabricación de ventas nuevas para backfill.

Guardar logs completos privados con SHA/comando/exit/config/SQLdiff; congelar antes de CI. No browser/build/M0/M1/fullverify por ceremonia. Entrega limpia/0procesos, QA nuevo independiente y combinación proporcional. Root aplica migración LOCAL protegida después de QA y antes de integrar descriptor que requiere columnas, como expansiones anteriores. No push ni PROD; cada caso requiere autorización del owner. Writers/listado V2 y su idempotencia vendrán en entregas separadas y con agentes nuevos.
