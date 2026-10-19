# 0242 P3b — activación canónica de masa

Autor nuevo en WT/ref `pos-ui-grid-0242`, base `44a3d604`. Sin push ni PROD.
Fuente de esquema/producto y suite canónica congelada en `49e1990b`; harness
nativo final en `453ed0f7`. Este handoff es el único añadido documental posterior.
Contrato: [activación P3b](0242-p3b-activacion.md), spec0242/anexo normativo.
P3a independiente `241089a4`, entrega `63ac5b1e`, era prerequisito cumplido.

## Cambios propios

- `packages/db/src/schema/catalog.ts`, `order.ts`, `modules/pos.ts` y migración
  `0108_measured_activation.sql`, snapshot0108/journal generado en serie.
- Nueva suite `apps/merchant/src/modules/measured-mass-0242.neon.integration.test.ts`.
- Fixture `apps/merchant/src/modules/pos/server/mass-native.neon.integration.test.ts`
  y runner `tools/pos-measurement/mass-native.mjs`.

0108 retira las nueve barreras temporales y añade invariantes permanentes.
La forma comercial de producto ya estaba protegida por `product_sale_measure_check`;
se conserva esa constraint, sin duplicarla. Piezas: cantidad entera positiva hasta
2147483647, unidades unit/unit. Masa: cantidad positiva hasta999999999.999999999,
unidades kg/lb/g. Toda línea exige `mass-si-1`. Tarifas precisas nuevas quedan
acotadas; se conserva el extremo unit histórico9999999999.99 de numeric12,2.
Core conserva precios unit históricos con signo; mass exige precio>=0. Finitud,
unidades incompatibles y formas inválidas se rechazan en DB. No se modificaron
0102/0103/0105 ni se convirtió ningún snapshot a Number.

No se rehízo ningún fundamento: catálogo/business V2, create/update V2, cierre
medido, acreditación, writer core, publisherV4 y consumidores existentes ejecutan
la cadena real. No hay un segundo productor V4 ni tablas clonadas.

## Evidencia dominio y DB

Node24.20.0, pnpm11.4.0; configuración CI seleccionada existente
`/private/tmp/checkpass-pos-0242/private/selected.json` y `ci.env`, sin modificarlos.
DB exclusiva también en teardown. Toda operación DB usó `tools/neon-test.sh`
mediante el runner, `--no-file-parallelism`; antiPROD incondicional y comparación
con el endpoint esperado en runner/fixture. No hubo rollbackDDL ni otras suites DB.

`node tools/pos-measurement/mass-native.mjs domain` en `49e1990b`: **3/3 PASS**,
0skips, 114.95s de tests. Log `mass-native/domain-49e1990b.log`.

1. Catálogo/configuración real → crear mix → editar conservando tarifa precisa
   tras cambio de catálogo → cierre/settlement/pagos → acreditación real/core →
   V4 → Recetas con base explícita kg → Stock/costos → comisión/analíticas.
   1lb,453.59237g y0.45359237kg son equivalentes; la receta capturada produce
   tres consumos de45.359g más200g discretos. Comisión0.35 sobre14.00.
   Delivery pendiente y aplicado se distinguen; cambio posterior de base/tarifa/
   comisión no altera la captura y replay no duplica efectos.
2. Pase/cupones reales: porcentaje e importe sobre masa, neto0 con payments[],
   gratis/2x1 rechazados en objetivo mass sin consumir cupón ni cambiar saldo/orden,
   unit elegible del mismo producto en una mezcla de snapshots unit/mass.
3. Extremos históricos unit, precio core con signo y rechazo SQL de cantidad
   fraccionaria unit, cero, NaN/Infinity, tarifa fuera de rango, mass negativa,
   conversión/unidades incompatibles. Inserta en tablas canónicas, sin quitar checks.

Primera corrida `9eedd8ac`: cadena y constraints pasaron; fidelización falló por
expectativa del fixture de18puntos en1.80. El programa acredita bloques enteros de
USD1 y concede10. `49e1990b` corrige la expectativa y añade la moneda obligatoria del
cupón de importe. Se conserva `domain-9eedd8ac.log`; no es una corrida PASS.

## Evidencia nativa compuesta

Solo Next development webpack16.3.0 en43252, auth/cookies/scope/HTTP/DB reales,
sin interceptar API, capturas ni hardware supuesto. El pase se ingresó por
“Código del pase”; no se certifica cámara física. No certifica build/start M1,
carga fría ni rendimiento. Se conservó el3201/túnel y los artefactos M0.

Artefactos propios exclusivos en `/private/tmp/checkpass-pos-0242/mass-native/`,
0700, manifests0600. `manifest.json` se creó con IDs antes del primer write, setup
`49e1990b` **1/1 PASS**. Se preservó intacto; `loyalty.json` reservó IDs de programa,
consumidor/pase/cupón antes de sus writes, setup `c129ac4c` **1/1 PASS**.

