# 0242 — CP2c.7 ensamblado HTTP del cierre V2

Estado: preparada, sin autor/reserva. Requiere cierre interno CP2c.6 aceptado; autor NUEVO/contexto vacío, coordinador fija base/factory. Bloque pequeño de una ruta, no agregar anulación/retirada/activación/UI al mismo autor. Leer protocolos, contrato0242 cierre/scope/versiones y handlers actuales pertinentes.

## Resultado

POST /api/modules/pos/orders/:id/close selecciona contrato con posReadContract(request) dentro del handler ya protegido por posRoute: ausente/1 llama closePosOrder legacy,2 llama closeMeasuredPosOrder aceptado; desconocido409pos_client_upgrade_required antes body y efectos. Guard ordinario y scope preceden dominio como hoy; private/no-store en éxito/error. No otra ruta ni endpoint directo de acreditación. La misma idempotencia y DTO2 canónico del cierre interno salen por HTTP sin transformación de cantidades/precios/pagos/originales/cupón.

Mantener rutas/guard/auth/scope comunes vigentes, no if POS en core ni GET sesión/módulos extra. Header2 no pasa por reader legacy ni degrada a1. Errores422 financieros/409version_conflict incluyen datos autorizados completos; no reinterpretar fallos después commit como posibilidad de volver a cobrar con otra clave. Response closed replay conserva IDs/snapshots/closedAt y no vuelve a acreditar ni encolar efectos.

Esto conecta el opt-in unit compatible; no retira barreras de masa/tarifa ni escritores viejos, no activa nueva consola y no certifica circuito mass. Anulación V2, política obligatoriaV2 de cutover y Counter410 son entregas posteriores independientes. No presentar la ruta como POS0242 completo.

## Paths autorizables

- apps/merchant/src/modules/pos/server/routes.ts, solo handler/import de close
- apps/merchant/src/modules/pos/server/close-api-v2.neon.integration.test.ts
- docs/factory/0242-cp2c-close-api-handoff.md

Sin close interno/legacy/accredit/publisher/readers/void/cupones/contratos/guards/core/schema/journal/UI/kit/tooling/deps/estados/índices. Si falla un contrato aceptado, avisar y pedir extensión concreta antes editar; no copiar lógica de cierre al handler.

## Gate

Node24 tipos merchant/lint/formato/UIguard y prueba HTTP focal usando fixture real unit creadaV2: header2close y replay devuelven DTO2 canónico y único efecto; ausente/1 preservan DTOlegacy en venta propia; desconocido no parsea cuerpo ni genera efectos; fallo guard/scope ocurre antes dominio, tenant ajeno no lee ni cierra; private/no-store y conflicto con orderV2 strings íntegros. Acreditación/stock/recetas/comisión ya probados por cierre interno: inspeccionar identidad/reusar evidencia, no repetir su matriz en la ruta. Harness de route/guard explícito no certifica autenticación nativa Next; esa comprobación es de combinación final.

CI exclusiva solo wrapper/env seleccionado hasta teardown; logs SHA/base/config/comandos/exits/fallos/skips fueraWT y cleanupIDs propios completos,0procesos. Sin browser/build/fullverify/M0/M1/activaciónmass/migración. QA NUEVO independiente, autor conserva fixes; factory/integración coordinador. Sin push/PROD/3201/túnel/M0/demos/artefactos ajenos.
