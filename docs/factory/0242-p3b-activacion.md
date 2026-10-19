# 0242 P3b — activación canónica medida

Depende del gate independiente P3a: entrada/accesos y bloqueo de escritores viejos.
No se permite retirar barreras por tener solo pruebas puras del bloqueo.
P3a aceptado en `241089a4`, entrega QA `63ac5b1e`, en dev/main local.
Writer nuevo en WT/ref `pos-ui-grid-0242`, reserva continuada homónima.
Base de ejecución: commit documental que incluye esta asignación y la ficha P4.

## Corte serial previsto

Asignar explícitamente un único writer de `packages/db/src/schema/catalog.ts`,
`order.ts`, `modules/pos.ts`, nueva migración0108, journal y snapshot. B es todavía
el slot de esquema: su nuevo autor conserva exclusividad de DBCI incluido teardown.
No editar migraciones0102/0103/0105.

Paths explícitos adicionales: `packages/db/drizzle/0108_measured_activation.sql`,
`packages/db/drizzle/meta/0108_snapshot.json`, `packages/db/drizzle/meta/_journal.json`,
`apps/merchant/src/modules/measured-mass-0242.neon.integration.test.ts`,
`apps/merchant/src/modules/pos/server/mass-native.neon.integration.test.ts`,
`tools/pos-measurement/mass-native.mjs` y
`docs/factory/0242-p3b-mass-handoff.md`. Ficha actual es del coordinador.
Si hay defecto de producto o fixture previa incompatible, pedir ampliación antes
de editar. No rehacer consumidores ni modificar guards/tooling ajenos.

Asignación explícita del harness nativo del corte al nuevo autor: fixture propia
por wrapper CI y runner Next development en puerto43252 con auth/cookies/HTTP/DB
reales y navegador sin interceptar API. Configuración seleccionada solo CI,
antiPROD incondicional, manifiesto exclusivo previo a writes, cleanup por ownership.
Conservar el3201/túnel y todos los artefactos M0; sin capturas ni impresión hardware.
La configuración de este smoke no certifica M1 build/start.

Sustituir las nueve constraints temporales por invariantes permanentes de forma y
finitud: unit exige cantidad entera positiva y unidades unit/unit; mass exige ambas
unidades kg/lb/g y cantidad positiva dentro del límite de captura. Ambas exigen
conversionVersion mass-si-1. Preservar extremos unit históricos2147483647 y tarifas
numeric12,2 hasta9999999999.99; core.order_item conserva snapshots históricos con
signo que el almacenamiento previo admitía. NaN/infinito/unidades incompatibles
no deben quedar permitidos al retirar los checks temporales. Los límites de nueva
captura/tarifa se aplican además en dominio, sin convertir snapshots a Number.

Reutilizar catálogo/business V2, `createPosOrderV2`, `updatePosOrderV2`,
`closeMeasuredPosOrder`, acreditación exacta, writer core y publisherV4 existentes.
V4 ya se publica en cierre V2 unit; no añadir un segundo productor.

## Evidencia decisiva

Migración CI protegida, serial y sin rollbackDDL concurrente. Pruebas de rechazo
de forma/unidades/finitud y conservación de extremos históricos. Luego catálogo
medido real → crear → editar → cerrar → settlement/pagos → eventoV4 → Recetas →
Stock/costos → comisión/analíticas. Usar tablas canónicas y composición con base
explícita, sin tablas clonadas ni desactivar checks a mano en el fixture.

Extender la sección vertical existente de
`apps/merchant/src/modules/measured-close-0242.neon.integration.test.ts` o crear
suite hermana con writer asignado. Incluir mezcla unit/masa, equivalencia kg/g/lb,
tarifa precisa, snapshots tras cambiar catálogo/base, replay sin efectos nuevos y
delivery pendiente/aplicado distinguido. Pruebas puras previas de consumidores se
reutilizan, pero no sustituyen esa cadena canónica.

Fidelización punto5 se incorpora aquí cuando permita mantener fixtures pequeñas:
pase/cupón real, porcentaje/importe sobre masa, gratis/2x1 rechazados en objetivo
mass sin consumo, unit elegible en mezcla y neto0 con payments vacío. Mantener
guard/scope de P3a y no recuperar acceso mediante identidad nueva.

UI/auth/HTTP/DB nativos constituyen gate separado de los tests de dominio. Preparar
smoke Next aislado con fixture propia y configuración CI seleccionada; conservar
servidor/túnel3201. Sin capturas ni hardware supuesto. Tras congelar entrega,
QA independiente nuevo antes de continuar retirada final y campañaM1.

## Restante posterior

P4: retirar UI sin consumidores productivos y ajustar Clientes/defaults/tours/canje,
extrayendo scanner/tipos compartidos antes de borrar Counter. P6 convierte suites
HTTP V1 obsoletas sin perder negativos y cierra combinación/rendimiento.
M1 usa control compilado6f8e1e9c archivado y candidato build/start contemporáneos,
30paresAB/BA,10primeras assets por fuente y receta estadística ya congelada en
0242-performance. Conservar evidencia M0; no sobrescribir manifiestos/freezes ni
reutilizar identidades de flujos consumidas. Tail postclose fuera del reloj y con
misma condición de finalización en ambas fuentes; p95 inconcluso nunca PASS.
