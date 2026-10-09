# Estado de GPT

> Lo escribe **solo GPT** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno: lo vigente arriba,
> reescrito entero al cerrar cada sesion. El estado de Claude esta en `claude.md`.

## ⇥ ESTADO (2026-10-08) — SPEC 0179: NAVBAR POS

Owner confirmó POS / Nueva orden destacada / Mostrador. UI local en dev: tres
columnas, Nueva orden central usa Button del kit e icono Plus con la clase
mobile-counter-access existente, mismos tokens/paleta del backoffice. Evento local
compartido abre editor desde listado autorizado sin escrituras ni refresh; botón
superior permanece solo en escritorio. Navbar sigue oculta dentro del pedido.
Sin kit, API, servidor, CSS, dependencias, merge ni push. Spec 0179 reservada en
3da4356; implementación en el commit ui: destacar Nueva orden en navbar mobile POS.

Typecheck 6 paquetes, ESLint UI/fixtures, guardia 3 archivos sin aumentos, formato,
números y diff-check verdes. Fixture POS ahora selecciona segmento pos; demás
fixtures conservan loyalty. Sin suites adicionales por preferencia del owner.
QA visual owner con pnpm dev:local pendiente; no marcar implementada aún.
Cambios ajenos gotchas/LECCIONES preservados, staging vacío al entregar.

## ⇥ ESTADO (2026-10-08) — SPEC 0178: ENTREGA A CLAUDE

UI POS commiteada en **eb5a950**, spec reservada en **92c5913**. Nueva orden y
orden abierta comparten Pedido/Productos, catálogo reutilizado de Mostrador,
líneas editables, contexto compacto, guardado explícito y salida protegida.
Footer contextual y Más acciones para imprimir/anular; conflictos preservan
borrador hasta revisión. Cache sin TTL/polling/autosave; API/servidor/kit intactos.
[Handoff](../handoff-0178-pos-workspace-2026-10-08.md).

Owner probó: «listo. parece estar todo funcionando», y pidió no ejecutar más
pruebas, dejar preparado para live y que publique Claude. GPT no hizo merge ni
push, todo en dev. Verificaciones previas: 5 e2e seleccionados verdes (4,7 s),
typecheck 6 paquetes, lint de pantallas, guardia sin aumentos y formato aplicado.
Adaptaciones finales de otros e2e y ajustes de impresión/contexto sin rerun;
no se declara suite completa verde ni DoD íntegramente cumplido. Claude conserva
los gates normales de publicación. Próximas mejoras visuales quedan para después.
Staging vacío al entregar; cambios ajenos gotchas/LECCIONES preservados.

## ⇥ ESTADO (2026-10-08) — INVESTIGACIÓN UX POS MOBILE

Owner pidió investigación con agente porque orden abierta y nueva orden siguen
con UX pobre. Agente pos_mobile_ux ejecutado explícitamente autorizado: auditó
editor/carrito/flujo y fuentes oficiales; sin modificaciones ni órdenes reales.
GPT revisó código, capturas y documentación Square, Shopify, Toast y Apple.
Informe en [investigación UX](../design-explorations/2026-10-08-pos-mobile-ux.md).

Recomendación para revisar, sin spec nueva cerrada: workspace común Pedido/Productos
para nueva/existente; mesa/local compactos, eliminar modo Editar como paso obligatorio,
review de carrito con un scroll, estado guardado/dirty, X protegida, acciones contextuales.
Guardar explícito conservado; no auto-save/polling/TTL, no cambios de API ni tablas
inventadas. Impresión/anulación según frecuencia real, nunca perder snapshots/precios.
Captura catálogo 390×844: primer producto≈551, footer≈727, ~176px útiles; evidencia
heurística, no prueba con operadores ni teclado real. Propuesta tiene escenarios
para comparar tiempos/toques/errores con 3–5 operadores y dispositivos reales.

Solo docs, formato y diff-check verdes; código del producto intacto. Dev, sin
merge/push. Siguiente paso propuesto: maqueta navegable de los dos flujos y definir
salida/guardado/cobro antes de spec funcional. No marcar propuesta implementada.
Cambios ajenos gotchas/LECCIONES preservados; staging vacío al entregar.

## ⇥ ESTADO (2026-10-08) — SPEC 0177: JERARQUÍA DE ORDEN ABIERTA

Spec cerrada y reservada en 2e982c5. Orden abierta muestra mesa como título,
Orden abierta/local como contexto. PosTicket compact opcional oculta encabezados
repetidos solo en pantalla; impresión conserva comercio, local y mesa. Checkout
conserva ticket completo. Footer existente de Mostrador, móvil fijo con espacio
reservado; desde md estático: Editar secundaria y Cobrar primaria de ancho igual,
48 px mínimo; Imprimir/Anular discretas, Anular danger. X/caché/escrituras sin
cambios. Kit/Tailwind/tokens; sin CSS, API, servidor, tooling ni dependencias.

