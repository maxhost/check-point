---
adr: 0145
fecha: 2026-10-13
estado: aceptada
resumen: Evento genérico durable de cierre y consumidor de Recetas que aplica stock idempotente después del commit; stock por local sin dependencia obligatoria del POS.
---

# 0145 — Consumo de stock al cobrar, mediante evento durable

## Contexto

Spec0227. El owner confirma inventario/costo por local, cantidades de receta por unidad, consumo al cerrar POS y venta sin bloqueo por stock negativo ni fallo técnico del aplicador. POS debe funcionar sin Stock/Recetas encendidos. ADR0139/0141 permiten importar solo módulos declarados en `requires`; `optional` permite nombrarlos, no importar. Hoy no existe enganche de cierre. No crear un `if stock` en el core ni exigir Stock para vender.

## Decisión

1. Agregar contrato genérico de eventos en el marco de módulos: publicación dentro de transacción, captura de referencias genéricas y aplicación posterior por suscriptor registrado. POS publica `sale.closed` con identificadores estables de orden/línea, local, producto, unidades, usuario y fecha. Registro genérico resuelve suscriptores; core no importa/nombra módulos concretos. Payload tipado y validado, sin secreto ni contenido IA.
2. Recetas declara suscripción al evento y referencia opcional al productor POS; mantiene `requires: [stock]`. Puede importar/escribir Stock, no POS. Cada guardado de receta crea revisión inmutable con cantidades por unidad y actualiza puntero genérico del core en la misma transacción. El cierre captura `version_id` y elegibilidad desde core, sin llamar handlers ni leer tablas de Recetas/Stock. Consumidor posterior no consulta POS ni receta actual: expande la revisión capturada; una falla de expansión queda pendiente. Rutas/registros declaran enganches por módulo, del mismo modo que `beforeDisable`.
3. Persistir `core.module_event` (o nombre genérico equivalente) con ID, tipo/versión, comercio, fuente, snapshot y fecha; `core.module_event_delivery` por evento+suscriptor con estado, intentos, próximo intento, claim/deadline y diagnóstico sanitizado. `core.module_resource_version` indexa punteros por comercio/tipo/ID de recurso/proveedor/slot; revisión en `recipes.revision`. No FK/import del core a tablas de módulo. Evento único por tipo+comercio+fuente, delivery único por evento+suscriptor. Stock conserva referencias de origen sin FK a POS no declarado.
4. La creación del evento y congelación mínima del snapshot pertenecen al commit del cierre; **escribir movimientos pertenece a otro commit**. Esto evita perder trabajo después de responder y permite que una falla del aplicador no revierta la venta. Persistencia fallida de venta/evento no se presenta como cierre exitoso: no se puede garantizar durabilidad en una DB que no confirma el commit. El núcleo de cierre únicamente captura punteros; fallos del aplicador o de lectura de revisiones no impiden `closed` ni liberación de mesa.
5. Aplicador procesa todos los consumos del evento en una transacción y marca delivery aplicado allí mismo. Unicidad adicional de movimiento orden+línea+insumo; lock de pares insumo/local en orden fijo; retry de evento aplicado no escribe. No marcar aplicado tras skip, fallo parcial o rollback. Recuperar claim abandonado; no descartar fallos persistentes.
6. Disparadores: intento acotado después del cierre, siguiente cobro, apertura Stock y job externo cron-job.org. La ruta interna genérica exige `CRON_SECRET` y devuelve solo resumen; wallet conserva su job independiente. Owner aprobó cada 30 min durante las 24 h para cubrir noche y permitir suspensión entre llamadas. Zona Guayaquil, claim indexado, batch de 50 y presupuesto de 20 s son detalles técnicos del diseño, no respuestas adicionales atribuidas al owner. Configuración a cargo del owner, aún no realizada; no nueva automatización GitHub/Vercel.
7. Evento creado cuando módulos apagados no produce consumo y no se transforma al reactivarlos. Pendiente ya capturado con módulos encendidos conserva obligación/snapshot aunque luego cambien; no equivale a reconstruir cierres omitidos. POS no recibe DTO de Stock ni muestra incidencias. Stock informa negativos y aplicación pendiente.

## Modelo local

`stock.item` y recetas siguen globales. `stock.item_location` identifica el par insumo/local y su último costo; movimientos llevan local obligatorio, compras/ajustes/consumo y origen estable. Saldo derivado de movimientos, decimal exacto. Owner aprueba drenar pendientes antes del conteo. Capturar corte, drenar y revalidar: pendiente anterior →409 consumption_pending; nuevos cierres durante preparación →409 count_changed y actualizar solo conteo. Transacción consistente con lock de par para saldo/ajuste, incluido local archivado; nunca mantener lock POS durante drenaje ni impedir cobrar/liberar mesa por Stock. Compra en archivado no. Default de lectura: primer activo `created_at, id`; contratos propios del módulo no exigen permiso de Locales.

Backfill solo hacia destino real: único activo o mapa explícito; sin destino con datos, detener y decidir. POS pasa a local obligatorio tras resolver nulos comprobables. Nunca generar consumos para ventas históricas. Rollout definido: expandir esquema/puente DB para writers antiguos de único local; backfill y validar; deploy con consumo desactivado; activar para cierres nuevos tras validación; NOT NULL/retirar puente y costo global cuando no queden writers antiguos. Preservar eventos/revisiones/consumos al hacer rollback. Cada operación PROD espera permiso propio; este ADR no autoriza ejecutarlas.

## Alternativas y consecuencias

- Transacción conjunta cobro+movimientos: simple, pero error técnico de consumo revierte cobro, alternativa descartada por respuesta 11 del owner.
- Solo `after()`/best-effort: puede perder consumo tras commit; no satisface durabilidad.
- POS importa Stock/Recetas o `requires` obligatorio: rompe fronteras y venta con módulos apagados; no adoptar.
- Evento genérico durable: agrega outbox/deliveries, puntero genérico y revisiones inmutables, más un aplicador acotado, evita broker/daemon nuevo y permite retry independiente. No crear bus genérico remoto, scheduler propio ni pipeline adicional de QA.
- Snapshot evita que editar receta vuelva a interpretar ventas; referencias estables permiten costos futuros sin reescribir movimientos. No se incorpora cálculo ponderado ni costo congelado en esta etapa.
- No se promete saldo actualizado durante incidente: pendiente visible solo en Stock. Cron vacío aún puede despertar Neon, aunque haga una consulta indexada. ADR0118 documenta suspensión tras 5 min; no se verificó nuevamente infraestructura/precios ni se configura el job en este encargo.

## Estado y límites

Decisión de diseño cerrada y decisiones del owner registradas en spec0227. Selector POS multi-local **ya existe**; se conserva y backend garantiza local válido, con autoasignación cuando hay uno. Cron30min24h aprobado; configuración, preflight, implementación, migraciones y publicación no se ejecutaron aquí. No se agregan índices/estados comunes en este encargo. Costos futuros podrán ser aditivos sin repartir nuevamente inventario ni reinterpretar movimientos.
