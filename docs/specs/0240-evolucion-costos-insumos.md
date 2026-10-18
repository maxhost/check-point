---
spec: 0240
fecha: 2026-10-18
estado: implementada localmente
nivel: L2
resumen: Evolución de costos registrados por insumo/local en Analíticas, selector con valor por defecto y gráfico accesible del kit.
disjunta: no; usa el GET history y la tarjeta Stock de0239.
---

# 0240 — Evolución del costo de un insumo

Owner aprueba implementar con flujo de agentes un dropdown de insumo con selección inicial y gráfico de línea que cambia al seleccionar; autoriza EXPLÍCITAMENTE añadir el gráfico al kit. L2 por nuevo contrato/selección y representación de datos monetarios; no cambia cobros, costos operativos ni valoración. Sin push/PROD, migraciones/dependencias o nuevas lecturas DB por seleccionar.

## Producto cerrado

- En Stock e insumos conservar valoración total/conocida/pendiente, fecha, cobertura de costos y las explicaciones existentes. Añadir «Evolución del costo» con SelectField del kit y gráfico. El porcentaje agregado/frecuencia anteriores siguen disponibles como información secundaria claramente del conjunto, no del insumo elegido.
- Cada opción es insumo + local: «Harina · Principal». No mezclar precios de un insumo entre locales. El filtro Local superior reduce opciones; Todos permite pares independientes. Nombre/unidad claros (g/ml/unidad); nombres largos accesibles, sin perderlos irreversiblemente.
- Default: primera serie con al menos dos puntos (baseline + registro del período también cuenta); prioridad última observación descendente, empate etiqueta/id estable. Si no hay comparables, primera serie con un punto. Cero series: explicación y sin gráfico inventado. Selección permanece si el par sigue disponible al cambiar filtros; si desaparece, usar default válido. Sin estado persistente/storage nuevo.
- Serie contiene observaciones diarias reales entre from/to del período superior y, si existe, una única observación real inmediatamente anterior para comparar. Baseline conserva su fecha original y se identifica como anterior al período. Sin observaciones futuras, monedas/unidades ajenas, promedios entre locales, relleno diario ni valores ficticios. Un punto: mostrar costo/fecha y estado «Todavía no hay cambios para comparar»; dos valores iguales: línea plana válida. Datos ausentes jamás equivalen a costo0; costo0 válido.
- Línea recta entre puntos, posición horizontal por fecha real (sin curva suave). Fechas e importes/eje por unidad visibles; explicación de que son costos registrados. No afirmar que el costo fue observado todos los días ni pronosticar. Tabla o listado accesible de fecha/costo disponible para leer todos los registros, también por teclado/touch sin depender de hover. SVG/cálculo geométrico encapsulados en kit; no nuevos nativos/style/CSS ni paleta cruda fuera de él.
- Importes de costo por unidad conservan precisión subcentavo (p.ej.0.001USD/g no se muestra como0.00). Contrato conserva decimal exacto en unidades menores; sólo geometría aproxima a number validado. Formato moneda/unidad local y origen de la observación claros.

## Contrato HTTP y cómputo

GET `/api/analytics/history?period=...&locationId=...` añade `stockCosts` con tipo compartido puro en `packages/domain/src/analytics/stock-cost-contract.ts`:

`{ from,to,currencyCode,minorUnit,defaultSeriesId:string|null,series:[{id,itemId,label,locationId:string|null,locationName,unit,points:[{date,amountMinor:string,isBaseline:boolean}]}] }`.

Id estable por item/local/unidad. Datos desde analytics.daily_gauge/labels/locations ya leídos por readHistory; builder puro nuevo, sin consultar tablas/APIs del módulo Stock desde core ni cambiar schema/ingestión. Aislar local igual que valoración; filtrar moneda/unidad del negocio y validar decimales/no negativos antes de serie. Orden diario ascendente y desempate observado/evento coherente con últimas observaciones existentes. Etiquetas por kind=item/id; fallback neutral si falta etiqueta/local. Nunca filtrar por parámetros de negocio enviados por cliente. Sin SQL adicional: reutilizar stockRows e input.labels/locations. Payload sólo costos por período+baseline, no stock completo/raw events.

El GET ya privado/no-store mantiene permiso analytics/guards/scope409 antes de lectura y manejo de error. No endpoint nuevo, GET al cambiar dropdown, polling, caché u owner adicionales. Day/Inbox/summary/recentMovements/cálculo y módulos ajenos intactos. Selector funciona con el snapshot del GET actual; cambio de filtros reutiliza carga existente y descarte de respuesta tardía. No extrapolar M1 a este nuevo payload ni prometer tiempo real tras registrar compra.