33 pruebas POS verdes (14,3 s), incluidos flujo de cobro/conflicto, caché,
jerarquía, espacio del footer, sin overflow y ticket impreso completo.
Capturas vistas /private/tmp/pos-0177-mobile.png y pos-0177-desktop.png.
Typecheck 6 paquetes, ESLint, Prettier, guardia UI sin aumentos (22 archivos),
números y diff-check verdes. Sin build/global verify (L1, dev activo).
Owner debe probar pnpm dev:local antes de main. Solo rama dev, sin merge/push;
staging vacío al entregar, cambios ajenos en gotchas y LECCIONES preservados.

## ⇥ AJUSTE VIGENTE (2026-10-08) — CABECERA Y X DEL POS

Owner pidió retirar Volver al historial de abiertas, quitar el bloque blanco de
cabecera y X con aspecto de Marca pero círculo simétrico. Spec 0176 ampliada y
cerrada antes del código (4ad8ea9). Se retiró module-topline del header POS,
que activaba fondo canvas en counter-flow móvil. X usa tokens, círculo 44×44,
icono 24 px y padding cero; solo X devuelve al listado en abiertas. Cerradas
mantienen retorno inferior. Sin cambios en Marca ni kit/CSS/API.
32 pruebas POS pasan (14,8 s), incluidos tamaño real, cabecera transparente,
retorno y ausencia del botón. Captura móvil vista. Typecheck 6 paquetes, lint,
formato, guardia UI sin aumentos y diff-check verdes. Rama dev, sin merge/push;
QA owner con pnpm dev:local pendiente. Archivos ajenos preservados.

## ⇥ ESTADO (2026-10-08) — SPECS 0174–0176: UI POS

0174 en **268b951**: se retiró Actualizar órdenes; X del listado vuelve a
/backoffice con Link del kit. Owner probó y confirmó. Sin refresh automático;
recarga/salir y volver monta caché nueva. Tests adaptados a recarga y validación
previa a anular. Retirados dos escenarios browser de GET tardío contra escritura
que dependían del flujo manual eliminado y uno de identidad durante refresh;
pruebas directas de generaciones, versiones y aislamiento permanecen.

0175 en **c3b1d03**: abiertas en filas compactas con mesa, total, Abrir; nombre
accesible individual, nombres largos permiten salto. Cerradas hoy conserva tarjetas.
Owner probó y confirmó. 31 pruebas POS verdes (14,0 s).

0176 en **9c9e550**, ajuste de padding/tamaño de la X en el commit siguiente:
orden abierta usa counter-shell/counter-flow con ancho disponible completo y
sin Card exterior. Sin navbar mobile, como Venta detallada. Sidebar escritorio
conservado como Mostrador. X de detalle/edición vuelve al listado con back y caché;
X de listado sale al inicio. Checkout/órdenes cerradas mantienen presentación.
No se tocó kit, CSS, API, servidor, tooling ni contratos. Componentes/Tailwind/tokens
existentes. 32 pruebas POS verdes (14,5 s); prueba puntual final 1/1 (2,0 s).
Aserciones: padding/borde cero, fondo transparente, ancho móvil 390 px, navbar oculta,
retorno sin GET extra, edición/listado correctos e icono X con ancho real 24 px.
Capturas móvil/escritorio vistas en /private/tmp/pos-0176-*.png y pos-0175-*.png.
Typecheck 6 paquetes, ESLint, Prettier, guardia UI 22 archivos sin aumentos,
números y diff-check verdes. Sin build/full verify sobre dev activo.

Pendiente QA owner de 0176 con pnpm dev:local antes de main. Todo en dev,
sin merge ni push. Archivos ajenos .claude/skills/gotchas-del-repo/SKILL.md y
LECCIONES.md preservados. Los avisos entre operadores siguen para el futuro.

## ⇥ ESTADO (2026-10-08) — SPEC 0173: NAVBAR MOBILE POS

Owner confirmó que la caché funciona perfectamente; incidente cache.peek ya no
se reproduce según su prueba. Configuración Cloudflare del handoff anterior
sigue siendo una recomendación pendiente de aplicar, sin acceso de GPT.

[0173](../specs/0173-navbar-mobile-pos.md), L1, reservada localmente en ecb19c8.
En POS la barra mobile usa NavLink existentes: POS y Mostrador en columnas iguales,
con permisos pos/counter respectivamente. POS activo. Otras vistas y escritorio
conservan navegación. Sin cambios de kit, CSS, servidor, API ni caché.
Actualizar órdenes se explicó al owner: sincronización explícita de historial,
validación de sesión e invalidación de recursos; sin polling para cambios ajenos.

