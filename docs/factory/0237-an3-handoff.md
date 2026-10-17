# 0237 — AN-3: cierre local

**QA independiente PASS sobre candidato `1713d9423d3761a05daebeef660ddeb8502cd788`.** Implementadas anulaciones, clientes y promos: eventos atómicos, traductores puros, tarjetas 10/11/12, histórico y prueba real de clima. Se reutilizan suscriptor, resúmenes e inbox de AN-1/AN-2. El owner autorizó integrar en main local tras QA; sin push, deploy ni operaciones PROD.

## Revisiones y pruebas

- Base dev `dfe9ea70`; contrato AN-3 `bebf26c9`. Decisiones técnicas `ecd73b2e` y regla de días visitados aprobada `f7c81e5b`.
- A: entrega `99eac508c2a11dfb4c3f95f5ef2d1b605e7d2350`, fuente final `482cc115c24f9e343ff23cec6409bef4279df5be`. [Eventos, ingesta y clima](0237-an3-events.md). 6/6 Neon sobre fuente anterior compatible `c3aa93fd`; nuevo caso de ingesta tardía sobre fuente final: 1 seleccionado PASS, 6 no seleccionados (no se presentan como nuevos PASS). 58/58 unitarios, tipos/lint/guard y POS en móvil/escritorio PASS.
- B: entrega `ef3b4227ce9e798f60d647abe5573686f09609dc`, fuente final `421ef60c0f53be4959927fab06934436392734a8`. [Tarjetas e histórico](0237-an3-product.md). 34/34 unitarios, 5/5 Neon, cuatro recorridos browser de componentes, tipos/lint/guard PASS. Incluye UUIDv5 bajo customer_reader, homónimos, tenant ajeno y fin de campaña a las 23:30 de Guayaquil.
- [QA independiente](0237-an3-qa.md), informe `3e901602fa5354186be53cd9d4660e4286c4fbc5`: entregas y combinación aprobadas por separado; 10/10 oráculos propios sobre el SHA combinado exacto. Mismos blobs de producto que 482cc115, sin conflictos de integración.
- Coordinador sobre 1713d942: 58/58 comprobaciones focales de AN-1/AN-2/AN-3 y fronteras, 0 skips, 2,93s; tipos Merchant EXIT0; diff--check PASS. Logs `/private/tmp/checkpass-an3/combination-{unit,types}.log`. Sin verify global ni mutaciones.

Node 24.20.0/pnpm 11.4.0. DB únicamente por tools/neon-test.sh, configuración seleccionada `/private/tmp/checkpass-0237/migration.env`, recurso serial y teardown completo. Browser con componentes/kit reales y HTTP simulado; no se afirma un nuevo smoke de app real.

## Comportamiento final

Tarjeta 11 reconoce hábito por **al menos cuatro fechas locales distintas**, unidas entre locales del mismo comercio. Cuatro operaciones de un día cuentan un día para frecuencia; todas las operaciones y sus importes permanecen en el histórico. Gasto medio por día visitado y mediana entre fechas distintas. Copia explícita: «Juan solía venir cada 12 días. Su última visita fue hace 25 días». H5 verificado: Marketing no ofrece envío manual de cupón individual; acción final **«Ver cliente»**, destino específico por pseudónimo, permiso counter y tenant/RLS.

El pseudónimo es UUIDv5 del par negocio/consumer con namespace fijo propio de Analíticas, sin columna ni backfill de business_customer. Compra con canje y cierre POS comparten fuente por couponId, revisión financiera 2 sobre core 1: no duplican descuentos ni el neto completo del ticket, independientemente del orden de deliveries. Costo capturado separado. Snapshots de ciclo de campaña se publican en alta/edición/transiciones sin alterar el ciclo. La ingesta reconcilia solo tarjeta 12 después de aplicar todos los grupos: una delivery tardía puede crearla/actualizarla con el run ya ready; una edición futura la retira, sin reabrir el run ni perder estados.

**Una 0099**, únicamente analytics.campaign_snapshot; SQL SHA256 `2ff9057ef236676792e1a7d47b59f6f70946a3429cebf64d8aa42a2fbaf76105`. Schema/snapshot/journal coherentes, 0097/0098 intactas. Aplicada solo a DB aislada por wrapper. Core no importa módulos concretos ni consulta tablas de origen para calcular Analíticas. Corte Stock intacto.

## Clima real

**Una llamada real para Cuenca, queryCost=2**, observación del 16 de octubre y pronóstico del 17 de octubre persistidos por GET interno autenticado. Request 2026-10-17T13:43:18.711Z→13:43:20.817Z (08:43 de Guayaquil), fetchedAt real; gate normal de 6 h, sin override. Clave solo en memoria, sin copiar env ni imprimir clave/URL. Proveedor/DB reales, sin reintentos. Fuente c3aa93fd más harness externo exacto preservado en [0237-an3-weather-proof.txt](0237-an3-weather-proof.txt), SHA256 `90e0f5b4edcd2dd11e22a7697e80a242255571f564f1181d6e3a3a1c9c750e92`. No es suite automática ni se repitió la llamada. Log `/tmp/an3-a-weather-real.log`; detalle de datos y límites en A. Contexto continúa invisible.

## Fallos y pendientes preservados

Autores/QA conservan los fallos iniciales de fixtures, vector esperado UUID, selectors posicionales heredados, setup Chromium/harness y los defectos detectados de cliente por local y resultado 12 tardío. Se corrigieron sin quitar assertions de dinero, rollback o aislamiento. No se usa retry/skip como aprobación; cada prueba conserva fuente y alcance.

Siguen diferidos el rendimiento AN-1 (último frío de 2082,39 ms frente a 1000 ms, NO PASS), CI compartida con 0097 original, housekeeping de candidatas bajo 0,05, invocación operativa de ciudades, cron remoto y «cuánto ahorraste». La prueba real de clima y H5 quedan cerrados en AN-3; no se operó configuración de Vercel ni PROD.

Main local recibirá el candidato aprobado y estos informes conservando AN-1/AN-2. Origin/main referencia local sigue `db3175d2`; ningún push. INDEX/TASKS/estado Claude y archivos ajenos sin seguimiento preservados. Limpieza solo de los tres worktrees propios limpios después de comprobar entrega aceptada ancestro de main y ausencia de procesos; registro factory conserva las revisiones.