## Roles y paths

Coordinador reserva spec/INDEX y contrato, crea dos WT/ref desde dev, reserva factory. Implementador A: dominio builder/tests y wiring servidor/consulta+integración focal. Implementador B: tarjeta/selector/formato de costos+gráfico kit autorizado y browser focal (harness autorizado por0225). No subdelegar; ambos entregan SHA/handoff y corrigen su parte. QA independiente en tercer WT evalúa revisión congelada/combinación, reutiliza evidencia compatible y reproduce señal decisiva si duda. Sólo coordinador modifica INDEX/estado/spec.

## Aceptación y evidencia proporcional

A: unidad de períodos/meses, baseline real, orden/default estable, cero/uno/plano/subcentavo, falta de labels, local/moneda/unidad/futuro y no mutación del input; wiring sin SQL nuevo. Negativos reales tenant/local vía wrapper NeonCI aislado reutilizando readHistory y fixtures acotadas, sin DDL nuevo ni datos localesDEMO.
B: desktop/móvil en tanda, selección de otro par cambia serie/valores sin HTTP, teclado, defaults/remoción al cambiar filtro, empty/onepoint/plano/subcentavo y costos incompletos; lectura accesible de todos los puntos, sin overflow. Tipos/lint/guard/diff, checks decisivos de geometría si hace falta. No tests que sólo repitan implementación ni campañas globales/M1 por ceremonia.
QA: revisar pureza/scopes/precisión/contrato y gráfico honesto; combinar A+B sobreSHA exacto y smoke local. No declarar PASS por skips/retries. Mainlocal trasQA; cleanupfactory limpio y evidencia fueraWT. Preservar QAmanual/CIrojo/guardias24PASS2FAIL/FAILfrío1817.621042ms/diferidos ciudades-weather-calendarios-crons-Marketingcupón11-realtimeinfra y demos existentes. Sin push/PROD.

## Entrega local

Datos `0f027cf8` y UI corregida `eec922c3`, aceptadas individualmente por QA independiente. Candidato combinado `298134ab`: tipos merchant y browser focal 3/3 PASS, sin skips/retries. QA detectó y se corrigió la comparación de extremos monetarios: etiquetas mínimo/máximo usan decimales exactos; sólo la geometría aproxima a Number. Dominio 8/8, NeonCI protegido 3/3, boundary 4/4 y UI/formato/geometría 6/6 PASS; tipos/lint/guard pertinentes conformes. Se mantienen las cinco consultas de history y ninguna petición adicional al seleccionar.

Handoffs: [datos](../factory/0240-data-handoff.md), [UI](../factory/0240-ui-handoff.md) y [QA independiente](../factory/0240-qa.md). Evidencia externa `/private/tmp/checkpass-0240-evidence/`. Capturas 390/1440 revisadas. Lectura local protegida y de solo lectura confirmó el default demo Bolsa de empaque con tres puntos, incluida referencia del 30 de septiembre. Smoke app: health200 e history401 privado/no-store sin sesión; no certifica recorrido Next autenticado ni M1. Demos y diferidos conservados, sin push/PROD.


## Refinamiento visual L1 solicitado por owner

Tras revisar la UI, owner pidió priorizar cifra de stock y gráfico, fecha secundaria y menos texto. Valor total/conocido se presenta con Text metric y fecha localizada separada; estados incompletos siguen explícitos. Selector conserva nombre completo accesible sin duplicarlo visualmente; costo/fecha forman una fila breve. Explicaciones de línea y baseline pasan al desplegable de registros. Resumen agregado usa dos cifras con contexto de conjunto, sin párrafo continuo; cuando no es calculable no ocupa un bloque de texto. LineChart del kit autorizado añade área degradada lavanda y línea con tono info de contraste, sin suavizar ni inventar puntos. Un registro muestra estado breve, sin falsa evolución. Sin cambios de datos/SQL/HTTP/DB. Es un ajuste L1 dentro del alcance visual ya autorizado del kit, sin nueva spec.


Ajuste L0 posterior autorizado por owner: nodos más grandes y tooltips accesibles con costo exacto/fecha/baseline al hover/foco/press sustituyen el detalle desplegable y la fila del último costo. Se retira Ver registros; todos los puntos se consultan directamente en el gráfico sin HTTP adicional. Geometría y datos intactos; singleton conserva costo/fecha y estado breve sin tendencia inventada.