Next real local con sesión ficticia de semilla y lecturas simuladas: mobile 390 px,
dos enlaces y destinos correctos, aria-current, columnas 189/189; desktop 1100 px
sidebar visible/barra oculta. Capturas vistas. Nueva orden y catálogo visibles,
cero pageErrors. Script /private/tmp/checkpoint-pos-0173-live.cjs.
Typecheck 6 paquetes, ESLint, formato, guardia UI sin aumentos (22 archivos),
números y diff-check verdes con Node 24.20.0. Sin suite nueva ni build (L1).
Pendiente owner probar con pnpm dev:local antes de pasar a main. Solo dev, sin
merge ni push. Archivos ajenos .claude/skills/gotchas-del-repo/SKILL.md y
LECCIONES preservados fuera del staging.

## ⇥ ESTADO (2026-10-08) — SPEC 0172: CACHÉ POS IMPLEMENTADA LOCALMENTE

Owner autorizó implementar la spec cerrada y dejó avisos entre operadores para después.
[0172](../specs/0172-cache-en-memoria-del-pos.md) reservada en 69191fc; implementación y
handoff en **8a422c3**, solo paths de GPT. Rama dev, sin merge ni push. API/servidor/kit/CSS,
migraciones, dependencias y tooling intactos; cambios ajenos preservados.

PosCache privado por montaje e identidad user/business, sin TTL, intervalos, listeners de
foco/visibilidad o persistencia. Reabrir/editar reutiliza detalle y catálogo por local.
Crear/guardar publica respuesta real y parchea historial sin GET extra. Cerrar/anular relee
historial una vez para Cerradas hoy; anular lee detalle antes de confirmar. Actualizar órdenes
sincroniza explícitamente e invalida; conserva borradores durante edición, los destruye al
cambiar identidad/perder autorización. Cambios de otros operadores: actualización explícita
o conflicto, no sondeo. Cupón mantiene su polling del cobro activo, fuera de esta spec.

Se deduplican GET y descartan generaciones/respuestas viejas. Cache no sobreescribe snapshots,
versiones nuevas, otra mesa seleccionada ni UUID/cuerpo de cierre. 401/403 limpian, 404 retira
mesa, lectura 5xx/transportes conserva copia con error. Conflicto sin snapshot bloquea acciones
hasta releer; fallo vuelve a historial sin permitir continuar con borrador obsoleto.

Node 24.20.0: **37 pruebas afectadas pasan en 24,7 s** (32 POS, incluidas 2 pruebas directas
sin navegador, + 5 Mostrador). Typecheck, ESLint, formato, guardia (22 archivos sin aumentos),
números y diff-check verdes. Capturas móvil 390 px/escritorio 1100 px vistas. Aserciones:
cero GET adicionales al crear/editar/volver/abrir o avanzar 1 h/foco; primera apertura un GET,
segunda cero; catálogo Centro/Norte una vez cada uno; actualización manual/cierre/anulación
leen solo lo definido. Tests retienen GET y comprueban carreras contra guardar/conflicto,
cambio de contexto y autorización. Log /private/tmp/pos-0172-e2e-final.log.

[Handoff y tabla](../handoff-0172-cache-pos-2026-10-08.md). **Owner debe probar con
pnpm dev:local** antes de pasar a main: recorrido de mesa e interacción de dos operadores.
Spec sigue cerrada por QA/entrega pendientes. No build/full verify sobre dev activo (L2);
verify global antes de main. ci:status no consultó GitHub (fetch failed, informativo).
Avisos a cachés de otros operadores son trabajo futuro separado, sin nuevas consultas periódicas.

### Incidente local posterior: Nueva orden y cache undefined

Owner reportó TypeError cache.peek con mapa de fuente apuntando al diálogo en console:515.
Fuente actual sí pasa cache/catalogRevision; en .next/dev/static/chunks había tres variantes
PosConsole: dos antiguas sin props de caché y una actual. Eso encaja con mezcla de versiones
por HMR, no se reprodujo en código actual. Se detuvo dev:local, movió la caché merchant a
/private/tmp/checkpoint-merchant-next-dev-pos-cache-20261008 y se levantó nuevamente.
Petición local /backoffice/pos dio 307 (sin sesión, esperado); compiló una única variante de
PosConsole que pasa ambas props. Dos pruebas de crear/reabrir verdes (3,0 s), log
/private/tmp/pos-0172-restart-smoke.log. No cambios de código ni fallback de caché.
El owner hizo hard refresh y reportó el mismo error: el diagnóstico de caché local
no fue concluyente. Se comparó el mismo chunk en origen y túnel: Next devuelve
no-cache/must-revalidate, pero Cloudflare impone max-age=14400/must-revalidate
(CF-Cache-Status EXPIRED). Después de esa lectura ambos cuerpos coincidieron.
Prueba con Next real y sesión de semilla local, primero origen y después túnel:
Nueva orden y catálogo visibles, cero pageErrors en ambos. Se simularon únicamente
habilitación POS y lecturas; no se crearon órdenes. Script temporal
/private/tmp/checkpoint-pos-next-live.cjs. La pestaña concreta del owner no se inspeccionó.
[Handoff de configuración](../handoff-2026-10-08-cache-cloudflare-dev.md): bypass edge
y respetar headers de origen para los dos hosts dev, sin alterar producción.
Aplicación en Cloudflare pendiente; GPT no tiene conector a esa cuenta.
Owner posteriormente confirmó que la caché funciona perfectamente. Sin cambios
de fuente para este incidente.
Mensaje chrome-extension sobre recordConsoleEvents.js corresponde a una extensión.

