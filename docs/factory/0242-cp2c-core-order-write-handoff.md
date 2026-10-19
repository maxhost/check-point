# 0242 CP2c.1 — Entrega del writer core medido

Base: `89df00e2464dc09cba5a8f6489096db002976b87`. Ref/worktree: `core-order-measured-0242`, `/private/tmp/checkpass-pos-0242/core-order-measured-0242`. Autor conserva los fixes hasta aceptación; factory/integración corresponden al coordinador.

## Contrato y cambios

`persistMeasuredGrant` es una entrada interna explícita para snapshots confiables de un productor servidor ya autorizado y bloqueado. Recibe cantidad/tarifa strings, medida completa, referencia opaca de origen y `FinancialSettlement` decidido. El productor conserva la responsabilidad de autorización/tenant, catálogo/snapshots y pagos; este writer no valida un cuerpo HTTP ni selecciona cupón.

El adaptador usa `assertFinancialSettlement`, compara moneda/neto y correspondencia única de referencias, valida `lineTotal` contra el bruto distribuido `money.gross` y originales racionales contra `exactSnapshotLineGross`. Conserva las cadenas originales y cuatro metadatos0103; no reconstruye tarifa desde dinero redondeado. Unit histórico usa límites trusted; mass conserva límites nuevos. Las capturas nuevas se validan antes en el productor.

Ambas entradas llaman la misma función privada y sentencia SQL: bump de membresía, orden neta, líneas brutas, visita/evento/delivery, proyección y push. `persistGrant` mantiene su firma, conversión unit legacy y callers. No se agrega ledger, `ON CONFLICT` para la venta, dispatch externo ni asociación FK del sourceLineId. Reintento secuencial devuelve null; carrera perdedora23505 aborta y el caller existente relee.

Archivos: `orders.ts`, `measured-order-input.ts`, `measured-order-input.test.ts`, fixture productor `modules/pos/server/measured-core-order.neon.integration.test.ts` y este handoff. Sin cambios de close/cupón/rutas/esquema/eventos/UI ni imports de módulos opcionales en core.

## Verificación y evidencia

Evidencia completa fuera del worktree: `/private/tmp/checkpass-pos-0242/core-order-measured-evidence/`. El manifiesto y logs registran SHA congelado, base, Node/pnpm/config/lockfile, comandos, exits y límites. La evidencia final de ejecución prevalece sobre los resultados preparatorios descritos aquí.

Preparación offline: 24 puros decisivos (strings9dec, kg/lb/g equivalentes, JPY/USD, bruto/neto, unit histórico, originales/identidad/metadatos inválidos, duplicados y misma sentencia serializada legacy/medida), 4 guardias de frontera, tipos de merchant/consumer/platform, lint focal y UIguard. Durante preparación se corrigieron un cast intencional de metadata inválida en test y un import no usado; no se relajaron assertions de producto.

Fixture CI: unit canónico real con originales/metadatos/neto/units/balance/push/proyección/createdAt; replay serial y relectura; legacy; última FK inválida con rollback de todo; última metadata inválida sin efectos; rechazo canónico de mass y tarifa precisa por barreras vigentes; carrera sincronizada mediante lock de membresía y observación de dos writers esperando, ganador único y perdedor23505. Cuenta y compara efectos/eventos antes/después. Fixture usa negocio/producto/membresía/consumidor/owners propios y otro tenant vacío, y verifica teardown por IDs exactos de negocios/membresías/owners/sesiones/consumidores/push. No crea staff ni sesiones.

CI requiere transferencia exclusiva del coordinador y `tools/neon-test.sh` con env seleccionado; no abrir otra corrida durante setup/teardown. QA independiente debe comprobar candidato congelado y evidencia. Los tests son del writer interno, no acreditan auth HTTP ni cierre conectado.

## Límites explícitos

Mass y precisión se serializan/prueban en puro, pero las constraints0103 siguen bloqueando escrituras canónicas incompatibles. No se desactivan constraints/triggers ni se fabrica historia imposible. Sin browser/build/M0/M1/fullverify, producción, push, túneles, puerto3201 ni cierre E2E. Una entrega de esta pieza no activa venta medida ni V4. Revisión de combinación queda al coordinador tras QA.
