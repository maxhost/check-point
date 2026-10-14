---
adr: 0145
fecha: 2026-10-13
estado: propuesta
resumen: Evento genérico durable de cierre y consumidor de Recetas que aplica stock idempotente después del commit; stock por local sin dependencia obligatoria del POS.
---

# 0145 — Consumo de stock al cobrar, mediante evento durable

## Contexto

Spec0227. El owner confirma inventario/costo por local, cantidades de receta por unidad, consumo al cerrar POS y venta sin bloqueo por stock negativo ni fallo técnico del aplicador. POS debe funcionar sin Stock/Recetas encendidos. ADR0139/0141 permiten importar solo módulos declarados en `requires`; `optional` permite nombrarlos, no importar. Hoy no existe enganche de cierre. No crear un `if stock` en el core ni exigir Stock para vender.

## Diseño propuesto

1. Agregar contrato genérico de eventos en el marco de módulos: publicación dentro de transacción, captura de snapshot por suscriptor registrado y aplicación posterior. POS publica `sale.closed` con identificadores estables de orden/línea, local, producto, unidades, usuario y fecha. Registro genérico resuelve suscriptores; core no importa/nombra módulos concretos. Payload tipado y validado, sin secreto ni contenido IA.
2. Recetas declara suscripción al evento y referencia opcional al productor POS; mantiene `requires: [stock]`. Puede importar/escribir Stock, no POS. La captura devuelve ingredientes/cantidades normalizados y elegibilidad **del cierre**. Consumidor no consulta POS: usa payload inmutable, ni usa recipe actual durante retry. Rutas/registros declaran enganches por módulo, del mismo modo que `beforeDisable`.
3. Persistir `core.module_event` (o nombre genérico equivalente) con ID, tipo/versión, comercio, fuente, snapshot y fecha; `core.module_event_delivery` por evento+suscriptor con estado, intentos, próximo intento, claim/deadline y diagnóstico sanitizado. No FK del core a tablas de módulo. Evento único por tipo+comercio+fuente, delivery único por evento+suscriptor. Stock conserva referencias de origen sin FK a POS no declarado.
4. La creación del evento y congelación mínima del snapshot pertenecen al commit del cierre; **escribir movimientos pertenece a otro commit**. Esto evita perder trabajo después de responder y permite que una falla del aplicador no revierta la venta. Persistencia fallida de venta/evento no se presenta como cierre exitoso: no se puede garantizar durabilidad en una DB que no confirma el commit. Ver hallazgo de captura en spec0227.
5. Aplicador procesa todos los consumos del evento en una transacción y marca delivery aplicado allí mismo. Unicidad adicional de movimiento orden+línea+insumo; lock de pares insumo/local en orden fijo; retry de evento aplicado no escribe. No marcar aplicado tras skip, fallo parcial o rollback. Recuperar claim abandonado; no descartar fallos persistentes.
6. Disparadores: intento acotado después del cierre, siguiente cobro, apertura Stock y job externo cron-job.org. La ruta interna genérica exige `CRON_SECRET` y devuelve solo resumen; wallet conserva su job independiente. Propuesta: cada 30 min durante las 24 h, zona Guayaquil, claim indexado/batch de 50/presupuesto de 20 s, para cubrir noche y permitir suspensión entre llamadas. Configuración/frecuencia esperan owner; no nueva automatización GitHub/Vercel.
7. Evento creado cuando módulos apagados no produce consumo y no se transforma al reactivarlos. Pendiente ya capturado con módulos encendidos conserva obligación/snapshot aunque luego cambien; no equivale a reconstruir cierres omitidos. POS no recibe DTO de Stock ni muestra incidencias. Stock informa negativos y aplicación pendiente.

## Modelo local

`stock.item` y recetas siguen globales. `stock.item_location` identifica el par insumo/local y su último costo; movimientos llevan local obligatorio, compras/ajustes/consumo y origen estable. Saldo derivado de movimientos, decimal exacto. Conteo opera bajo lock de par, incluso local archivado; compra en archivado no. Default de lectura: primer activo `created_at, id`; contratos propios del módulo no exigen permiso de Locales.

Backfill solo hacia destino real: único activo o mapa explícito; sin destino con datos, detener y decidir. POS pasa a local obligatorio tras resolver nulos comprobables. Nunca generar consumos para ventas históricas. La migración y retiro de costo global requieren protocolo de rollout definido antes de implementar; quedan pendientes, no autorizados por este ADR.

## Alternativas y consecuencias

- Transacción conjunta cobro+movimientos: simple, pero error técnico de consumo revierte cobro, alternativa descartada por respuesta 11 del owner.
- Solo `after()`/best-effort: puede perder consumo tras commit; no satisface durabilidad.
- POS importa Stock/Recetas o `requires` obligatorio: rompe fronteras y venta con módulos apagados; no adoptar.
- Evento genérico durable: agrega dos tablas y un aplicador acotado, evita broker/daemon nuevo y permite retry independiente. No crear bus genérico remoto, scheduler propio ni pipeline adicional de QA.
- Snapshot evita que editar receta vuelva a interpretar ventas; referencias estables permiten costos futuros sin reescribir movimientos. No se incorpora cálculo ponderado ni costo congelado en esta etapa.
- No se promete saldo actualizado durante incidente: pendiente visible solo en Stock. Cron vacío aún puede despertar Neon, aunque haga una consulta indexada. ADR0118 documenta suspensión tras 5 min; no se verificó nuevamente infraestructura/precios ni se configura el job en este encargo.

## Estado y pendientes

Propuesta de diseño basada en decisiones de producto respondidas. Spec0227 sigue borrador por corte de conteos vs pendientes, caso POS multi-local durante piloto, captura de snapshot ante error y estrategia expand/contract. Horario cron requiere confirmar propuesta. Ninguna implementación, migración, pruebas, publicación ni cambio de registros comunes forma parte de esta entrega.