## ⇥ ESTADO (2026-10-08) — SPEC 0171: POS REUTILIZA MOSTRADOR

Owner pidió misma interfaz para añadir productos y confirmó ranking por más vendidos del local.
Reserva local `f640dc9`; implementación `8e19a38`; rama dev, sin merge ni push. POS importa DetailedSale existente de
Mostrador: carrusel horizontal, búsqueda y cantidades en tarjetas; no copia markup ni CSS.
Shell usa ancho/padding existentes, con min-w-0 para impedir desbordamiento del carrusel.
Resumen expandible mantiene snapshots por lineId, incluso precios duplicados/productos borrados.
Shared DetailedSale recibe disabled y productOrder opcionales; Mostrador conserva defaults.
No cambios de API, kit, CSS o tooling; cambios ajenos de Claude conservados.

Actualización de contrato confirmada por owner: commit local **2810d33** hace obligatorio
bestSellingProductIds en PosCatalog y actualiza mocks. POS conserva orden recibido, seguido
por productos sin ranking alfabéticos; [] conserva catálogo alfabético. Mostrador mantiene
productOrder opcional/default, sin cambios. Sin cálculo de ventas ni fechas en cliente.

16 e2e afectados verdes (11 POS + 5 Mostrador, 18,7 s), incluidos ranking parcial/vacío y
producto sin ventas visible y añadible. Typecheck, lint, formato, ui-guard sin aumentos y
números verdes con Node 24.20.0. Capturas vistas en entrega anterior. L2 sin mutaciones
nuevas ni build sobre dev activo. Pendientes QA owner con pnpm dev:local e independiente;
0171 permanece cerrada. Gate global anterior de 0170 sigue documentado abajo.

Contrato 0169: unidades de mesas POS cerradas con/sin pase, últimos 30 días por cierre;
local seleccionado o negocio entero sin locationId; excluye abiertas/anuladas y ventas
Mostrador. Claude entrega servidor y sus pruebas por separado. GPT no tocó ni commiteó
archivos de Claude. ci:status no pudo consultar GitHub (fetch failed, informativo).

Settings/hydration anterior: se encontró mezcla de chunks viejos/nuevos en .next/dev; se
reinició pnpm dev:local con caché merchant renovada, sin cambio fuente. Owner confirmó que
pudo probar. Próximo paso: probar esta corrección con pnpm dev:local antes de pasar a main.

## ⇥ ESTADO (2026-10-08) — SPEC 0170: PANTALLAS POS LOCALES EN DEV

El owner pidió ejecutar `docs/encargo-gpt-2026-10-08-pos.md` contra la API 0169, exclusivamente
sobre `dev`, sin merge ni push. Spec 0170 reservada en `4f533dc`; implementación y evidencia
commiteadas localmente en **`448e285`**. Rama sigue `dev`; no se tocó servidor, API, kit,
paquetes, migraciones ni tooling del repo. Se conservaron los cambios previos de Claude,
LECCIONES y ambos next-env.d.ts.

Cuenta → Configuración permite activar/desactivar POS (owner), con modal del número de mesas
abiertas. POS aparece en Mi negocio/Administración con módulo y permiso; Equipo condiciona el
toggle. `/backoffice/pos` ofrece Abiertas/Cerradas hoy, local activo, mesa, catálogo con precio
escrito si falta, snapshots/lineId al editar, conflicto de versión visible, detalle, precuenta,
anulación confirmada y cobro opcional con pase. Escáner del mostrador, endpoints solo POS,
sondeo/quitar cupón, calculadora no persistida y resultado/impresión desde sale del servidor.
Cierre con UUID/cuerpo congelados ante desconexión o 5xx. UI usa kit, Tailwind y tokens; guardia
sin aumentos. Producto fijo de cupón ausente pide editar la orden, sin alterar una mesa guardada
silenciosamente. Sin canje de premios.

Verificación con Node 24.20.0: siete e2e POS verdes (4.4 s), dos mutaciones rojas por las
aserciones correctas y restauradas con bytes idénticos; captura móvil a 390 px vista, sin
horizontal overflow; impresión por media print y window.print verificada. Typecheck, lint,
formato, números, unitarios (2395 pasan/1025 omitidos), build Turbopack y Neon relacionado
(10/10 con runner aislado) verdes. `pnpm ci:status` no pudo consultar GitHub.

