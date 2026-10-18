# 0242 CP2a.7 — QA independiente catálogo UI

Veredicto: **PASS del alcance preparado CP2a.7** sobre candidato
`52c5270d99bbe31aa2c565974d1fc53a10d9aecc`. No autoriza publicación ni certifica
el guardado real mass/precisión pendiente de CP2c. QA nuevo, sin subdelegación,
sin implementar producto ni modificar tests del repositorio.

## Identidad y entorno

- Entrega autor `c699852cb552698d0b2479ee7bb1aa4b7a092cef`; código final
  `5c31ea38b9de66ac62acd9598a28fba33643003c`. Base autor `2c05f4db`;
  integración inicial `132e1c7e` más autor `4254e4c4` produjo candidato `7efc43ce`.
  Corrección `cac3d766` produjo `a17e2d63`, donde QA ejecutó señales decisivas.
- Diff revisado `a17e2d63..52c5270d`: UI/helpers/hook sin cambios; único delta de
  producción es import/assertion de tipo MassUnit en core, borrado en runtime.
  Otros deltas son pruebas/fixtures/documentación. Evidencia compatible reutilizada.
- WT/rama QA `/private/tmp/checkpass-pos-0242/pos-qa-0242`, `pos-qa-0242`.
  Node24.20.0, pnpm11.4.0, dependencias propias y lockfile intacto. Único archivo
  editado en repo por QA: este informe. Sin DB/env privado/wrapper operado por QA.
- Contrato0242 §1–2, ficha completa, COPY, protocolos y diff pertinentes leídos.
  Impeccable existente Operate/refinamiento: harden/craft-floor leídos, sin rerun
  context/init/drift ni cambios visuales ajenos.

## Aceptación observada

Headers V2 en GET/POST/PUT/DELETE producto; expectedSalesRevision string conserva
la revisión abierta hasta revisión explícita. Tarifas string/null sin autoridad
Number/parseFloat/toFixed: nueve decimales, cero, vacío y legado alto intacto.
Formato BigInt/fracción original conserva precisión significativa. Nuevo producto
unit, unidades habilitadas y etiquetas por medida; alternar selector no convierte
la tarifa. Categorías, locales, disponibilidad, imagen/importación y tours conservan
su cableado; no se modificaron helpers financieros, writers, guards ni esquema.

Conflicto conserva borrador e imagen, adopta campos intactos tras acción explícita
y muestra solapamientos/estado remoto con nombres legibles. Medida y tarifas son
un bloque cuando cambia la medida; disponibilidad/locales también se conservan
juntos. No desaparece una edición para convertirse en alta. Errores409/422 no
reintentan. Red/5xx mantiene bloqueo global aunque se descarte el alta; solo una
lectura autoritativa satisfactoria libera nuevas escrituras. Doble submit usa ref
síncrona. GET fallido después de escritura confirmada se reintenta sin repetirla;
401/403 retira datos/editor y no anuncia éxito.

Proyección salesMassUnits V2 usa business_configuration del tenant bajo guard
catalog, default kg solo sin configuración, sin insertar fila ni pedir permiso
business; V1 conserva shape. Writer revalida bajo locks previos. Barreras temporales
mass/precisión permanecen activas.

## Evidencia reproducible

Autor: `/private/tmp/checkpass-pos-0242/catalog-ui-0242-evidence/`.
QA: `/private/tmp/checkpass-pos-0242/catalog-ui-qa-evidence/`.
Logs autor contienen SHA/comando/UTC/exit; identidad/comandos QA constan en
`identity-a17e2d63.txt`, configuración y spec externos junto a logs.

