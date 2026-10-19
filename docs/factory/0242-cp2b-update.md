# 0242 — CP2b.6 edición completa V2 con snapshots conservados

Estado: preparada, sin autor/reserva. Requiere creación CP2b.5 y captura transaccional aceptadas antes de asignar. Autor nuevo/contexto vacío, no continuación del autor create. Coordinador fijará base/factory; sin subdelegar. Leer protocolos y contrato0242 §1/3, helpers input aceptados y código pertinente.

## Entrega

Conectar únicamente PUT orders/:id con X-Pos-Contract2 a servicio de edición V2. Ausente/1 preserva V1 durante expansión; versión desconocida409 upgrade tras guard/scope y antes de efectos. private,no-store y permiso POS intactos. No tocar GET listado/POST/close/QR/void/UI ni activar masa. Respuesta canónica PosOrderV2 alimenta caché; no GET extra impuesto al cliente.

Una transacción bloquea orden tenant/status/version y valida contexto/comando completo. Orden ajena404 sin revelar existencia; cerrada/anulada no editable; version_conflict conserva código y adjunta orden V2 actual después del rollback, no reenviar automáticamente. Version entera+1 solo si edición válida; error en última línea revierte también cabecera, contexto, versión, eliminaciones e inserciones previas. Mantener orden de locks consistente con creación/configuración/productos/mesas, revisando posibles inversiones antes de implementar; no reutilizar blindly orden de locks viejo si introduce carrera.

Usar parsePosUpdateV2 con saleType autoritativo existente y resolveExistingMeasuredLine con filas DB de esa orden. Lista completa items, lineId único/propio, producto coincidente inclusoNULL borrado; eliminar solo IDs propios ausentes. Conservar nombre/precio/priceUnit/conversionVersion y demás snapshot comercial de existentes sin consultar catálogo actual para reprecificar. Cambio de flag actual de producto no cambia dimensión histórica. Cantidad legacy alta se conserva solo sin cambio y contra fuente autoritativa. Cantidad nueva/cambiada usa límites nuevos; cambio de unidad de captura mass compatible conserva tarifa/factor originales. No reemplazar fuente por aproximación visual no terminante; cliente envía captura original si no hubo edición.

Nuevas líneas usan measured-capture aceptado bajo configuración/productos bloqueados y revisiones actuales, incluso si el mismo productId ya existe con snapshot viejo. No fusionar por producto ni borrar identidad de fuentes. Unidades deshabilitadas no impiden conservar snapshot/captura previa sin cambio; nuevas capturas respetan configuración vigente. Cambio de local no repricing de líneas existentes, y valida disponibilidad de nuevas en el destino. Local/mesa propios, activos cuando se cambian, módulo/ocupación y label/tipo según contrato; legacy solo si ya existe, nunca elegido para una nueva orden. Contexto histórico archivado sin cambio no se pierde por editar una nota.

Total se calcula exacto con núcleo financiero desde fuentes confiables, valida rango por línea y agregado antes de escribir. No aceptar precio/name/financialSnapshot del cliente, no fabricar financialSnapshot en abiertas ni usar total_snapshot como fuente única con moneda mutable. Barreras0102/0103/0105 permanecen; prueba canónica unit y álgebra/fuentes mass claramente separadas, sin desactivar triggers ni inventar filas imposibles.

## Paths autorizables

- apps/merchant/src/modules/pos/server/routes.ts, solo PUT/imports necesarios
- apps/merchant/src/modules/pos/server/measured-update.ts, nuevo
- apps/merchant/src/modules/pos/server/measured-capture.ts, reutilización mínima para existentes/contexto si corresponde; proponer antes de modificar
- apps/merchant/src/modules/pos/server/measured-update.test.ts, si aporta invariantes puras
- apps/merchant/src/modules/pos/server/measured-update.neon.integration.test.ts
- docs/factory/0242-cp2b-update-handoff.md

Sin otros writers/readers/list/inputhelpers/contratos/schema/journal/Counter/financial/measures/UI/kit/guardias/tooling/deps/estados/índices. Ampliaciones concretas vuelven a root antes de editar. No cambiar tests/guards para esconder incompatibilidades.

## Gate

Node24, tipos3/lint/formato/UIguard/guardias pertinentes, tests focales. CI exclusivamente tools/neon-test.sh/env seleccionado/reserva exclusiva hasta teardown. Reales: guard/scope/tenant/status, dos versiones concurrentes una gana/otra409 con DTO actual, rollback versión/cabecera/líneas por fallo final, snapshot viejo+línea nueva mismo producto tras cambio comercial, producto borrado, nota/contexto preservando tarifa/cantidad legacy alta, mover local/mesa ocupada/ajena/archivada con rollback, nueva revisión vieja409, eliminar/reordenar sin recrear lineIds. V1 unit conserva contrato. Cero preparación crea pagos/ledger/evento/consumo. Mass puro/SQL de pruebas no equivale a venta canónica.

Congelar SHA y guardar logs completos privados con comando/exit/config/fallos/exclusiones; no browser/build/M0/M1/fullverify por ceremonia. Limpiar también owners/staff/sesiones propios y verificar ausencia. QA nuevo independiente, autor conserva fixes hasta aceptación; entrega limpia0procesos. Factory/integración solo coordinador; sin push/PROD/3201/túnel/M0/demos ni artefactos ajenos.