**Gate global e2e pendiente:** `pnpm verify --base 4f533dc` corrió una vez: e2e no arrancó por
Next dev existente en 3200. La repetición de e2e con proxies temporales hacia los servidores
locales, sin apagarlos ni modificar tooling, dio **172 pasan, 21 omitidos, 14 fallan**; POS 7/7.
Diez fallos son strict-mode por dos botones Ayuda en los tours de Fidelización (ambos existen en
la base). Cuatro son onboarding/entrada que no encuentran la pantalla esperada en ese ambiente;
no se aseguró su causa ni se modificaron esas pantallas o tests. No hay PASS global ni revisión
independiente: la spec permanece **cerrada**.

[Handoff y tabla](../handoff-0170-pos-2026-10-08.md). **Siguiente paso: owner prueba en local con
`pnpm dev:local`**, activación, editar/imprimir/anular, cobrar sin pase y con pase/cupón reales,
resultado y movimiento en Mostrador. Pendientes cámara/impresora físicas, QA e independiente,
y resolver/aislar los fallos globales antes de pasar a main. El paso a main y push es de Claude
solo con OK del owner. No usar DATABASE_URL de PROD para tests.

## ⇥ TRABAJO ANTERIOR (2026-10-05) — SPEC 0163: LA RAÍZ MERCHANT ABRE EL ALTA SIN SESIÓN

El owner reportó que `business.checkpass.club/` mostraba la portada vieja. Reservé y publiqué la
[spec 0163](../specs/0163-raiz-del-merchant-abre-onboarding.md) (`1889b6d`); el cambio UI `bc8f3fd`
se publicó en `main` con el estado `37776ae`. La raíz consulta la cookie de sesión de
Better Auth: sin ella redirige en servidor a `/es/business/onboarding`; con ella valida la sesión
y conserva la portada para los rebotes del guard, evitando un ciclo con `/backoffice`.

Prueba e2e de navegador sin sesión: URL exacta del onboarding y título «Encuentra tu negocio».
Una mutación del destino a `/backoffice` produjo el rojo esperado en `toHaveURL` y se restauró
con hash idéntico. La primera corrida global falló por formato y una intermitencia en ese e2e;
tras el ajuste de cookie y formato, `pnpm verify` con Node 24.20.0 pasó: typecheck, lint,
format:check, unitarios, build, e2e (179 pasan, 21 omitidos) y Neon related merchant (sin tests
relacionados). El hook de push repitió `pnpm verify` en verde. En producción,
`curl -sSI https://business.checkpass.club/` respondió HTTP 307 con
`Location: /es/business/onboarding` sin sesión. La spec sigue `cerrada` hasta PASS independiente;
el caso de sesión activa se conservó por inspección del código, sin prueba automatizada nueva.
[Handoff para el revisor](../handoff-0163-entrada-merchant-2026-10-05.md), con commits, oráculos
y límites. `pnpm ci:status` no pudo consultar GitHub al redactarlo (`fetch failed`); el hook
local de push y la sonda HTTP de producción sí quedaron verificados.

## ⇥ TRABAJO ANTERIOR (2026-10-05) — SPEC 0157 REBASADA SOBRE ONBOARDING-GOOGLE; PUSH BLOQUEADO POR TURBOPACK

El owner entregó `onboarding-google` `1953afe` con las specs 0155 y 0156 y PASS del revisor. Rebasé los commits locales de la [spec UI 0157](../specs/0157-pantallas-de-alta-con-google-places.md) sobre esa rama; `docs/INDEX.md` conserva el ADR 0122, la fila 0156 implementada y la 0157. La UI y la spec están completas en `e659b86` y `60777dc`. **No hubo push:** el owner pidió uno solo con servidor y UI, y el hook exige `pnpm verify` verde salvo autorización expresa.

La UI tiene wizard negocio → email → confirmación con P1/P2/P3/P4, sesión UUID por búsqueda, login existente, 201/200/422 y reenvío de verificación. Locales envía `address.selectionToken` o solo texto; se retiraron los componentes y el CSS de Geoapify, el programa y el QR del wizard. `rg` de rutas antiguas y Geoapify en `app`/`lib`: vacío. Las dos mutaciones de la spec se pusieron rojas por la aserción esperada y se restauraron con SHA idéntico.

Con Node 24.20.0, `pnpm verify` pasó typecheck, lint, formato, unitarios, e2e global (117 pasaron, 5 omitidos) y Neon completo (3043 pasaron, 277 omitidos). La migración 0065 se aplicó a la rama Neon CI. El único gate **ROJO** es build Turbopack (`driver.css`, `Operation not permitted` al abrir un puerto), repetido fuera del sandbox. El build Webpack de Merchant pasó.