- `c129ac4c`: el primer lanzamiento Chromium fue bloqueado por MachPort/sandbox
  antes de requests. La ejecución con escalación autorizada recorrió UI masa →
  Identificar con pase real → cupón10% → HTTPcreate201 → close200 → recibo visible;
  alcanzó la aserción de **0GET de órdenes tras write**. Falló después por buscar
  la cerrada en la vista inicial de abiertas. Se conserva el fallo completo en
  `browser-failure-1792395946666.json` y logs `browser-c129ac4c*.log`.
- La identidad/cupón ya consumidos no se reutilizaron para otra venta. Modo
  `history` solo permite comprobar un intento previo explícito y rechaza una
  corrida con requests POS de escritura. En `a3156276` abrió Cerradas hoy/recibo,
  pero una aserción de texto omitía el prefijo “Cliente:”; fallo preservado en
  `browser-failure-1792396044783.json`.
- `453ed0f7`: modo history **PASS**, cinco requests POS, todosGET, abre la misma
  orden desde Cerradas hoy y comprueba el recibo con cliente. `browser.json`
  enlaza SHA/hash del intento original y separa ambas fuentes. No se afirma que
  el recorrido original completo fue una corrida única PASS ni se ocultan fallos.
- `fixture inspect` en `453ed0f7`: **1/1 PASS**, log `inspect-453ed0f7.log`.
  DB confirma una venta, una línea0.75kg, tarifa4.123456789, bruto3.09,
  descuento0.31/neto2.78, un pago2.78, dos puntos, una redención y un eventoV4.
  Reejecuta el writer con el UUID/body reales del cierre HTTP y compara snapshots:
  no agrega pagos, redenciones, puntos ni eventos. `inspection.json` lo registra.
- `fixture cleanup` en `453ed0f7`: **1/1 PASS**, teardown CI por ownership tras
  detener Next propio. Confirma negocio/owner ausentes; elimina consumidor propio.
  `cleanup.json` y log conservados, sin borrar manifests/errores/evidencia.

`identity.json` guarda hashes de fuentes, lock/config seleccionada y todos los
artefactos anteriores. `git diff --exit-code 49e1990b HEAD --` sobre los tres schemas,
0108/journal/snapshot y suite canónica devuelve0: producto/esquema y3/3 canónicos
son idénticos durante los cambios posteriores del harness.

## Checks y cierre

Merchant typecheck PASS en el harness con fidelización, DB typecheck PASS sobre
el esquema0108; ESLint focal de schemas/suites/runner y Prettier focal PASS.
`git diff --check` PASS. No se amplió a verify/global ni a suites V1 obsoletas.
No cambió código UI/app, kit, guard, scanner/types legacy ni consumers productivos.

Escalaciones acotadas: índice Git del WT para commits locales, Chromium por
MachPort y SIGTERM de los dos procesos Next propios43252. Todas autorizadas por
sandbox; no rechazos de auto-review pendientes.43252 ya detenido;3201 sigue
escuchando con su proceso previo. Sin pendientes DB propios ni worktree retirado.
QA independiente del candidato sigue pendiente; no es aceptación ni gateM1.

## Ajuste previo a QA: namespace reutilizable

Posterior a `9c57a55c`, solo se ajustan el runner, su fixture y este añadido.
`POS_MASS_NATIVE_RUN` es opcional y se valida en ambos con
`^[a-z0-9-]{1,48}$`. Por ejemplo, `POS_MASS_NATIVE_RUN=qa-p4` selecciona
`/private/tmp/checkpass-pos-0242/mass-native-qa-p4`; sin variable conserva el
`mass-native` original. Se propaga al wrapper y al servidor; browser/history
leen el mismo namespace. Manifiesto y reporte registran el run, que se revalida
al leer la población. No permite rutas arbitrarias ni redirigir por symlink;
directorios0700, archivos0600 y creación exclusiva con `wx` se mantienen.

QA debe usar el mismo namespace nuevo en `fixture setup`, `fixture loyalty`,
`server`, `browser`, `fixture inspect` y `fixture cleanup`, reservando43252 en serie.
El namespace aísla identidades y artefactos, no asigna otro puerto. No reutilizar
la venta original ni sobrescribir `mass-native/`, private/M0 o sus manifests.

El browser principal comparte ahora con history los helpers que seleccionan
“Estado → Cerradas hoy”, abren la orden y comprueban el recibo y el texto exacto
“Cliente: Cliente Masa nativa”. La aserción de0GET/orders tras write permanece
antes de la navegación explícita al historial.

Checks de este ajuste: Node24 `node --check` del runner, merchant typecheck,
ESLint/Prettier focal y `git diff --check`: PASS. No se ejecutó runner, DB,
servidor ni navegador; no hay otra venta ni nuevos artefactos de ejecución.
Producto/esquema y suite canónica siguen idénticos a `49e1990b`. La evidencia
nativa anterior continúa siendo compuesta: venta en `c129ac4c`, lectura final e
inspección/replay en `453ed0f7`, con los fallos previos preservados. El nuevo
recorrido completo tras combinar P4 corresponde a QA con su namespace propio.