| Señal | SHA / resultado observado |
| --- | --- |
| QA puros: `pnpm exec vitest run apps/merchant/src/app/backoffice/catalog/catalog-product-draft.test.ts` | `a17e2d63`, `pure-a17e2d63.log`: **5PASS/0SKIP, EXIT0**. Inicial7ef:4PASS antes del nuevo caso cruzado. |
| QA conflicto cruzado, grupos locales y nombres remotos | `a17e2d63`, `browser-a17e2d63.log`: caso2 **PASS**; mantiene unit/precio0.123456789/localCentro, adopta categoríaPostres intacta, muestra Norte/gramo, PUT revisión8. Corrida completa EXIT1 por setup del caso1, abajo. |
| QA corte de conexión POST | `a17e2d63`, `abort-a17e2d63.log`: **1PASS/0SKIP, EXIT0**; route.abort(connectionreset),1POST; descarte y GET503 mantienen bloqueo; GET200 muestra alta autoritativa y recupera. |
| QA revocación en revisión autoritativa | `a17e2d63`, `auth-a17e2d63.log`: **1PASS/0SKIP, EXIT0**; PUT503→GET401 elimina catálogo/editor, sin éxito ni otro PUT. |
| Autor CI HTTP real | `cac3d766`, `http-cac3.log`: **10PASS/0SKIP, EXIT0**; metadata/default/sin inserción/staff catalog/tenant/auth/V1 y barreras reales mass/precisión. Wrapper exclusivo `--no-file-parallelism`, teardown completo. No prueba mass exitoso. |
| Autor browser compatible | `cac3d766`, `browser-cac3.log`: **13PASS/3FAIL, EXIT1**. Se reutilizan trece casos intactos, no una batería verde. |
| Autor browser afectados/regresiones | `5c31ea38`, `browser-5c31.log`: **6PASS/0SKIP, EXIT0**; exactitud/unidades, incertidumbrePOST, categoría/locales/imagen, recuperación tour y borrados producto/categoría. Sin retries ni clic forzado. |
| Tipos/lint/formato/UI guard autor | Merchant/lint/formato/UI guard `cac3d766` EXIT0; domain/db inicial4254 EXIT0, domain repetidoecd8 EXIT0; lint deltas `affected-ecd8.log` y `tests-lint-5c31.log`, formato `format-final.log` EXIT0. UI guard8archivos sin aumentos. |
| Guardias autor | `guards-cac3.log`: módulos **24PASS/2FAIL** backlog; más38PASS catálogo, total62PASS/2FAIL EXIT1. expenses→stock y cinco archivos core ya conocidos; sin nuevos offenders ni guardias editadas. |
| QA diff/procesos | `git diff --check 132e1c7e..52c5270d` EXIT0. `processes-52c5270d.log`:0runners propios persistentes, EXIT0. Autor `processes-final.log`:0. |

CI del autor usa entorno seleccionado por coordinador, sin secretos copiados.
Aviso consumer role sin configurar: ese rol no se certifica. Rutas Next con
Request/guards/DB reales; browser es harness de UI/Driver/CSS reales y API simulada,
no smoke autenticado de aplicación desplegada.

Capturas390/1280 generadas juntas por browser5c31 y abiertas por QA. Campos nuevos,
unidad gramo, tarifa9dec y cero legibles, apilado390 sin desborde horizontal visible.
Modal conserva scroll; captura inicial no muestra botones inferiores, no se afirma
inspección visual de esa zona. Sin edición ni ronda visual extra. Archivos externos:

- `catalog-editor-390.png`, SHA256 `55f28b53539cd97a512f600403cf4c74f5542011070885cb0c142c5a32d2b090`.
- `catalog-editor-1280.png`, SHA256 `1489f91bb2ea848727f491ea9ef54d89c573b0fc4c7e32d6210a6dac759782cf`.

## Hallazgos corregidos y límites

QA inicial identificó alta incierta descartable sin lectura previa, reinterpretación
de tarifa local al adoptar medida remota, datos remotos con UUID/booleanos y ruta
fija de Recetas en core. Corregidos en cac3; señales independientes verifican las
dos invariantes de escritura y legibilidad. La referencia visible a Recetas usa
copy, sin ruta fija de módulo.

Fallos originales preservados: HTTP4254 nuevePASS/unFAIL al exigir no-store V1 en
helper nuevo (corregido sin alterar contratoV1). Browser4254 EXIT130 por harness sin
BackofficeProvider; diagnóstico no cuenta como PASS producto. Cac3 tres fallos por
guía abierta interceptando altas y selector de error ambiguo; ecd8 un fallo/dos
no ejecutados por target oculto CheckboxField. Correcciones finales usan botón real
cerrar guía, label visible con aserción checked y toast específico. Tour edición
sale explícitamente con Escape conservando borrador para revisar resultado incierto;
se verifica guardado/id/lista y un tour nuevo confirma éxito. No se certifica
continuidad del tour cancelado.

QA browser inicial bloqueado por sandbox Chromium MachPort1100 antes del caso;
escalación acotada propia permitió ejecutar. CasoQA1 inicial falló antes del POST
por guía abierta; se cerró mediante botón real y solo ese caso se repitió. Sin
ocultar fallos, retries ni skips tratados como PASS. ps ordinario EPERM se comunicó
y resolvió con lectura escalada propia. No hubo producto/tests editados por QA.

No existe corrida browser completa final verde: aceptación por evidencia compuesta
compatible y señales independientes. Sin fullverify/build/M0/túnel/3201/push/PROD.
Pendientes CP2c: activación y recorrido auténtico mass/precisión al retirar barreras;
no se afirma guardado real mass ni se desactiva constraint/producer4. Informe listo
para aceptación/integración local por coordinador.