**Para publicar en un solo push:** se necesita resolver el fallo de Turbopack o autorización expresa del owner para la excepción del hook. Faltan QA real del alta y locales, PASS independiente de UI y deploy; 0157 sigue `cerrada`.

## ⇥ TRABAJO ANTERIOR (2026-10-04) — SPECS 0152 Y 0154 PUBLICADAS; QA PENDIENTE

El owner entregó `motor` `8a635b0` con el servidor 0153. Rebasé `main` sobre
esa rama y resolví el conflicto de `docs/INDEX.md` conservando las specs 0152,
0153 y 0154. La [spec UI 0154](../specs/0154-veredicto-automatico-del-cupon-en-mostrador.md)
está implementada en el commit `eaa03b3`: veredicto verde/rojo literal en Venta detallada y
rápida, sin M2; «Quitar» siempre; M4 manda cupón solo si es válido; producto fijo
agregado una vez por escaneo; y ticket con unidades del cupón separadas. La 0152
y el servidor 0153 se publicaron junto con la UI en `origin/main` `1927742`.

Verificación con Node 24.20.0: typecheck, lint, formato, unitarios, e2e
global (115 pasaron, 5 omitidos), Neon merchant (410 pasaron, 25 omitidos) y
Neon consumer (60 pasaron) en verde. Las 4 pruebas de navegador de la 0154
pasaron y revisé las capturas móviles verde y roja. `pnpm verify` quedó
**ROJO solo en build**: Turbopack falla al abrir un puerto interno al procesar
`business/onboarding/onboarding.css` (`Operation not permitted`), incluso fuera
del sandbox. El build Webpack de Merchant se comprobó aparte.

El owner autorizó explícitamente `--no-verify` para el único push conjunto por
el fallo de Turbopack. Confirmó que el deploy de Vercel de `1927742` ya terminó.
Faltan su QA con pase/cupón reales y PASS independiente de la UI; no se marca
`implementada` mientras el gate completo siga rojo.
[Handoff para retomar después del clear](../handoff-0154-mostrador-cupon-2026-10-04.md).

## ⇥ TRABAJO ANTERIOR (2026-10-04) — SPEC 0152: MOSTRADOR MÓVIL

La [spec 0152](../specs/0152-mostrador-mobile-sin-nav-y-sin-tarjeta.md) quedó
reservada y publicada en `1ea1e5e`; la UI quedó en `d30136f` tras el rebase.
Las etapas activas de Mostrador ocultan la navegación inferior; la X vuelve a la
pantalla inicial y sigue visible al desplazarse; el aviso no la tapa; en móvil
se elimina la tarjeta blanca interior y el footer detallado deja visibles
«Cancelar» y «Acreditar compra». Escritorio conserva la tarjeta.

Verificación con Node 24.20.0: prueba de navegador a 390 px 1/1, captura vista,
typecheck, lint, formato y tests unitarios verdes; e2e global 111 pasaron y 5
omitidos; Neon relacionado de Merchant 9/9; build Webpack de Merchant verde.
`pnpm verify` quedó **ROJO solo en build**: Turbopack falla al abrir un puerto
interno de PostCSS en `business/onboarding/onboarding.css` (`Operation not
permitted`), incluso fuera del sandbox. No se usó `--no-verify`. El owner pidió
dejar la UI local en ese momento. La autorización posterior incluyó la 0152 en
el push `1927742`, con deploy confirmado por el owner. Pendientes: resolver el build,
hacer QA móvil y obtener PASS independiente
antes de marcar la spec `implementada`.

## ⇥ TRABAJO ANTERIOR (2026-10-04) — SPEC 0149: PANTALLAS DEL CUPÓN ELEGIDO PUBLICADAS

La [spec 0149](../specs/0149-pantallas-de-cupon-elegido.md) quedó cerrada en
`b4f7f43` y su UI se publicó en `main` con `3006a2f` (código `9837a5a`),
sobre los commits de Claude de la 0148. La PWA usa P0–P2 con «Acá», coordenadas si ya existe
permiso, grupos por comercio y selección visible. El mostrador muestra M0,
sondea M1 cada 4 s, valida M2, quita M3 y envía M4 con ticket de bruto,
descuento y neto. El historial distingue los cupones y las unidades extra.
`stages.tsx` quedó en 289 líneas.

Verificación local con Node 24.20.0: typecheck, lint, formato, tests unitarios
(incluidos 34 de la consola), e2e y Neon completo pasaron (2968 tests, 277
omitidos). `pnpm verify` quedó **ROJO solo en build**: Turbopack de Merchant
falla al abrir un puerto interno de PostCSS (`driver.css`, `Operation not
permitted`) tanto dentro como fuera del sandbox y aun aislado. Los builds
Webpack de Merchant y Consumer pasaron. El gate reportó: typecheck ok,
lint ok, format:check ok, test ok, build ROJO, test:e2e ok, neon full ok.
`pnpm ci:status` reporta verde para el remoto `24ce0df`, que incluye la 0149.
**Pendiente:** QA del owner según la 0148 §«QA del owner» y PASS independiente
antes de marcar la spec como implementada. La 0150 (login temporal de QA) ya
está en producción y la 0151 está tomada por Claude; la próxima spec libre es
la 0152. Los botones de QA en onboarding deben aparecer solo cuando
`GET /api/merchant/auth/qa-login` responda 200.

