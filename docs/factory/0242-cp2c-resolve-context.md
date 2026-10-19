# 0242 — CP2c.2 contexto mínimo de escaneo sin catálogo legacy

Estado: preparada, sin autor/reserva. Autor nuevo/contexto vacío tras aceptar writer core CP2c.1; coordinador fija base/factory antes de código. Independiente del PUT V2 en curso: no tocar routes.ts. Leer protocolos, contrato0242 §QR y código pertinente; no subdelegar.

## Entrega acotada

Extraer/reutilizar identidad, programa acreditable, membresía/enrolamiento y last_scan de resolveScan en un resolver genérico que pueda devolver contexto mínimo sin consultar catálogo, atajos ni premios. Mantener resolveScan legacy con su shape y comportamiento; no ejecutar la función completa y quitar campos al final. No duplicar enrolamiento/proyección, manejo23505 ni actualizar last_scan dos veces. Core genérico no importa ni nombra módulos POS/Recipes/Stock; adapter mínimo en modules/pos hace proyección exacta PosResolveV2.

Respuesta POS permitida únicamente consumer.displayName, membership(id/pointsBalance/stampsCount/justEnrolled), program(id/kind/accrual{mode,grant,blockAmount}), couponState según contrato. blockAmount string|null exacta, sin Number de dinero. No copiar rawconfiguration, token/QR, IDs de cuenta adicionales, objectKey, rewards/catalog/shortcuts ni diseño de tarjeta ajeno a cobro. Tipo comprobado contra contrato cerrado, no DTO aproximado ni alias. Cupón conserva rule textual para mostrar, estado/veredicto/identidad y reglas actuales; no interpretar prosa ni seleccionar/quitar otro beneficio aquí.

Mantener validación de token/local/programa/membresía y errores vigentes. Local ajeno/archivado/token inválido no crean enrolamiento ni scan ajeno. Programa active|closing acreditable y manejo de carrera de autoenrolamiento permanecen. last_scan se actualiza como hoy después de garantizar membresía; esta entrega no cambia atomicidad histórica ni inventa pagos/ledger/visitas extra. Relectura de QR no es una compra. No ampliar emisión/PWA ni reactivar canje directo suspendido.

La API POS resolve V2 todavía NO se conecta: ensamblado posterior incorporará adapter tras aceptar esta entrega y liberar routes.ts del autor PUT, con guard/scope/header/no-store y pruebas HTTP reales. No afirmar esos controles por tests directos. Counter legacy permanece hasta corte; masa/tarifas siguen bloqueadas. Gate de activación debe retirar/rechazar Counter antes de admitir masa.

## Paths autorizables

- apps/merchant/src/server/counter/resolve.ts, extracción mínima manteniendo legacy
- apps/merchant/src/server/counter/resolve-context.ts, si hace falta separar por tamaño
- apps/merchant/src/server/counter.ts, exports mínimos genéricos
- apps/merchant/src/modules/pos/server/measured-resolve.ts, adapter PosResolveV2 sin ruta
- apps/merchant/src/modules/pos/server/measured-resolve.test.ts, si aporta señal pura decisiva
- apps/merchant/src/modules/pos/server/measured-resolve.neon.integration.test.ts
- docs/factory/0242-cp2c-resolve-context-handoff.md

Sin routes.ts/http/PUT/create/list/close/financial/grant/coupon-state/schema/journal/UI/kit/guardias/tooling/deps/estados/índices. No hacer nuevo kernel monetario ni mover nombres de módulos a core. Ampliaciones concretas antes de editar.

## Gate

Node24, tipos3/lint/formato/UIguard/guardias pertinentes y tests focales. CI exclusivamente tools/neon-test.sh/env seleccionado con reserva explícita hasta teardown; inicialmente otro autor la tiene, no leer env ni operar wrapper sin transferencia. Reales: QR existente y primera inscripción con proyección/last_scan, repetir sin duplicar membresía/saldo/eventos de compra, concurrencia autoenrolamiento, local ajeno/archivado y token/programa inválidos, otros tenants, cupón seleccionado/veredicto/rule y estados relevantes, legacy shape/efectos compatibles. Verificar que el camino mínimo no invoca businessCatalog/purchaseShortcuts/loadProgramRewards mediante spies sobre funciones reales o evidencia SQL, sin sustituir enrolamiento ni DB. Prueba monetaria de blockAmount string preservada. Barreras activas: no fabricar producto mass canónico para este test.

Registrar SHA congelado/config/lockfile/logs completos/exit fueraWT, fallos/skips y límites. No browser/build/M0/M1/fullverify, auth de HTTP ni cierre E2E afirmados. Cleanup de IDs propios incluye negocio/membresías/consumers/owners/staff/sesiones y verifica ausencia; no borrar por prefijo. Autor conserva fixes, QA nuevo independiente. Entrega limpia0procesos y factory/integración solo coordinador. Sin push/PROD/3201/túnel/M0/demos ni artefactos ajenos.
