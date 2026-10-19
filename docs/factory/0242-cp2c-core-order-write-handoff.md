# 0242 CP2c.1 — Entrega del writer core medido

Base: `89df00e2464dc09cba5a8f6489096db002976b87`. Ref/worktree: `core-order-measured-0242`, `/private/tmp/checkpass-pos-0242/core-order-measured-0242`. Autor conserva los fixes hasta aceptación; factory/integración corresponden al coordinador.

## Contrato y cambios

`persistMeasuredGrant` es una entrada interna explícita para snapshots confiables de un productor servidor ya autorizado y bloqueado. Recibe cantidad/tarifa strings, medida completa, referencia opaca de origen y `FinancialSettlement` decidido. El productor conserva la responsabilidad de autorización/tenant, catálogo/snapshots y pagos; este writer no valida un cuerpo HTTP ni selecciona cupón.

El adaptador usa `assertFinancialSettlement`, compara moneda/neto y correspondencia única de referencias, valida `lineTotal` contra el bruto distribuido `money.gross` y originales racionales contra `exactSnapshotLineGross`. Conserva las cadenas originales y cuatro metadatos0103; no reconstruye tarifa desde dinero redondeado. Unit histórico usa límites trusted; mass conserva límites nuevos. Las capturas nuevas se validan antes en el productor.

Ambas entradas llaman la misma función privada y sentencia SQL: bump de membresía, orden neta, líneas brutas, visita/evento/delivery, proyección y push. `persistGrant` mantiene su firma, conversión unit legacy y callers. No se agrega ledger, `ON CONFLICT` para la venta, dispatch externo ni asociación FK del sourceLineId. Reintento secuencial devuelve null; carrera perdedora23505 aborta y el caller existente relee.

Archivos: `orders.ts`, `measured-order-input.ts`, `measured-order-input.test.ts`, fixture productor `modules/pos/server/measured-core-order.neon.integration.test.ts` y este handoff. Sin cambios de close/cupón/rutas/esquema/eventos/UI ni imports de módulos opcionales en core.

## Verificación y evidencia

Evidencia completa fuera del worktree: `/private/tmp/checkpass-pos-0242/core-order-measured-evidence/`. El manifiesto y logs registran SHA congelado, base, Node/pnpm/config/lockfile, comandos, exits y límites. La evidencia final de ejecución prevalece sobre los resultados preparatorios descritos aquí. Código probado en `61f7e2ff8a0fb40e5965b1e28e08ba7eca577692`; el commit posterior actualiza únicamente este handoff y conserva esa identidad de implementación.

Preparación offline: 24 puros decisivos (strings9dec, kg/lb/g equivalentes, JPY/USD, bruto/neto, unit histórico, originales/identidad/metadatos inválidos, duplicados y misma sentencia serializada legacy/medida), 4 guardias de frontera, tipos de merchant/consumer/platform, lint focal y UIguard. Durante preparación se corrigieron un cast intencional de metadata inválida en test y un import no usado; no se relajaron assertions de producto.

Fixture CI: unit canónico real con originales/metadatos/neto/units/balance/push/proyección/createdAt; replay serial y relectura; legacy; última FK inválida con rollback de todo; última metadata inválida sin efectos; rechazo canónico de mass y tarifa precisa por barreras vigentes; carrera sincronizada mediante lock de membresía y observación de dos writers esperando, ganador único y perdedor23505. Cuenta y compara efectos/eventos antes/después. Fixture usa negocio/producto/membresía/consumidor/owners propios y otro tenant vacío, y verifica teardown por IDs exactos de negocios/membresías/owners/sesiones/consumidores/push. No crea staff ni sesiones.

CI requiere transferencia exclusiva del coordinador y `tools/neon-test.sh` con env seleccionado; no abrir otra corrida durante setup/teardown. QA independiente debe comprobar candidato congelado y evidencia. Los tests son del writer interno, no acreditan auth HTTP ni cierre conectado.

Primera corrida CI en `f2cd3253`: FAIL de setup, seis casos skipped, porque el fixture intentó un programa points/per_purchase que la constraint vigente rechaza. Se corrigió a points/per_amount con bloque1.00; units17 continúan siendo una decisión explícita del dominio enviada al writer. El negocio/owner parcialmente creados se identificaron por IDs exactos del log para recuperación acotada mediante wrapper y setup temporal fueraWT. No se desactivó ninguna constraint ni se contó esa corrida como PASS.

Resultado final: wrapper CI en `61f7e2ff` **PASS6/6, cero skips, EXIT0,9.38s**, incluido teardown completo y carrera real23505. Recuperación del fixture parcial **PASS1/1, EXIT0**, verificando identidad/ausencia de vínculos ajenos y business/owner/sesiones0. Tipos merchant, lint del fixture y formato se repitieron tras el fix, EXIT0. Tipos consumer/platform, lint de producto, UIguard, puros24/24 y frontera4/4 se conservan compatibles desde `f2cd3253` porque el fix posterior solo cambia la configuración válida del fixture y este handoff. Logs: `neon-61f7e2ff.log`, `recovery.log`, `*-61f7e2ff.log`, `offline-results.json` y manifiestos. El aviso de `NEON_CI_CONSUMER_DATABASE_URL` ausente no afecta estos casos: no se ejecutó ni afirmó el oráculo del rol consumer.

## Límites explícitos

Mass y precisión se serializan/prueban en puro, pero las constraints0103 siguen bloqueando escrituras canónicas incompatibles. No se desactivan constraints/triggers ni se fabrica historia imposible. Sin browser/build/M0/M1/fullverify, producción, push, túneles, puerto3201 ni cierre E2E. Una entrega de esta pieza no activa venta medida ni V4. Revisión de combinación queda al coordinador tras QA.