## ⇥ TRABAJO ANTERIOR (2026-10-03) — SPEC 0145: VENTA CRUZADA EN MARKETING

La [spec 0145](../specs/0145-venta-cruzada-por-compra-en-marketing.md) quedó
reservada en `92a464c` y publicada en `main` desde `e61e3d5` (handoff
`dfa1646`). El cambio de UI exige `endsAt` al activar una
cruzada y actualiza editor, resumen, detalle y confirmaciones para la entrega
automática del cupón de la 0143. La prueba `cross-ui.test.ts` pasó 4/4; su
mutación M1 falló en la aserción esperada y se restauró. `pnpm verify` con Node
24.20.0 pasó typecheck, lint, formato, tests, e2e y Neon relacionado de
Marketing; el build Turbopack quedó rojo por `Operation not permitted` al abrir
un puerto interno del procesador CSS, incluso fuera del sandbox. El build
Webpack de Merchant pasó. [Tabla y evidencia](../handoff-0145-venta-cruzada-marketing-2026-10-03.md).
El owner autorizó el push excepcional y se publicó con `--no-verify`; el árbol
quedó limpio tras el push. La consulta posterior de CI falló por conexión a
GitHub, así que no se afirmó verde para ese SHA. La spec sigue `cerrada` hasta
resolver el gate de Turbopack y obtener PASS independiente.

**Al retomar:** el `main` local avanzó después con cuatro commits de Claude
de la [spec 0148](../specs/0148-cupon-elegido-y-atado-a-la-venta.md),
hasta `6cc8f47`, todavía sin push (`origin/main` en `afa6e77`). Según el
[estado de Claude](claude.md), la migración 0064 ya está en PROD y el owner
decidió que el próximo push de GPT arrastre también esos commits. La UI del
contrato 0148 está pendiente; este handoff no la implementa. Al iniciar:
`nvm use`, `git pull --ff-only`, `pnpm ci:status` y revisar el estado del árbol.

## ⇥ TRABAJO ANTERIOR (2026-10-03) — SPEC 0142: ICONO DE LA PWA EN WEB PUSH

La [spec 0142](../specs/0142-icono-de-la-pwa-en-web-push.md) quedó reservada
en `6488227` y el cambio de `sw.js` está publicado en `main` desde `0e055a6`.
El Web Push usa ahora `/checkpass-icon-192-v2.png`, el mismo PNG de 192 px del
manifest. El badge monocromo de Android y el comportamiento del click siguen igual.
`pnpm verify` con Node 24.20.0 pasó completo, incluidos 110 e2e (5 omitidos), y
el hook ejecutable repitió el gate en verde. [Handoff y tabla](../handoff-0142-icono-web-push-2026-10-03.md).

Wallet: el `icon.png` del pase Apple se genera en paquetes desde
`wallet-logo-trama-v1.png`; Claude debe revisarlo si se desea usar el icono v2 de
la PWA en los avisos de Apple. Google controla la presentación de sus avisos y
su `programLogo` es global para los pases; no se cambió el diseño aprobado.
Pendientes: QA visual de un push real, decisión sobre el logo global de Google y
PASS independiente antes de marcar la spec `implementada`.

## ⇥ TRABAJO ANTERIOR (2026-10-02) — SPEC 0140: AVISOS DE MOSTRADOR EN ACTIVIDAD

La [spec 0140](../specs/0140-avisos-de-mostrador-en-actividad.md) quedó
reservada en `daf9bac`. El cableado UI está publicado en `main` desde `0e76439`:
`wallet/page.tsx` lee `listConsumerNotices(account.id)` y pasa los avisos por
`WalletShell` a Actividad. La vista los mezcla por fecha con cupones y programas,
muestra comercio, texto y fecha, y abre «Mis programas» al tocarlos. Claude
agregó el mock del test de servidor en `0a66bc8`; GPT no tocó su zona.

`pnpm verify` con Node 24.20.0 terminó verde: typecheck, lint, formato, test,
build, e2e y Neon relacionado del consumidor. Tabla y límites en el
[handoff](../handoff-0140-avisos-de-mostrador-en-actividad-2026-10-02.md).
El hook local `.githooks/pre-push` quedó ejecutable y el push normal repitió el
gate en verde. Pendientes: QA manual con un cliente que haya sumado un sello y PASS
independiente antes de marcar la spec `implementada`.

## ⇥ TRABAJO ANTERIOR (2026-10-02) — SPEC 0137: UI PUBLICADA, GATE VERDE

