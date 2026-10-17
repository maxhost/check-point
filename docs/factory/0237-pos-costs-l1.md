# 0237 — Cadena POS/costos y explicación de ganancia (L1)

Owner autorizó procesamiento manual de cola local, completar cadena posterior al cobro y textos propuestos. Solicitó expresamente L1 rápido, sin agentes ni QA automatizado; QA navegador a su cargo. Base dev/main f08e22bc. Candidato en dev, QA manual pendiente, sin PASS ni pase a main declarados.

Cola Docker local procesada por endpoint interno existente, destino validado local y CRON_SECRET solo en memoria: primera tanda claimed30/applied30/failed0, siguiente claimed0. Verificación SQL solo lectura: Joyas revenue5400/cost_of_goods875, unidades5/con costo5, pendientes0. Resultado esperado bruto45.25USD/cobertura100%, antes de gastos. No backfill ni FX, sin PROD, seed o migración.

POS after ahora incluye sale.closed, recipes.consumption.applied y sale.commission.frozen; presupuesto20s/lote50/comercio autenticado. Usa retry genérico existente: Recetas aplica consumo/publica su evento y core incorpora su costo en el mismo drenaje acotado. Respuesta no espera; cron/durabilidad/dedup permanecen. No modifica productores, traductores ni corte Stock.

Histórico expone unidades/costos/comisiones ya calculados. UI muestra ganancia pendiente sin costos, cálculo incompleto con cantidad de unidades faltantes, o monto con explicación ventas/costo/comisiones cuando cobertura completa; no presenta ingreso total como ganancia ante costos faltantes. Se preservan condiciones existentes del resultado después de gastos y del punto de equilibrio.

Comprobación mecánica: git diff--check. No tests, tipos, browser automatizado, suites Neon ni medición de rendimiento. QA manual sugerido: recargar Joyas (45.25USD con datos actuales), nueva venta con receta y posterior consulta de costos; revisar estados sin costo/parcial/completo. Todos los diferidos previos siguen vigentes. Nada de push/deploy/PROD ni INDEX/TASKS/Claude.