El owner pidió tarjetas cuadradas para los archivos elegidos en «Importar con IA» del
catálogo, con miniatura y X para quitar cada foto. Confirmó que las nuevas fotos se
agregan a la selección y que el PDF conserva el análisis automático. La
[spec 0137](../specs/0137-vistas-previas-de-archivos-en-importacion-con-ia.md)
quedó cerrada en `489cdf1`; la UI está publicada en `main` desde `873ff6d`
y el gate verde está registrado en `9fbe3d8`.
Verificación: 7/7 e2e de importación con harness móvil, captura a 390 px vista,
2 mutaciones rojas y revertidas, build Webpack de merchant, typecheck, lint, formato,
tests unitarios y Neon related merchant verdes. `pnpm verify` pasó completo:
e2e global 110 passed / 5 skipped y build Turbopack consumer verde. El `EPERM`
anterior no se reprodujo en la última corrida; la prueba de bind local fuera del
sandbox también pasó. Falta PASS independiente. La UI admite `sourceFileName`
opcional, pero el API actual no lo devuelve: `catalog_import_file.original_name`
ya está persistido y Claude debe
exponerlo en el DTO de `GET /api/catalog/imports` y `GET /api/catalog/imports/{id}`.

## ⇥ TRABAJO ANTERIOR DEL OWNER (2026-10-02) — TRAMA VIVA EN EL PASE DE LA PWA

Después de `/clear`, leer el
[handoff Apple → pase PWA](../handoff-2026-10-02-wallet-apple-a-pase-pwa.md).
El owner quiere diseñar una versión de Trama viva para «Tu pase» dentro de
`my.checkpass.club`, con el QR en la tarjeta. La vista actual está en
`apps/consumer/src/app/(consumer)/wallet/qr-tab.tsx` y `apps/consumer/src/app/wallet.css`.
El owner aprobó la [maqueta Trama viva del pase PWA](../design-explorations/pwa-pase-trama-viva.html)
y aclaró que debe mostrarse un solo botón de Wallet según el SO, con su marca.
[Spec 0130](../specs/0130-pase-pwa-trama-viva.md) cerrada el 02/10/2026. Código local
aplicado; tests afectados 8/8, typecheck, lint y build Webpack del consumidor verdes.
Turbopack no pudo abrir un puerto interno en este entorno. Faltan QA en teléfono real,
escaneo de mostrador y PASS independiente antes de marcarla implementada.
[Handoff](../handoff-0130-pase-pwa-trama-viva-2026-10-02.md).

## ⇥ ESTADO (2026-10-02) — APPLE WALLET 0123: «IPHONE · STRIP VISIBLE» APROBADO; ARTE IMPLEMENTADO LOCALMENTE

El owner eligió la vista «iPhone · strip visible» de Trama viva. La spec 0123 está
cerrada. `0790956` está pusheado en `origin/main`. El constructor `.pkpass` incluye icono, logo y `strip` a 1x/2x/3x,
contacto público y revisión de marca nueva; preserva el QR y las referencias del
pase. Prueba Wallet, typecheck, lint y build pasan. **Live sin verificar:** faltan QA en
iPhone para confirmar que `strip` aparece en la versión objetivo, comprobar despliegue,
refresco de un pase existente con APNs, y PASS independiente antes de marcar
`implementada`. [Handoff](../handoff-0123-apple-wallet-trama-viva-2026-10-02.md) y
[guías de diseño](../wallet/apple-wallet-design-rules.md) y de
[actualización de pases viejos](../wallet/apple-wallet-update-existing-passes.md).

## ⇥ ESTADO (2026-10-01) — GOOGLE WALLET 0122: CLASE REAL TRAMA VIVA ACTUALIZADA Y APPROVED; PUBLICACIÓN GENERAL POR CONFIRMAR

Spec 0122 «Trama viva» aprobada por el owner. `f595842` está pusheado en `main`; ambos PNG
responden HTTP 200 desde `my.checkpass.club` y su SHA-256 coincide con el commit. La clase
`qa_trama_viva_0122` fue creada y Google devolvió `reviewStatus=approved`. El owner guardó
el pase QA en Android y aprobó el diseño: «perfecto, funcionó, quedó hermoso». Las
verificaciones de build, typecheck, lint, provisionador y regresión de Wallet pasan. La
clase real recibió `PATCH` autorizado y la lectura posterior confirmó logo/hero Trama viva,
emisor «CheckPass Club», plantilla y `reviewStatus=approved`. Siguiente secuencia:
verificación de pase viejo/nuevo y QR/enlace reales, confirmar acceso de publicación del
emisor en Console y PASS independiente. [Handoff](../handoff-0122-google-wallet-trama-viva-2026-10-01.md)
y [guía de diseño/publicación](../wallet/google-wallet-design-and-release.md).
