# Estado de GPT

> Lo escribe **solo GPT** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno: lo vigente arriba,
> reescrito entero al cerrar cada sesion. El estado de Claude esta en `claude.md`.

## ESTADO — PILOTO FACTORY IMPLEMENTADO, QA ACEPTADO; SIN PUBLICACIÓN (2026-10-13)

Hotfix Mesas durante QA owner: `0b9d467b` en main/dev locales, túnel activo desde main. Un agente añadió autoscroll del listado al crear para revelar la nueva fila; root revisó diff. POST201/duplicado409 y cinco mesas activas confirmados en logs/DB local. Causa scroll plausible, no confirmada por browser: owner cortó probes/pruebas y hace QA visual. Sin pruebas nuevas ejecutadas; probe del agente quedó esperando permiso sandbox y se canceló. Worktree `factory-tables-fix` integrado, conservado hasta resultado QA/corrección. Sin push/PROD.

Owner ratificó autonomía del trabajo local; push y migraciones de producción exigen su autorización por caso. AGENTS distingue autorización funcional y permisos técnicos. Preferencia del proyecto en `.codex/config.toml`: on-request + auto_review, network_access para workspace. Debe cargarse en nueva sesión/configuración confiable; el modo actual de permisos y requisitos gestionados prevalecen. En el chat actual seleccionar “Approve for me”; no se afirmó haber cambiado en caliente sus permisos. Sin desactivar sandbox ni modificar configuración global.

Owner aprobó dos implementadores fullstack, coordinador y QA independiente, dev como base, main local listo y cada publicación con autorización explícita. Base Claude bca17ec + handoff148c38af. Harness a6dc532d, correcciones ee9a0081/968de91d, fotosStock244882bb y Recetasa2fab2e2; QA2b7ae272 incorporado. [Informe independiente](../factory/0225-qa.md), ADR0144 y specs0225/0226. OpenAI real sobre datos ficticios/local: Stock200 con2líneas8s; Recetas200 con3líneas/yield2 en5s; no compras/recetas guardadas, flags/sesión temporal restaurados. No smoke real del menú/dictado.

Evidencia:9/9browser focal,44/44tools,19/19antiPROD/runner. Tipos/lint/guardia/unit2726 verdes; format corregido f00b093e;4buildsWebpack verdes (TurbopackEPERM). Globalbrowser390PASS62skip sin retries. Neon inicial3674PASS282skip y2suitesPOSFAIL por deadlockDDL; solo esas2repetidas secuencialmente7/7PASS. Nueva receta separa migraciones del resto: auditada y comprobada con guard19/19; no nueva corrida global real. NO afirmar pnpmverifyEXIT0. Preparar publicación con sus gates y migraciones0079/0080/0081 solo cuando owner autorice; PROD/originmain4208714 intactos.

Corrección tras feedback owner40min: main local exige evidencia focal+QA+integración proporcional, sin batería de publicación por defecto. Repetir/ampliar solo por cambio/fallo/riesgo concreto. Pre-push vigente conserva verify, sin bypass; no ocultar duplicación. Factory es piloto operado por coordinador con registro local/locks y tres worktrees temporales, no scheduler autónomo continuo. Siguiente trabajo: tomar otras dos tareas con contratos/scopes disjuntos. Main local avanzó por fast-forward fab728e→9ed5ccc2 y recibe también este cierre documental. Los tres worktrees/rama de worker y QA retirados sin force, registro retired; solo checkout raíz en dev. Dev y main local quedan sincronizados tras el cierre; artefactos/skills ajenos preservados.

## HISTÓRICO — INVESTIGACIÓN PREVIA A ADOPCIÓN FACTORY (2026-10-13)

Owner pidió investigar factory continua: descomposición producto→feature→tarea,2implementadores que toman otra tarea mientras QA revisa, fixes reasignables y un integrador. [Investigación Symphony/casos](../investigacion-software-factory-symphony-2026-10-13.md), enlazada desde [plan pendiente](../plan-piloto-multiagente-2026-10-13.md). Recomienda pool2workers incluyendo fixes,1QA y coordinador/integrador para los4lugares actuales; escalar por cola/WIP/aceptación integrada, no todos ocupados ni cero cuellos prometidos. Entregas/SHA preservados y contexto fresco QA; aceptación tarea/feature/combinación/release separadas. Symphony scheduler candidato para spike después del piloto, no instalar ahora; ejemplo WORKFLOW no copiar(PR/push/rework). Main/live deben separarse si se quieren merges remotos continuos. GPT UI/backend al adoptar política; cierre completo/merge/sincronización Claude siguen condición previa, sin inicio automático.

Fuentes primarias abiertas: SymphonyREADME/SPEC/elixirREADME/WORKFLOW; OpenAIharnessengineering y guía verificación; StrongDMfactory relatoCTO; Cursor self-driving investigación; entrevista original RyanCarson/Untangle(agosto2026). Casos pequeños equipos/solo y prototipos separados de equivalenciaSalesforce: no se certifica calidad/escala por PRs o númeroagentes. Symphonypreview; referencia actual documenta Linear/GitHub/Jira/Asana, límites global/estado y workspaces; QAindependiente/migraciones/WIP son adaptación a comprobar. Solo investigación/enlace/estado propio, formato comprobado al cerrar; sin instalación/agentes/worktrees, números reservados, código/hooks/reglas/permisos, commit/merge/push ni operacionesPROD. Backend/staging Claude preservados. CI última consulta previa main4208714 rojoPOS; no se revalidó salud de producto en esta investigación. Pendiente cierre independiente0222 indicado abajo.

## HISTÓRICO — ENTREGA POS Y MESAS COMO MÓDULOS, SPEC0222 / 0220 PARTE 2b (2026-10-13)

Encargo completo entregado en `dev`, sin push/merge/deploy. Reserva `549ae06`; helper HTTP `369da93`; traslado/enganches `1ff282f`; marcado visual de barra `c4ca538`; e2e `f779b80`. Evidencia y bitácora en [spec0222](../specs/0222-pantallas-pos-mesas-modulos.md). Spec cerrada, pendiente PASS independiente conjunto de Claude.

POS, ticket y Mesas en modules/<id>/ui, páginas fijas borradas y registro UI conectado. URLs nuevas /api/modules/{pos,tables}; PosError adapta helper HTTP genérico del core sin dependencias entre módulos. Pantalla POS conserva locales activos leídos en servidor. Ajustes/Locales reciben paneles como slots React desde ui-registry en sus páginas servidor, sin importar la pantalla servidor en bundles cliente. Mesas conserva cierre bloqueado al guardar, reintento y remonta por instancia. Menú/barra/aviso usan manifiestos; acción checkpass:module-primary con moduleId y barra con marcado/estilos anteriores. Ajustes switches/errores409/paneles genéricos; toggle confirmado emite checkpass:modules-changed; navegación/Locales releen sesión con generaciones para evitar respuestas viejas. Equipo solo permisos del DTO, sin posEnabled; permisos apagados previos se conservan. POS sin Mesas ofrece nombre libre, no consulta mesas ni envía tableId.

PENDING_GPT_DIRS/IMPORTS/SCREENS=[]; PENDING_GPT solo tres filas del servidor: session-view.ts=4, read-surfaces-leak.test.ts=1, session.neon.integration.test.ts=2. Solo se quitaron pendientes resueltos, sin modificar patrones/aserciones/excepciones. Claude debe quitar esas tres filas y posEnabled del servidor después de esta entrega.

Node24.20.0: tipos6paquetes verdes (merchant ejecutado5,485s, otros5caché), merchant0 tras restaurar next-env generado; lint0; guardia --base origin/main115archivos sin aumentos; módulos215aprobados/122omitidos en28archivos aprobados/25omitidos,15,98s. E2e ocho suites afectadas165aprobados, sin fallos/reintentos,59s, workers2. Diez regresiones nuevas cubren Mesas apagado390/1280,409Mesas, montaje de ticket/eventos, Locales/permiso, acción móvil/moduleId/icono y aviso operación7/8días/subruta/core. Asunciones de cobro/cupón/UUID/impresión/versiones/dobles envíos/cierre permanecen. Prettier propio/diffcheck0. CapturasPOS390/1280,409móvil,configuración/ticketescritorio y barra móvil vistas; barra corregida y confirmada. M1 en copia aislada fuerza selector con Mesas apagado:2rojos correctos por nombre libre ausente, restauraciónSHA/bytes idénticos. Selectores nuevos informativo/SVG diferido corregidos tras rojos de selector, sin aflojar pruebas existentes.

Cambios paralelos0223 inicialmente rompieron tipos y dos fronteras; preservados sin editar. Snapshot propio a790599+UI pasó tipos6paquetes,246pruebas y buildMerchantWebpack. Después árbol compartido final tipos/fronteras verdes. Turbopack adicional falló porEPERM de puerto interno incluso con escalación; Webpack snapshot pasó. Logs /tmp/checkpass-0222-*.log y capturas /tmp/checkpass-0222-results. No se habilitó DATABASE_URL ni suitesNeon de producción.

AFUERA: servidor posEnabled (Claude), revisor adversarial conjunto, QAowner en base local/túnel y migración/deploy0079PROD. No se modificaron servidor/API/manifiestos/packages-db/kit/guardias/tooling/PWA/inicio. Cambios0223 y archivos/artefactos ajenos sin seguimiento preservados; next-env generado restaurado. Cierre documental se registra aparte.

## HISTÓRICO — LANDING: PREPARACIÓN DE IMÁGENES, SPEC0221 (2026-10-13)

Reserva58714dd; código2ea68ec; cierre fab728e. Owner autorizó merge local el13/10: main avanzó por fast-forward792d7ed→fab728e (snapshot verificado2ea68ec + cierre solo docs). Sin push. Se volvió a dev; los cinco commits posteriores de Claude0220 hasta a46be31 quedaron en dev porque requieren UI2b y nueva verificación. [Handoff](../handoff-0221-landing-imagenes.md). Sustituye warmUpHTTP del srcset (sin Accept navegador, sin consumo/validación, errores ocultos) por Chromium390/1440 con scroll, complete/naturalWidth/decode y diagnósticoURL/ruta. Sin producto/assets/API/servidor/kit ni aflojar aserciones. Diagnóstico original aislado1/1 en14.3s y17/17 en15.8s: intermitencia anterior no reproducida y no se afirma causa única.

Arreglo17/17 en18.7s sin reintentos, capturas hero móvil/escritorio vistas; M1 intercepta hero404 en copia temporal: rojo correcto loaded:false en preparación, SHA/bytes restaurados. ESLint/Prettier/diffcheck verdes. Verify único en copia limpia2ea68ec con CI=true y base4208714, sin DATABASE_URL: EXIT0, todo verde (tipo14.9s/lint8.1/guardia1.2/formato9/unit43.9/build33.8/e2e277.9/Neon468.7). E2e369aprobados/62omitidos, sin fallos/reintentos, incluye17landing+24equipo; Neon3583aprobados/282omitidos en449archivosaprobados/41omitidos. Unit2677 y cuatro builds verdes. CapturasPOS390/1440 del global vistas. Logs /private/tmp/checkpass-0221-*.log. Snapshot excluye cambios SIN commit de Claude0220. CI remoto sigue rojo4208714 por pathsPOS ya corregidos en dev, sin publicación. Spec cerrada hasta revisión independiente; QA real pendiente.

Reserva inicialmente incorporó tres borrados ya preparados por Claude: commit corregido inmediatamente58714dd, solo docs, eliminaciones restablecidas al staging sin tocar archivos. Commit código se hizo con --only landing.spec.ts y no tomó el staging paralelo.

## HISTÓRICO — ACCESO DEL EQUIPO, SPEC0219 (2026-10-13)

UI implementada en dev: reservaee228d2; precisión de estilos83eeb61; codec80b347; whitelist avisos9e4734a. Ruta /acceso-equipo pública fuera de locale, sin push/merge/deploy. [Handoff](../handoff-0219-acceso-equipo.md) con contrato pendiente y tabla REAL. Spec0219 cerrada hasta PASS independiente/QA. Main remoto4208714 sigue rojo por capturasPOS ya corregidas en devb2482c4, sin publicación.

Reutiliza kit Form/TextField/Button/InlineApiError/Heading/Text y marco del dueño WizardShell. La entrada estilizada antigua page.tsx se trasladó a _components/merchant-entry.tsx (rename84%, mismo importCSS), dueño page.ts reexporta default/generateMetadata; audience opcional Para el equipo, default Para negocios intacto. Sin CSS/paleta/kit nuevos. PinField compone campos6números con inputMode numeric, one-time-code, maxLength6 y pattern. Login POST identifier/pin, GET sesión confirma usuario/permisos; cambio obligatorio con currentPin/newPin/repetición, entrada directa GET user.id y fallback/backoffice. Landing del servidor, navegación de documento nuevo, locks/errores/reintento/contador429 y cuatro avisosURL. Propiedades heredadas/desconocidas se ignoran. PIN en memoria, sin storage/URL/logs. Permisos vacíos o membresía inactiva muestran solo Tu acceso no está activado, sin formularios/botones/redirección.

Límite real: APIactual crea sesión con cero permisos. UI corta el flujo; el rechazo ANTES de cookie y el guard del panel los debe cerrar Claude según contrato escrito0219 (decisión owner ya tomada, no pregunta abierta). No se editó servidor/API/kit/migraciones/host/noindex/DNS, no se afirma autorización protegida solo por UI.

Node24.20.0:24/24 e2e Next/Turbopack con HTTPsimulado en10.2s; login/PINerror/cambio, ceros, coincidencia,429ambos, avisos4, GET/directo/sin sesión/permisos0/destino inválido/retry/dobles envíos/claves heredadas. Cuatro capturas390/1280 vistas en dos rondas; marco sin CSS detectado y corregido por compartir estilos existentes. Primeros rojos de selectores Next annuncer/devtools y runner de otra instalación corregidos, sin aflojar aserciones. M1 fuerza cambio con permisos vacíos: rojo correcto por heading no activado ausente, revertida con SHA/bytes iguales. Tipos/lint/formato/diffcheck/guardia46 sin aumentos y build Merchant final0.

Verify único CI=true en copia temporal sobrec80b347: typecheck/lint/guardia/formato/unit2677/build4/NeonCI3583 verdes. ROJO e2e:350pasan62omitidos15no corrieron(grupo serial),1fallo landing390light por naturalWidth0 (hero30s, reintentos POS60s). Dueño y21tests iniciales de equipo pasaron global. No se modificó landing ni se afirma verify verde. Corrección avisos9e posterior validada con24e2e y build final. Env de copia sin DATABASE_URL; DB solo wrapperCI. Servidores/archivos ajenos preservados. Logs /private/tmp/checkpass-0219-*.log y capturas /private/tmp/checkpass-0219-results.

## HISTÓRICO — MÓDULOS FASE 1, SPEC0217 (2026-10-13)

Encargo387e6fc completado en dev. Specf656cb6; UI6f2272f; corrección CI POSb2482c4; ampliación mecánica documentada6fe87da y esperas de imagen landing8e837c8. Sin merge/push/deploy. [Handoff](../handoff-0217-modulos-fase1-2026-10-13.md) con tabla real y logs. Claude documentó PASS conjunto0216+0217 en9204c30; H2(iconos) corregido3e33436 y verificado después. Spec0217 sigue cerrada hasta confirmaciónH2; QA owner antes de publicar.

Stock/Recetas mudados a modules/<id>/ui con imports corregidos, páginas fijas borradas y registro actualizado; URLs y payloads intactos. Menú usa moduleNavigation+DTO para cualquier integrante y permisos propios, conserva defensa GET antiguo/evento confirmado; iconos genéricos desde exports iconoir en diferido, sin mapa manual. Ajustes lista DTO completo con name/description/requires/suggested, dependencias genéricas y 409 missing/dependents. Equipo muestra labels/descriptions del DTO en selector/listado; módulos apagados deshabilitados, permisos previos conservados al editar otros; reintento GET y copy422, protecciones admin/propios intactas. Listas PENDING_GPT={} y PENDING_GPT_DIRS=[]; sin excepciones nuevas. Fixtures completos y tercer módulo sintético. POS captura portable; landing naturalWidth>0 espera30s con presupuesto120s y umbrales conservados.

Node24.20.0: 48/48 unitarios/frontera; tipos merchant/lint/diffcheck/guardia UI sin aumentos. E2e específicos21/21 en13.2s, notaPOS4/4; ocho capturas390/1280 vistas. Verify único en copia temporal aislada (HEAD0f3cb87+30 archivos propios, sin cambios sin commit de Claude0218): tipos/lint/guardia/formato/unitarios2628/build4/NeonCI3531 verdes. Verify devolvió ROJO por imagen landing desktop con poll5s; corregido y landing Turbopack EN FRÍO4/4 en34.6s. Repetición global normal368pasaron21omitidos18fallos por Merchant caído ERR_CONNECTION_REFUSED. Repetición con servidores nuevos, CI=true workers2 retries0:345pasaron62omitidos0fallos. Gate e2e resuelto; no se afirma verify verde en una sola invocación. Env de copia sin DATABASE_URL; Neon exclusivamente por wrapperCI, sin producción. Servidores originales y trabajo paralelo de Claude/API/kit/paquetes/archivos generados/assets sin seguimiento preservados.

H2 del revisor de Claude: cerrado en código3e33436; Planet declarado solo en módulo sintético se verifica por su SVG en390/1280. Frontera actual13/13 (incluye regla1b nueva deClaude), tipos del árbol actual con0218/lint/guardia38 sin aumentos; e2e afectados18/18 en11.3s y build MerchantTurbopack aisladoexit0. Primer intento de tipos/build del helper falló por never; unknown antes de validar react.forward_ref lo corrigió. Suite global y Neon arriba son anteriores aH2; no se repitieron. Falta confirmar H2 con el revisor.

## HISTÓRICO — LANDING EN FRÍO, NÚMEROS Y CIERRE0215 (2026-10-13)

Owner pidió tres tareas L1 en dev, sin mover archivos mientras Claude trabaja0216. Commit autorizado `f82130b`, solo landing.spec.ts y archivos actuales backoffice/stock y backoffice/recipes + documentación propia. No se tocaron API/módulos backend/kit/paquetes ni el staging ajeno de Claude. Sin merge ni push de estas tareas.

Landing: gotoReady usa DOMContentLoaded, espera heading visible, hojas CSS cargadas y document.fonts.ready. WarmUp también corre con PUBLIC_LANDING_TEST_URL, incluye rutas punto-de-venta/privacy antes faltantes. Mediciones x/límite horizontal/ancho móvil usan expect.poll con los mismos umbrales, imagen naturalWidth>0 conservada, presupuesto de carga en frío explícito (sin sleeps). Prueba real aislada, Next dev --webpack, copia temporal sin .next y sin tocar los servidores abiertos:4/4 landing390/1440 light/dark en34.3s. Artefactos /private/tmp/checkpass-landing-cold-zb7g0xp3/results. No se afirma corrida con Turbopack ni suite completa. Primer arranque bloqueado EPERM se repitió autorizado; filtro inicial no seleccionó tests, corregido. Hubo avisos de hidratación de details en consola del servidor, sin pageerrors y con las cuatro pruebas verdes; no se cambió producto fuera de alcance.

Stock/Recetas: formatAmount español máximo3 decimales para log (cantidades/conteos/precio total), editableAmount sin agrupación para valores recibidos de API/draft en ambos modales, null sigue vacío. No reformatea cada pulsación; payloads siguen punto decimal y cantidades exactas. No existen costes por unidad renderizados en estas pantallas (analítica fuera de0215); no se añadieron métricas. Rendimiento también localizado. Vitest receta13/13 en136ms, incluye ejemplos15/7,5/0,1, null y miles sin agrupación, persistencia del valor. Typecheck merchant/ESLint/Prettier/guardia sin aumentos/diffcheck0. Estado0215 cerrado documentalmente: implementación868f3b3 ya mergeada; ningún pendiente funcional en alcance, QA visual/LLM owner declarado fuera. Sin movimientos de pantallas0216, sin merge/push nuevo.

## HISTÓRICO — RECETAS: DICTADO Y REVISIÓN (2026-10-13)

Spec0215 reservada92c088d; implementación868f3b3 incluye UI de Recetas y ajustes de layout/skeleton Stock. Owner autorizó commit y merge local a main, y confirmó continuar con límite de e2e bloqueado por servidor local existente. Sin push/deploy. Owner pidió Nueva receta → buscar producto del catálogo → multiline micrófono teclado → analizar → ingredientes editables y guardar. RecipesConsole GET recipes, lista guardadas por lineCount y Nueva receta busca productos sin receta; vacío/error/retry/skeleton/toast. Modal reutiliza StaffFormModal de Stock, GET receta + items?status=all; edición existente conserva archivados originales, selector solo activos/archivado presente. POST recipes/:id/draft, yield informado sin dividir nuevamente; null exige cantidad; sourceText y unparsed con reconocimiento. Manual alternativo/volver al texto preservan datos; PUT itemId o newItem+quantity+unit atómico vía API. Validaciones50/duplicados/nombres/unidades/decimales/coma, receta existente vacía elimina con aviso. Bloqueo de doble envío/cierre en vuelo, error conserva borrador, éxito cierra y recarga sin repetir escritura. Sin costes/márgenes ni servidor/API/kit/migraciones. Mantiene layout anterior de Stock/Catálogo.

Node24: Vitest12/12 en183ms con config merchant (primer filtro --project merchant inválido, corregido). Typecheck final0 (test union itemId/newItem corregido), ESLint/Prettier/guardia sin aumentos/diffcheck0. Al solicitar merge se ejecutó verify: tipos/lint/guardia/build pasan; formato caché local .impeccable/hook.cache.json corregido y format:check global repetido0. E2e no arrancó por next dev Consumer ya activo, PID30027; servidor preservado. Neon via wrapper contra CI en curso al registrar este cierre; no producción. Owner autorizó explícitamente merge pese al límite de e2e. Skills/assets y next-env generados ajenos excluidos del commit. Revisión visual/LLM sigue a cargo owner.

## HISTÓRICO — STOCK REAL: COMPRAS, DICTADO Y CONTEOS (2026-10-12)

Ajuste visual local posterior, sin commit: Stock reutiliza ModuleHeader de Catálogo/Equipo y contenedor brand-page/catalog-page (980px centrado, padding inferior y fondo del catálogo), conservando padding exterior merchant-shell (24px móvil/48px desde700px). Registrar stock queda en fila propia debajo del encabezado, separación24px y tabla alineada al contenedor. Sin Chrome por preferencia owner; revisión visual pendiente en dev-business. No cambios de API/kit ni publicación.

Skeleton local posterior: reemplaza texto visible de carga por StockLogSkeleton, cinco filas con fecha y dos líneas de resumen, encabezados y espacios iguales a la tabla. Reutiliza Skeleton/SkeletonScreen existentes; carga anunciada solo a lectores de pantalla. Se usa también al recargar tras guardar/reintentar; estados error/vacío intactos. Tipos/lint/formato/guardia UI sin aumentos/diffcheck0. Sin Chrome ni commit.

Recetas: ajuste visual local sin commit, mismo contenedor brand-page/catalog-page y ModuleHeader que Stock, centrado980px, padding exterior compartido y gap24px. Contenido provisional y permiso catalog conservados; sin endpoints nuevos. Tipos/lint/formato/guardia/diffcheck0; revisión visual a cargo owner, sin Chrome.

Spec0213 reserva `2016ff3`, implementación `8ee7a91` en dev. Owner aprobó adaptar Stock a contratos0210/0212 y quitar Foto/archivo. Log GET movements?limit=200, filas individuales fecha createdAt y compra/conteo+insumo+cantidad+precio total opcional. Sesión aporta timezone/currency; sin métricas de Analítica. Nuevo stock: Audio default/Manual; insumo activo o nuevo, cantidad/unidad separadas, totalCost opcional y coma decimal. Dictado trim1..2000→POST entries/draft, revisión editable real con sourceText, unparsed y reconocimiento de pendientes; nada persiste hasta POST entries. Sin ejemplos falsos. Conteo solo manual, un insumo por guardado, cantidad≥0, kg/l convertidos exactamente a base antes de POST adjustments; sin precio. Load/error/retry, locks y cierre deshabilitado en vuelo, errores conservan borrador; éxito cierra y recarga log. Helper StaffFormModal incluye textarea/select y tabindex0 en foco. API/servidor/kit/Recetas/migraciones intactos. Sin merge/push/deploy.

Node24: tipo merchant final0 (primer intento Alert import faltante, corregido), ESLint, formato, guardia --base HEAD y diffcheck0. 22 aserciones Node de unidades/cantidades/validaciones/payloads0. No Chrome/e2e/LLM/escritura real por preferencia owner; revisa en dev-business. Tabla real en spec0213. No verify global ni producción. StockTypes frontend sin importar módulos del servidor. Skills/config/assets y next-env generados ajenos preservados. Ajustes locales anteriores de Audio/Manual/multiline quedan incluidos en implementación final.

## HISTÓRICO — ACTIVACIÓN REAL STOCK/RECETAS Y MENÚ (2026-10-12)

Ajuste visual local pendiente de commit: Audio usa TextAreaField con «Usa el micrófono en tu teclado» y Analizar. Sin endpoint, muestra etapa editable con dos ítems explícitamente de ejemplo (no extraídos del texto), Guardar/Descartar y Volver al texto conservando transcripción. Manual y revisión mantienen borradores separados. Guardar sigue solo estado mock. Incluye orden previo Audio/Foto o archivo/Manual pendiente. Tipos merchant/ESLint/formato/guardia/diffcheck0; sin Chrome/tests por owner.

Commit `d1a213b` en dev. Contrato0210 revisado, API implementada. Toggles ya hacían GET /api/modules + PUT /api/modules/:id; ahora publican estado completo confirmado por GET/PUT y menú consulta GET sin caché (owner/catalog). Stock y Recetas se filtran por enabled tanto desktop/móvil como delegados. Sin estado real aparecen ocultos; GET anterior no pisa un evento confirmado posterior. Fallo PUT conserva estado y no publica cambio. Dependencias Recetas→Stock intactas. Contenido Stock/Recetas sigue prototipo, no se conectó; no cambios API/servidor/kit/migraciones. Sin merge/push/deploy.

Node24 tipos merchant/ESLint/Prettier/guardia --base HEAD/diffcheck0; 9 aserciones Node de visibilidad/evento0. Sin Chrome/e2e/verify por preferencia owner, quien comprueba en dev-business. Activación contra servidor real autenticado pendiente del owner; no se escribieron datos vía herramientas. Spec0211 documenta extensión. Ajuste L0 anterior Audio/Foto o archivo/Manual sigue local pendiente de commit; archivos next-env/config/assets ajenos preservados.

## HISTÓRICO — MENÚ STOCK/RECETAS Y REGISTRO VISUAL STOCK, L1 (2026-10-12)

Ajuste L0 local pendiente de commit: orden Audio / Foto o archivo / Manual; Audio seleccionado por defecto. Formato, ESLint y diffcheck0. Sin Chrome/tests por owner.

Propuesta de entradas `f4226fc`: Nuevo stock/Ajustar stock abren StockInputModal reutilizando StaffFormModal de importación catálogo según captura del owner. Tres opciones Foto o archivo/Por voz/Escribir, área archivo con FileButton y lista local, voz visual con ejemplo, texto filas nombre/cantidad/precio y añadir/quitar ítem. IA/grabación deshabilitadas y descritas como propuesta; no subidas/audio/API. Texto añade solo resumen mock a la tabla. Node24 tipos/lint/formato/guardia/diffcheck0. Sin Chrome/tests por owner; revisión visual y significado precio/ajustes aún a definir, no implementación de negocio.

Último ajuste `d729aea`: Registrar stock abre selector Dialog del kit, Nuevo stock primero y Ajustar stock segundo. Botones secondary/iconos Package y EditPencil, gap3 y cierre circular Xmark idéntico a acciones POS. Opciones abren modal de resumen, inline retirado; mock sin API/persistencia. Typecheck/lint/formato/guardia/diffcheck0, sin Chrome/tests por owner.

Commit `08e274c` en dev. Owner pidió links Stock y Recetas (debajo de Stock) visibles como activados, sin consultar API de módulos. Ambos en Mi negocio, desktop y menú móvil, permiso catalog existente y guardas de página equivalentes a Catálogo. Stock muestra tabla/log fecha de creación y resumen, tres registros ficticios y Añadir Stock. Alta provisional inline añade resumen solo al estado React; recargar restaura muestras. Aviso visible de muestra/sin persistencia. Recetas placeholder pendiente de diseño del owner. UI solo, no backend/kit/migraciones. Sin merge/push/deploy.

Owner pidió revisar personalmente y no comprobar en Chrome. No se ejecutó QA visual ni pruebas de navegador; harness/tests preparados retirados. Node24 typecheck merchant, ESLint archivos, guardia --base HEAD y diffcheck0, formato aplicado. No verify global por L1. Revisión visual pendiente del owner en dev-business /backoffice/stock. Trabajo paralelo Claude y next-env generados preservados.

## HISTÓRICO — CONFIGURACIÓN COMPACTA CON TOGGLES, L1 (2026-10-12)

Owner pidió cards Stock/Recetas en Ajustes y clasificó L1; después pidió compactar y reemplazar botones por toggles como impresión. Reserva previa0211 `7791399`, cards `327d0a7`, diseño compacto/toggles `65878d1` en dev. Un panel con filas POS/Stock/Recetas, descripción conservada y estado + Switch del kit; impresión aparte. Recetas requiere Stock y Stock no se apaga con Recetas activo; carga/reintento/error/lock y estados confirmados vía contrato0210. UI solo, sin API/servidor/kit/migraciones. No merge/push/deploy. Backend0210 y base local en trabajo paralelo de Claude, no verificados por GPT.

Node24: typecheck merchant, ESLint tocados, formato, guardia --base HEAD y diffcheck0. Tres pruebas Chromium HTTPsimulado verdes, última corrida3/3 en4.7s; capturas390/1280 vistas sin overflow. Primera ejecución bloqueada listenEPERM, repetida con autorización. Sin verify global/revisor/subagentes por L1(ADR0129). SelectoresPOS ajustados mecánicamente, suitePOS no ejecutada; fixtureticket actualizado para nuevoGET. Evidencia `/private/tmp/checkpass-0211-results/`. Cambios paralelos db/modules y skills/config/assets preservados, no mezclados.

## HISTÓRICO — NOTA POS0209 IMPLEMENTADA EN DEV (2026-10-12)

Owner pidió nota de orden en pasos2/3 del POS, contrato0169 ya en main y base local migrada. Reserva `73e203a`, UI `dbeb469`, fixture anterior actualizado `ae9a5d1`. Ajuste posterior del owner `5faeed5`: padding inferior del footer18px + safe-area (antes10px), compartido con mostrador. CSS compilado medido en Chromium390/1280:18px, posición fixed/sticky conservada; formato/guardia/diffcheck0. Sin nuevas suites para este ajuste L0. Ajuste L0 `a067159`: en órdenes creadas el botón Nota pasa a la fila Editar/Pedido (ambas pestañas), retirado del footer; wizard intacto. Sin tests ni nuevas capturas por instrucción explícita del owner; formato/diffcheck0. Capturas anteriores preceden este movimiento. Ajuste L0 más reciente `b49bdcb` reemplaza ubicación anterior: menú circular48px inferior junto a CTA concentra QR/Nota/Imprimir/Anular; menú superior y nota junto a tabs retirados. Nota presente muestra borde verde/distintivo documento; sin contenido de nota en pedido. Editar limpio mantiene footer para acceder a acciones, Guardar cambios deshabilitado hasta cambios. Última corrección L0 `35c04a3`: wizard2/3 vuelve al icono Notes directo al modal; órdenes creadas conservan el menú MoreVert. Sin tests por owner, formato/diffcheck0. Bloqueos anteriores conservados. Sin tests/capturas/verify por owner; formato/diffcheck0 y revisión estática. E2E anteriores conservan selectores de los accesos viejos y deberán adaptarse cuando se retome verificación, no ejecutados en L0. Último L0 `327a4bb`: distintivo Notes superpuesto retirado del menú circular, borde y aria de nota conservados; wizard intacto. Sin tests, formato/diffcheck0. Último L0 `b5a092c` ordena menú: Nota, Escanear QR, Imprimir, Anular; bloqueos/etiquetas intactos. Formato/diffcheck0, sin tests. Último L0 `06e0f0f`: toast tras guardado exitoso de nota editada «Nota actualizada»/«Nota eliminada»; otros cambios siguen «Pedido actualizado». Aplicar borrador/fallos no anuncian persistencia. Formato/diffcheck0, sin tests. Último L0 `75a27e0`: selección de producto en búsqueda de orden abierta limpia query; +unidad también limpia y emite Producto añadido. Prop opcional DetailedSale activada solo en orden creada; wizard/mostrador intactos. Formato/diffcheck0, sin tests. Último L0 `5f67add` reemplaza guardado de nota en orden creada: Aplicar nota hace PUT inmediato con snapshot de items/contexto guardados, conserva borrador de productos y actualiza baseline/version. Éxito cierra modal y muestra toast; fallo conserva texto/modal y muestra error. Busy impide cierre/duplicados. Wizard conserva nota local hasta crear orden. Formato/diffcheck0, sin tests por owner. Último ajuste `541be5f`: guardado de nota optimista, modal cierra/toast y caché privada se actualizan antes de esperar PUT; servidor confirma version real. Éxito reemplaza snapshot; fallo revierte caché/nota, retira toast y reabre modal con texto pendiente. Epoch protege sesión y bloqueo conserva versión para otras escrituras. Wizard/productos intactos. Tipos merchant/formato/diffcheck0, sin tests/capturas. Corregido reset anterior de toast false→null en descarte detectado por tsc. Corrección L0 `d9002a7`: claves toast producto/actualización prefijadas product-added/order-updated, elimina colisión de contadores numéricos reportada por owner al editar. Formato/diffcheck0, sin tests. Checkout dev; main intacto para esta tarea, sin push/deploy. Skills/config/assets ajenos sin seguimiento preservados.

Botón circular Iconoir junto a Revisar pedido y Guardar pedido, modal del kit Cancelar/Aplicar nota, borrador conservado entre pasos. Orden abierta permite edición, cerrada/anulada lectura. Campo note en DTO; POST note/null, PUT omite si intacta y null borra. Trim/límite1000 y saltos internos; cambio de mesa conserva nota pendiente; conflicto compara nota local/vigente. No se imprime. API/servidor/kit/migraciones sin cambios.

Node24, Chromium5/5 nuevos con HTTP simulado, captura390/1280 vistas y sin overflow. Verify UNA corrida en detached `/private/tmp/checkpass-pos-note-0209`: tipos/lint/guardia/formato/unit/build/relatedmerchant verdes; e2e326pass/62skipped/1fail por expectativa antigua del POST sin note:null. Corregido test y repetido solo gatee2e:327pass/62skipped, salida0, sin flaky. Unit2530pass/1091skipped; relatedmerchant32pass. No producción. Tabla real y límites en docs/qa/0209/README.md, logs `/private/tmp/0209-verify.log` y `/private/tmp/0209-e2e-final.log`. No se afirma que la corrida original fue verde.

Reviewer independiente ship para extensión acotada; documenter confirma compatibilidad y preserva sistema. Spec0209 implementada. Pendiente: owner probar en dev; merge/publicación solamente cuando lo solicite. Servidores habituales preservados; worktree temporal detached queda para evidencia.

## HISTÓRICO — WALLET0208 COMMITEADA Y MERGE LOCAL A MAIN (2026-10-12)

Owner aprobó diseño y pidió merge. UI, mocks y evidencia en `04159ea6f99dc86c722afee2b67be12dbe0820f1`; preparación de imágenes lazy del e2e público en `0ddf72ae7702f35d10d3b6fe28ca2d98439bb563`. Main local avanzó por fast-forward `7f2d757` → `0ddf72a`; SHA main/dev confirmado idéntico. El cierre documental se incorpora con un segundo FF. Sin push ni deploy. Checkout habitual permanece dev y sus servidores no se apagaron ni cambiaron.

Verify final verde: `CI=true pnpm verify --base main` en `/private/tmp/checkpass-wallet-0208-merge`, dependencias319 offline y entornos locales copiados sin imprimir valores. Tipos/lint/guardia/formato/unit/build/e2e/Neon relacionados todos0; tabla real en `docs/qa/0208/README.md`, log `/private/tmp/0208-merge-verify-ci.log`. Unit2530pasaron/1091saltados; e2e322pasaron/62saltados (config CI), sin errores/flaky. Neon relacionado merchant7/7 y consumer19/19 vía wrapper protegido, no producción. El fallo anterior de copy ya estaba corregido; se activaron imágenes lazy antes de medirlas, sin cambiar la landing ni sus aserciones. Diagnóstico y prueba específica1/1 confirmados. Intentos anteriores ROJO quedan documentados; no se confunden con el gate final verde.

Entrada /wallet sin sesión, enroll sin/con sesión/ya miembro/no disponible y ready/install con Club cotidiano+paletaA y NunitoSans local. Google/Apple, consentimiento explícito, programId/loc, manifest, ofertas y avisos conservados. Wallet interna/API/servidor/paquetes/kit sin cambios. Revisión visual owner y reviewer independiente aprobadas; OAuth/instalación en teléfono físico no probados por el owner. Spec0208 implementada, INDEX cerrado a merge local.

Pendiente: publicación solo si la solicita el owner. Main ya incluía el trabajo de Claude0073, sin migrar PROD según su estado: coordinar antes de un eventual push, no migrado por GPT. Worktree de verificación queda detached; mock58407 y servidores3200/3201 preservados. Skills/config/assets ajenos sin seguimiento no entraron al commit.

## HISTÓRICO — ENTRADA WALLET0208 APLICADA LOCAL Y APROBADA (2026-10-12)

Owner aprobó mock0207 y pidió aplicarlo. Implementada entrada sin sesión en /wallet, inscripción sin/con sesión/ya miembro/no disponible y confirmación/install en enroll/ready. Club cotidiano+paletaA, NunitoSans local con OFL, marcaC real, logo/nombre reales o inicial. URLsprograma/local y ordenGoogle/Apple, POST201/409/401/errores/red, manifest y notificaciones conservados. CSS module aislado; wallet interna/API/servidor/paquetes/kit sin cambios. Reserva0208 `3b3af23` en dev; implementación SIN commit/merge/push/deploy. Owner dice «está perfecto» visualmente; no puede probarlocal.

Checks específicos Node24: typecheck, ESLint y formato consumer/e2e0; unit14/14; Chromium11/11 con datos/HTTP simulados y1/1 posterior para limpiar error al appinstalled. Capturas seis estados390/1440 y overflow320/360/390/430/1440; Nextreal3200 /wallet200, fontNunito y sin erroresJS. Revisor independiente fuente/fondo/composición/truthpass, fixdocumental resuelto, verdictpassship. PRODUCT/DESIGN/sidecar actualizados a páginas reales deentrada y excepciones proveedores. Evidencia `docs/qa/0208/README.md` y capturas.

Verify UNA corrida, ROJO: tipos/lint/guard/build0; formato JSONs deImpeccable generados; unit2529pass+1fail y NeonCI3375pass+1fail (mismo test merchantwelcomeUI por dosstringscopy anteriores); e2egeneral no inició porque otroNextdev del mismoconsumer sigue en3200. Actualizadas dosaserciones mecánicas dewelcomeUI según§6;7/7posteriorpasó y no se quitó protección de premio. Formato artefactos normalizado; hookcache puede regenerarse otra vez, no esUI. Logs `/private/tmp/0208-verify.log` y `/private/tmp/0208-format-final.log`. No se repitió verifyglobal; no afirmar verdecompleto. Neon solo vía tools/neon-test.sh con URLsCI; no producción. Next-env generados se restauran y servidoresowner sepreservan.

Confirmación final: next-env generados restaurados; `pnpm format:check` posterior0 y diffcheck0. No se repitió la suite global; los resultadosROJO de la tabla original se conservan como ejecutados.

Pendiente antes depublicar: cerrar e2egeneral en ambiente sin colisiónNext, guardarimplementación, paseamain ypush solo solicitado porowner. No cambios visuales necesarios. Spec0208 registra UI implementada con e2egeneralpendiente; no marcado cierrecompleto. Mock58407 y server3200 preservados. Skills/config/assets paralelos no mezclados.

## HISTÓRICO — MOCKS WALLET, CLUB COTIDIANO + PALETA A (2026-10-12)

Owner pidió rediseño, eligió concepto2 Club cotidiano y paletaA (verdeprofundo/coral/blanco), luego mocksHTML/CSS para ajustar copy y espacios. Spec0207 reservada en dev con commit `cf1247e`; implementación está local SIN commit, sin merge/push/deploy. Prototipo autónomo `docs/qa/0207/mocks/`; servidor Python puerto58407, http://127.0.0.1:58407/. No toca rutas reales, OAuth, API, servidor, paquetes, kit ni producción.

Cuatro pantallas: login puro, inscripción sin sesión, inscripción con sesión y confirmación/instalación iPhone/Android. Comparar y vistaindividual; controles nombre/comercio/ancho/titular/margen/separación y textos editables. Acciones solo simuladas, datos ficticios; ajustes no persisten al recargar. Referencia visual y PRODUCT documentadas; DESIGN y sidecar se documentan con alcance de prototipo, no reemplazan aún la app.

Node24, Chromium salida0: cuatro estados a320/360/390/430, nueve capturas finales (incluye comparación1440), sin overflow/erroresJS/solicitudesAPI. Controles y navegación comprobados; evidencia `docs/qa/0207/captures/checks.json`, README y capturas. Fuente NunitoSans autohospedada con OFL; contrastes principales≥4.5, iconoverde/coral4.40. Revisor independiente pidió fuente distinta del sistema; corregido y verdictpass ship para ese hallazgo, acciones/saltos preservados. Hook darkglow corregido, scan posterior limpio, sin supresiones. SintaxisJS/diffcheck0. Sin verify global ni suites de app para mock documental.

Stop posterior: icon-tile-stack triado como sello de confirmación intencional del concepto2 elegido por owner. Excepción persistida vía hooks ignore-value únicamente para esta regla en `docs/qa/0207/mocks/index.html`, config `.impeccable/config.json` del repo. Sin cambios visuales ni nuevas capturas necesarias; README actualizado.

Owner revisa y ajusta en navegador. App real sigue igual. Otros untracked de skills/config/assets preservados. Main no se cambia.

## HISTÓRICO — IMPRESIÓN Y AJUSTES POS APROBADOS, MERGE LOCAL A MAIN (2026-10-11)

Owner probó los ajustes y autorizó commit + merge de todos los cambios, sin tests
adicionales. Commit L0 `b6a04c7e52c672d23ede5e45f950e4a8cb2bb9ee`: pie de creación/orden abierta al fondo en escritorio,
banner de prueba en POS solo con 7 días o menos. Main local avanzó por fast-forward
f42460b → b6a04c7, incorporando también UI0206 da9c924 y cierre022c681.
SHA main/dev confirmado. Sin push ni deploy; checkout habitual sigue dev y
servidores locales preservados. Cierre documental se incorpora con otro FF.

Checks ya ejecutados para L0: typecheck, ESLint, formato, guardia UI y diffcheck
salida0. Revisión visual/funcional del owner aprobada. Sin suites adicionales ni
verify, por instrucción explícita. UI0206 conserva su evidencia previa121/121 e2e
específicos con rutas simuladas y gates0; no se presenta como corrida nueva.
Migración0072 ya aplicada en Docker local (73 migraciones en total); columna
printing_enabled NOT NULL DEFAULT false y lectura del rol de app verificadas.
Producción no migrada por GPT; publicación y migración a PROD pendientes del owner/Claude.

Trabajos de UI y documentación guardados; configuración/skills/assets locales
sin seguimiento preservados y excluidos. API, servidor, packages y kit intactos.
Próximo paso: publicación solamente si el owner la solicita.

## HISTÓRICO — PIE DEL POS AL FONDO EN ESCRITORIO, LOCAL (2026-10-11)

Ajuste L0 solicitado con dos capturas: en escritorio Tomar pedido y el pie de
la orden abierta quedaban justo tras el contenido. Main del workspace, wrapper
 y editor ahora crecen como columna flex; el pie usa mt-auto y sticky bottom-0
en md. Móvil conserva sus clases existentes. Aplicado en pos-console.tsx y
pos-editor.tsx, sin commit ni merge/push. Revisión visual del owner pendiente.
Node24: typecheck, ESLint merchant, formato, guardia UI y diffcheck en0. Sin suites
ni capturas nuevas para este ajuste rápido. No se tocaron API, servidor, kit o CSS.

UI0206 ya commiteada en dev (da9c924, cierre022c681) y e2e121/121 previos al ajuste
L0. Migración0072 aplicada después a Docker local, columna printing_enabled
NOT NULL DEFAULT false confirmada; error503 de Ajustes corregido en ambiente.
Banner de prueba en POS (últimos7 días) sigue pendiente de commit junto con
este ajuste; no incluir otros archivos sin seguimiento ni trabajo de Claude.

## HISTÓRICO — 0206 IMPRESIÓN POR NEGOCIO, UI COMMITEADA EN DEV (2026-10-11)

Corrección del ambiente local (2026-10-11): 503 en Ajustes por SQLSTATE42703.
Confirmado por logs y information_schema: faltaba printing_enabled. Ejecutado
el migrador db:local:migrate con URL fija de Docker local: salida0,73 migraciones.
Columna printing_enabled verificada NOT NULL DEFAULT false; lectura de los tres
campos con neondb_owner en0. No se modificó código ni se migró producción.
El owner debe recargar Ajustes para renovar la lectura que había fallado.

Commit UI `da9c924a8099ee58b28a691c7266a8b1d18d07fc`. API de Claude `1106798` ya en dev. Owner pidió solo pantalla,
commit en dev sin push ni merge. No se tocaron API, servidor, packages, kit,
printing/** ni tooling. DTO frontend de tres booleanos compartido entre Ajustes
 y POS en settings/ticket-settings-types.ts.

Imprimir tickets controla printingEnabled guardado; apagado oculta nombre del
comercio/mesa sin borrar sus valores. PUT siempre manda los tres booleanos. Carga
 y errores visibles aun apagado; mientras carga, el interruptor está deshabilitado.
POS toma el ajuste de pos-printing.ts y oculta Imprimir en orden abierta y detalle
cuando false o pendiente. Validación exige los tres campos, sin defaults inventados;
print() también respeta la regla. Fixtures POS, mesas e impresión con enabled=true
para preservar sus recorridos; casos nuevos prueban false/true y PUT completo.

Node24, salida0: typecheck merchant, ESLint merchant + cuatro e2e, Prettier merchant
+ e2e, guardia UI y diffcheck. Chromium 121/121 específicos de pos.spec,
pos-printing.spec, ticket-settings.spec y tables.spec (50.6s). Rutas simuladas con
page.route; sin Neon ni suite completa. Reporte /private/tmp/0206-report/index.html.
CI main verde4c40a6a consultado. Spec0206 e INDEX actualizados con evidencia y SHA.
Pendiente QA del owner en local y pase a live con migración0072 (zona Claude).

Ajuste previo del banner de prueba en POS (solo últimos7 días) sigue aplicado
localmente y SIN commit en trial-notice.tsx; no se mezcló en este commit de0206.
Se conserva en el histórico siguiente. Main mantiene cierre9496e0b y no incorpora
API/UI0206. Sin merge, push ni deploy, según instrucción.

## HISTÓRICO — AVISO DE PRUEBA EN POS SOLO ÚLTIMOS 7 DÍAS, LOCAL (2026-10-11)

Ajuste L0 solicitado por el owner: TrialNotice se oculta en /backoffice/pos y sus
subrutas cuando trialDaysLeft > 7; aparece con 7 días o menos. Otras pantallas
conservan comportamiento. Usa el dato de sesión existente, sin recalcular fechas.
Aplicado localmente en dev, sin commit, merge ni push. Revisión del owner pendiente.
Node24: typecheck y ESLint merchant, formato del archivo, guardia UI y diffcheck en 0.
Sin suites ni navegador; cambios paralelos de Claude en tickets/DB preservados.
Pestañas y trabajos anteriores ya quedaron en main/dev con el cierre 9496e0b.

## HISTÓRICO — PESTAÑAS DE ACCESO APROBADAS Y MERGE LOCAL A MAIN (2026-10-11)

Owner aprobó las pestañas en local («funciona perfecto») y autorizó commit +
merge de todo a main. Commit UI `7797b242f19fd9afdc11361fef7542d117ab8a07`.
Main ya incorporaba los trabajos anteriores (a480692, incluido dev:link de
Claude); fast-forward local a480692 → 7797b24 realizado y SHA confirmado.
Sin push ni deploy. Checkout habitual sigue dev; servidores 3200/3201 preservados.

Tabs del kit arriba del formulario: Iniciar sesión / Crear un negocio, opción
activa marcada y accesos inferiores retirados. Alternar actualiza la URL con
signup=1 para registro y sin signup para login; conserva otras queries/hash y el
estado interno de Next. Crear negocio se deshabilita mientras se pide el código.
No se tocaron API, servidor, paquetes, kit, estilos, tooling ni sesión.

Node24: typecheck, ESLint merchant y guardia UI en 0; formato de cuatro archivos y
diffcheck en 0. Owner revisó funcionamiento en local. Sin tests nuevos ni suites
para este L0. Al preparar el merge se creó checkout temporal y se instalaron
319 dependencias offline; plan de verify leído, pero la ejecución NO llegó a
iniciarse. Owner indicó expresamente no ejecutar suite completa para este merge.
Los e2e18/18 y unit4/4 de 0205 previos al ajuste permanecen como evidencia previa,
no como una nueva corrida. No se omitió ningún hook de push: no hubo push.

Spec0205 e INDEX actualizados con aprobación y merge. Los archivos sin seguimiento
de Impeccable/configuración/assets se conservaron y no entraron en commits.
Estado documental se integra con un segundo fast-forward a main al cerrar.
Próximo paso: publicación solo cuando el owner la pida; no reiniciar servidores.

## HISTÓRICO — 0205 LOGIN POR DEFECTO EN MERCHANT, COMMITEADO EN DEV (2026-10-11)

Commit UI `0af3d6a38a1d538fb631b91dfda32935c725998c`, reserva local `b8201e3`. Sin push ni merge.
Owner pidió que business.checkpass.club abra login; registro solo por enlace
explícito. Raíz y /es/business/onboarding abren login sin sesión por defecto.
`?signup=1` abre alta desde la raíz o desde onboarding; otros valores/duplicados
no habilitan registro. Crear un negocio cambia manualmente al alta, e Iniciar
sesión regresa al login. Sesión válida sigue al panel y rebotes ?e= conservan
prioridad. Metadata acompaña la entrada pedida. Los CTA compartidos de alta de
la web pública llevan signup=1, preservando MERCHANT_ONBOARDING_URL y sus queries.

Verificación real Node 24.20.0, salida 0: typecheck merchant/public, ESLint ambos
paquetes y e2e, Prettier ambos paquetes/archivos, guardia UI y diffcheck. E2E18/18
(entrada8, login código7, alta3), unit existentes4/4 (entry-billing y onboarding-flow).
Reporte `/private/tmp/0205-report/index.html`. URL de alta con default y override
comprobado: signup=1 y campaign=qa preservados. CI main verde4c40a6a consultado.
Sin API, servidor, paquetes, kit, CSS ni tooling tocados. Sin base de producción
para pruebas; no se corrió verify global (queda para el pase conjunto a live).

Spec0205 e INDEX cerrados con evidencia. Revisión local del owner pendiente.
Merchant local en http://localhost:3101 sirve el cambio. Acumulado en dev: login
con código0202 (`c59ef50`), vencimiento solo en wizard0195 (`0f44916`) y esta entrada.
Main no incorpora esas UIs nuevas; publicación conjunta a cargo del owner.

## HISTÓRICO — 0195 VENCIMIENTO SOLO EN WIZARD, COMMITEADO EN DEV (2026-10-11)

Commit UI `0f449164e14030688124526e90decbebf1b02498`. Alcance final del owner: solo configurar en el paso
«Unidades» (puntos) / «Sello y objetivo» (sellos), tanto creación como edición.
Sin información de vencimiento en la vista del programa, inscripción, wallet ni
app del cliente. U5–U6 retiradas, no se presentan como implementadas. API de
Claude y migración ya en PROD según el owner. Sin push ni merge; habrá un solo
push del owner con todo. No se tocaron API, servidor, packages, kit ni tooling.

Regla apagada por defecto; selector 3/6/9/12 con 6 al activar. Activar/acortar
confirma «Empieza a contar hoy para todos tus clientes». Alargar/apagar directo.
Edición guarda por ruta propia al cambiar; creación retiene borrador y ejecuta
PUT /expiry después de activar el programa. Fallo parcial muestra error y vuelve
al paso para reintentar solo la regla, sin duplicar creación. State_changed relee
el programa, conserva borrador del editor y muestra mensaje del servidor.
Permisos y errores 401/403 mantienen el manejo existente; el GET actual requiere
loyalty. Ningún cambio al tour ni a la ruta/formulario del programa.

Node 24.20.0, salida 0: typecheck merchant y consumer, ESLint ambos paquetes +
e2e, Prettier ambos paquetes + docs, guardia UI y diffcheck. CI main verde
4c40a6a consultado. E2E Chromium 30/30: diez nuevos (incluyen cuatro capturas) y
veinte regresiones de estados/validación/CSS. Rutas simuladas con page.route;
sin pruebas contra producción. [Capturas 390 y evidencia](../qa/0195/README.md).
Reporte local `/private/tmp/0195-report/index.html`. Claro por defecto;
oscuro inspeccionado forzando data-theme, con el aspecto existente del kit.

PARQUEADO: U1–U3 en PROD, cerradas por el owner; U4 hecha con SHA; U5–U6 retiradas.
Spec 0195 registra alcance actualizado y SHA al pie. Pendiente revisión local
del owner. Login por código 0202 ya está en dev (`c59ef50`, cierre `4b7eab4`),
con QA en PWA iPhone todavía pendiente. Main no incorpora estas dos UIs nuevas.

## HISTÓRICO — 0202 LOGIN DEL OWNER CON CÓDIGO, UI COMMITEADA EN DEV (2026-10-11)

Commit UI `c59ef5047103365277af02550ee7e23b8bbfea82`. Pedido del owner: solo pantalla; sin push ni merge.
API de Claude `2e2e0dc` ya disponible. No se tocaron `src/app/api/`, `src/server/`,
el kit ni tooling; pendientes ajenos preservados.

Login por email → código de seis números, `inputMode="numeric"`,
`autoComplete="one-time-code"`, `maxLength=6` y patrón de seis dígitos.
`MagicLinkState` y etapa `magic-link` reemplazadas por `LoginCodeState`/`login-code`.
Verify con navegación completa a destination; errores del servidor; reenvío al
mismo email con confirmación y campo limpio; bloqueo diario sin reintento ni
reenvío; usar otro email vuelve atrás. Alta y verificación conservan sus enlaces.
Contrato de errores UI ampliado en `_lib/contracts.ts`.

Verificación real, Node 24.20.0: typecheck merchant, ESLint paquete merchant + e2e,
Prettier paquete merchant + archivos nuevos, guardia UI y diffcheck en 0.
E2E Chromium 10/10: siete de login (incluyen dos de capturas) y tres regresiones
de alta. [Evidencia y cuatro capturas 390 claro/oscuro](../qa/0202/README.md).
Prueba de navegador con API real, base Docker local y cuenta sembrada:
pedido 200, código en asunto de `email_console`, verify 200, navegación a
`/backoffice` y sesión persistida (`authenticated: true`). Sin correo real ni
base de producción. Merchant local queda en http://localhost:3101 para revisión;
log `/private/tmp/0202-merchant-server.log` y reporte `/private/tmp/0202-report/index.html`.

INDEX 0202: «API + UI implementadas; QA del owner pendiente».
Pendiente: owner prueba PWA instalada en iPhone y sugerencia real del código de
Mail. El oscuro se inspeccionó con `data-theme="dark"`; layout conserva claro
por defecto. Main local tenía el merge previo documentado en `035fd66`; esta UI
nueva está solo en dev. No hubo push, merge ni deploy.

## HISTÓRICO — 0204 FIDELIZACIÓN FUNCIONAL Y COPY LOCAL (2026-10-11)

Commit4469753, reservae5055c2. Owner pidió auditoría de /programa-de-fidelizacion para lograr lo mismo que marketing: estructura, visual y copy Funcional. Aplicada localmente, QA owner pendiente; sin autorización para publicar.

Hero «Puntos o sellos. Motivos para volver.». Secuencia QR/compra acreditada/canje confirmado por equipo; transición e historial compactos; reglas por modalidad y ejemplos3/6 y30 puntos preservados. Previsión ahora compara$30 de consumo con$3 precio de venta del premio, sin «quedan $27» ni sugerir ganancia. FAQ conserva alcance sin costos/margen. Habituales en Mostrador; programas, saldos y registros separados; cashback Próximamente. No cambia backend, funciones ni condiciones. CSS exclusivo program-page, sin stylesheet viejo; guía/PRODUCT/sidecar actualizados, POS queda pendiente.

Node24: typecheck público, ESLint específico, formato, diffcheck y números0. Build público0; landing17/17 en13.1s (home, negocios, marketing preservadas y4 nuevos casos de fidelización). Capturas1440/390 claro/oscuro,320/768 claro vistas: ocho secciones,17px, sin overflow/errores JS/anclas rotas; salto al contenido y FAQ teclado6/6. Evidencia /private/tmp/0204-review.json,0204-after-*.png,0204-e2e.log y0204-build.log. Altura5255→3639 desktop;7655→5957 móvil390. No evidencia de conversión o comprensión. CI main verde4c40a6a consultado.

Detector0 primarios y25 advisory compactos/responsive; Arial conservado por filosofía aprobada, ignore-value estrecho programa.css. Sin ignore-file/rule. Auditoría inline ADR0129, sin revisor independiente. Fuente de producto: spec0191 y reglas/programa/previsión leídos, no editados.

Preview http://localhost:3003/programa-de-fidelizacion. Home0201 hero intacto y aprobado; negocios0200 aprobado; marketing0203 aplicada, QA owner pendiente. Sin push, merge, deploy ni verify global. Cambios paralelos de Claude preservados. Próximo paso: revisión owner de fidelización, o auditoría POS si la solicita.

## HISTÓRICO — 0203 MARKETING FUNCIONAL Y COPY LOCAL (2026-10-11)

Commit9e5b119, reserva441180f. Owner pidió analizar y mejorar estructura, visual y copy de /marketing-para-comercios con la filosofía de /negocios. Implementación local, QA owner del ensamblado pendiente; sin publicar.

Hero centrado en nuevos clientes y regreso; demostración de Bienvenida, campañas por audiencia y condición, pasos compactos, dos situaciones de Impulso, FAQ más directas y cierre contenido. Condiciones2km/rubros, permiso/compatibilidad push, independencia de POS, planes y prueba3 meses conservados. Copy contrastado con spec0192 y reglas locales de marketing leídas; sin tocar backend ni prometer visitas garantizadas. CSS exclusivo marketing, importación del stylesheet viejo retirada de esa página; herencia global de fuente/cierre corregida dentro del scope.

Typecheck público, ESLint específico, formato, diffcheck y números0. Build público0; landing13/13 en12.7s, conserva home/negocios y agrega4 casos marketing. Capturas1440/390 claro/oscuro,320/768 claro vistas: seis secciones, sin overflow, errores JS o anclas rotas; salto al contenido y FAQ por teclado6/6. Texto17px en los seis. Evidencia /private/tmp/0203-review.json,0203-after-*.png,0203-e2e.log y0203-build.log. Altura desktop3777→3244px, móvil5259→4939px; no evidencia de conversión. CI main verde4c40a6a consultado.

DESIGN/PRODUCT y sidecar actualizados; marketing adopta Funcional, fidelización/POS todavía pendientes. Arial preservado por filosofía aprobada; ignore-value estrecho marketing.css. Detector0 primarios,24 advisory de variantes compactas/responsive; sin ignore-file ni ignore-rule. Auditoría inline ADR0129, no estudio de usuarios ni revisión independiente.

Home0201 aprobada por owner, hero intacto; /negocios0200 aprobada intacta. Preview http://localhost:3003/marketing-para-comercios. No push, merge, deploy ni verify global. Mantener cambios paralelos de Claude en auth, tooling y su estado. Siguiente paso: QA owner del marketing, o revisión de otro producto si la solicita.

## HISTÓRICO — 0201 HOME FUNCIONAL LOCAL, HERO IDÉNTICO (2026-10-11)

Commit5da3c84, reserva437c39f. Owner confirmó /negocios Funcional y pidió extender el diseño a la home, excluyendo explícitamente su hero. Sin autorización para publicar.

Home debajo del hero aplicada: pasos numerados compactos, demostración HTML de pase identificada como ejemplo, programa ilustrativo de6 sellos, CTA comercial contenido, FAQ y footer alineados. Conserva orden, copy principal, enlaces y avisos ilustrativos. Scope consumer-content; header, hero, metadata e imagen preservados. Captura de hero idéntica por SHA256 en1440/390 claro/oscuro,320/768 claro (6/6).

Typecheck público, ESLint específico, formato y diffcheck0; build público0. Suite landing9/9, última corrida11.2s. CI main verde4c40a6a, comprobado; no publicación de estos commits. Cuerpo sin overflow6/6, sin errores JS, FAQ teclado6/6. Persiste desborde preexistente5px del hero a320px, excluido del alcance. Fuentes secundarias y foco del CTA con contraste calculado y foco real verificado claro/oscuro. Evidencia /private/tmp/0201-before-review.json,0201-after-review.json,0201-e2e.log y0201-build.log.

DESIGN y PRODUCT actualizados: adopción de home parcial, excepción de hero/header, productos aún pendientes. Sidecar actualizado. Detector0 primarios,36 avisos de variantes tipográficas y estilos preservados; Arial ignorado solo en consumer-home.css por elección aprobada, sin ignore-file ni ignore-rule.

/negocios Funcional spec0200 permanece aprobada, intacta: Conecta destacado cálido, Impulso neutral, sin corazones. Home y negocios disponibles en http://localhost:3003. Próximo paso: QA owner de home, o revisión de páginas de producto si la solicita. Sin push, merge ni deploy. Mantener intactos los cambios paralelos de Claude en merchant/auth, tooling y su estado.

## HISTÓRICO — 0199 IMPLEMENTADA LOCAL; QA OWNER DEL ENSAMBLADO PENDIENTE (2026-10-11)

Implementación local9f4e3c5. El barrio conectado elegido y confirmado por owner.
Spec0199 reserva890a37e,
recursosf2bee16. Cuerpo /negocios REEMPLAZADO: mapa e invitación, QR/premio sobre
mesa, tablet y paneles POS, inicio compacto, planes, cinco FAQ y cierre verde.
Burbujas rectangulares completas con icono a izquierda según nota del owner.
Todas las referencias visibles a ejemplo retiradas solo de /negocios.
Hero aprobado preservado, burbuja Café y sin disclaimer. Home y páginas de
productos preservan defaults; export antiguo de previews conservado.
URL REAL del ensamblado: http://localhost:3003/negocios. Sin publicación.

Plan/recursos aprobados en navegador y chat «aprobado»:
session07814800c7438f3d7eb890741a4965d08a0583cea2d4409c2b080ca7d8ef63bc,
revision3cc9cc3c35f01b29749200b09ec171d295fa84016018e2a74d0f4436513cd873.
Referencia actual .impeccable/mocks/completa/barrio-burbujas-integradas.png,
corregida a pedido del owner, vista y guardada. Tres plates nuevas aprobadas
con prompt embebido, public/images/negocios-{neighborhood,reward-scene,service-scene}.
No crops enviados a producción, sidecars con evidencia de aprobación real.

Node24: tipos/ESLint/formato0, diffcheck0, numeración0. Landing final9/9 en10.5s,
/private/tmp/0199-e2e-final.log; build público final0,
/private/tmp/0199-build-final.log. Capturas1440/390 claro/oscuro vistas, sin
pageerrors ni overflow. Scan de provenance3/3 sin faltantes. Revisión inline L2,
sin subagentes, DB/Neon/adversarial o verify global. Detector sin hallazgos.
Comp-diff76% drift; corrección de encabezado, orden móvil y planes/FAQ hecha.
Quedan diferencias de tamaño/posición de burbujas, paneles y cierre; ningún módulo
omitido. No afirmar igualdad pixel a pixel ni aprobación del sitio ensamblado.

IMPORTANTE workflow helper: spec65 regiones y26 textos medidos. Medición de
fuentes después de aprobación cambió hash de spec: recibo técnico stale aunque
recibo REAL de recursos sí existe y owner aprobó. Se continuó bajo esa aprobación
explícita, sin nueva solicitud redundante, sin fabricar recibos ni forzar gates.
Plates sigue abierto, hero/sections/motion/responsive pendientes en helper;
finish ship rechazado por fases abiertas. Cierre del helper pendiente de resolver
stale o aceptación real del ensamblado; no certificarlo completo.
QA OWNER del sitio completo pendiente. No nueva ronda de elección de diseño.

No push/merge/deploy. No commitear instalación ni helpers/capturas temporales.
CI main9405c93 rojo histórico por screenshots tmp, fix local4f37e70 ya existente.
Siguiente: owner revisa localhost; aceptar/corregir solo hallazgos concretos.
Para publicación se necesita autorización expresa y verify previo.

## ⇥ 0197 IMPLEMENTADA LOCAL, APROBADA POR OWNER (2026-10-10)

Home / dirigida a consumidores con escena ilustrativa, tres burbujas HTML (sin
dispositivo Mi pase flotante), explicación QR→acumular→canjear, acceso a pase,
ejemplos, CTA comercial y FAQ. /negocios conserva contenido y diseño previo; SEO
propio, anclas de planes y accesos por audiencia ajustados. PRODUCT actualizado.
Spec0197 reservada132ac2e; implementación71a7f91 en dev, sin merge/push/deploy.

Owner aceptó el plan y assets en navegador (ronda2) y confirmó en chat.
Session07814800c7438f3d7eb890741a4965d08a0583cea2d4409c2b080ca7d8ef63bc,
revision d1645304c943c9abaab37ca5f61943d322dd49254f130badbafd65a8a3d88942.
Referencia aprobada ejemplo-visita-notificaciones.png y sidecar con evidencia.
Impeccable build state se reinició sobre esa variante. Su gate reporta revisión
no aceptada tras remeasure de fuentes, aunque status/verify confirma aceptación
real; no se fabrica recibo ni se repite aprobación del plan. Ensamblado NextTSX
verificado con Playwright real. Workflow helper no se declara completado.

Verificación Node24 real: typecheck y ESLint públicos salida0; build público
salida0 (final /private/tmp/0197-build-final.log); Playwright9/9 (13.5s), segunda
corrida tras corregir Arial heredado; configtemporal
/private/tmp/checkpass-0197-playwright.cjs sin servidores compartidos/DB.
Capturas 390/1440 claro/oscuro vistas en /private/tmp/checkpass-0197-results.
Sin overflow ni pageerrors. Numeración y diffcheck correctos. Sin tests Neon.
No verify global: corresponde al paso live ADR0128/0129.

Servidor para owner: http://localhost:3003, execsession75652.
Owner aprobó la revisión local del sitio ensamblado: «ok, me parece bien».
QA local de0197 cerrada. /negocios y / quedan disponibles.
Pendiente: publicación, con autorización explícita y verify previo.
CI remoto main9405c93 sigue rojo histórico por screenshotsPOS /private/tmp,
fixlocal4f37e70 previo existente, no regresión introducida por0197.

No commitear archivos de instalación .agents/.claude/.codex/.github ni otros
comps exploratorios, assets/plates duplicados o sesiones helper temporales.
Pendientes0196 Stripe/verifyglobal siguen en el bloque siguiente.

## ⇥ U1–U3 IMPLEMENTADAS EN DEV (2026-10-10)

Rama local `dev`. SHA del trabajo UI: `8611689` (spec 0196). Correcciones E2E:
`da78bbc`. Reserva de spec: `d2b49f6`. Trabajo público anterior: `60590de`.
Sin merge ni push; producción sin cambios.

Owner pidió landing.spec.ts y ticket-settings.spec.ts verdes antes del commit:
selector Cómo empezar acotado a #contenido, título con barra escapada y capturas
con testInfo.outputPath. Pasaron 7/7 antes de `da78bbc`. Corrida final conjunta
con billing-ui.spec.ts: 18/18, `/private/tmp/0196-e2e-final.log`.

U1: Conecta/Impulso (base/plus), períodos y precios de GET billing/state; checkout
con plan/interval/from; cambio confirmado con explicación del cobro; cancelación
al final del período y reanudación. Recibos y reconciliación conservados. Red,
402 y 409 permiten corregir/reintentar; topes enlazan Locales/Campañas.
U2: etiquetas del plan Free/Gratis retiradas del panel, home y cancelación.
U3: días de prueba del contrato de sesión; bloqueado solo suscripción y salida,
sin navegación/checklist; rebote payment_required del personal explicado. La
suspensión del negocio conserva prioridad. Kit existente, sin CSS ni API nueva.

Verificación real Node 24: billing UI 11 E2E; layout 4/4, entrada 2/2, guardias
layout 5/5, pruebas de cobro existentes 12/12. Vistas capturas 390/1440 sin
overflow. Mutaciones M1 (checkout sin plan) y M2 (baja inmediata) rojas por su
aserción y revertidas con SHA256 idéntico. Bitácora /private/tmp/0196-mutations.md.
Typecheck/lint/ui-guard finales correctos; numeración y diff --check correctos.

pnpm verify --base HEAD ejecutado una vez: tipos, lint, ui-guard, formato,
2465 unitarias y build de las 4 apps correctos. ROJO: E2E general no arranca por
Next dev existente en 3200/3201; Neon related 37/41 inicial por etiqueta Plan Plus
anterior. Textos esperados actualizados y suite fallida repetida por
 tools/neon-test.sh src/server/billing-reconcile-page.neon.integration.test.ts:
5/5 en CI. No se repitió todo verify ni se afirma verde. Registros
/private/tmp/0196-verify.log y /private/tmp/0196-neon-recheck.log. Tres suites E2E
usaron configuración temporal sin webServer y public3003 existente. Tipos Next
generados por build restaurados antes del commit.

Zona Claude: solo cambios mecánicos de textos/campos en cuatro pruebas de cobro,
por §6 de TRABAJO-EN-PARALELO. Sin tocar servidor, kit, API ni tooling.
Handoff D9 a Claude: la UI usa Conecta/Impulso; planLabel del servidor conserva
Base/Plus en sus mensajes y puede alinearse en su zona.

Pendiente: QA owner con Stripe real y desbloquear gate E2E general antes de live.
U4–U6 de PARQUEADO esperan que el owner mergee 0195; no implementadas.
La sección U1–U6 se recuperó desde spec-0195 en PARQUEADO, preservando sus filas.
Los bloques siguientes son históricos, no describen el estado actual.

## ⇥ 0192 — REVISIÓN UX APLICADA, LOCAL (2026-10-10)

Owner pidió agente independiente y aprobó recomendaciones. Informe antes en
/private/tmp/0192-ux-review.md. Hero sustituye NetworkPreview por una invitación
compacta. Campañas con condición→beneficio y párrafos reducidos; estilos propios
marketing.css, sin plan-card/plan-grid. Eyebrow «Campañas automáticas para tu
negocio», títulos más concretos, Impulso compacto, pasos/FAQ/CTA conservados.
Componente compartido NetworkPreview y landing intactos.

Verificación real: typecheck public/lint/formato/diff0. Agente revisó Chromium3003
390/1440 claro/oscuro: HTTP200,H1 único,canonical/anclas, sin overflow/pageerror.
Hero desktop886→609px; móvil1427→848px. Gráfico745→260pxdesktop,757→201mobile;
flows114pxdesktop,110/134mobile, labels16px. JSON /private/tmp/0192-ux-after.json.
Capturas /private/tmp/0192-after-{hero,campaigns}-{390,1440}-{light,dark}.png;
root inspeccionó hero escritorio claro y campañas móvil claro. Informe posterior
/private/tmp/0192-ux-after.md. QA owner pendiente; sin suite/verify, commit/merge/push.

## ⇥ 0191 — CONSISTENCIA CON LANDING COMPROBADA (2026-10-10)

Owner pide pasada de colores/tipografía/tamaños respecto a landing. Medición
Chromium de estilos calculados en ambas rutas390/1440 claro/oscuro: hero, Arial,
body, pesos/interlineados, CTA/enlaces, labels y header ya coincidían. Diferencias
corregidas en programa.css: títulos de split56/36→escala heredada65/41; radios de
paneles12 como POS landing; tarjetas1.7 de interlineado; elimina verde oscuro propio
#244638 y usa color-mix naranja10%/paper que ya usa landing. Variables base iguales.
Selectores huérfanos de notas/encabezados retirados. Pase ampliado aprobado conservado;
transición compacta y cifras de cálculo mantienen jerarquía propia intencional.

Verificación final real: /tmp/0191-consistency-final.json, 4 comparaciones pares
(claro/oscuro390/1440) sin diferencias en tokens/h1/h2 principales/body/CTA/link/
kicker/header, HTTP200 y sin overflow/pageerror. Capturas completas ambas rutas
/tmp/0191-consistency-{landing,program}-{390,1440}-{light,dark}.png. Vistas landing
escritorio claro y programa escritorio claro/móvil oscuro. Typecheck public/lint/
diff0; Prettier de CSS/spec. Sin suite/verify ni commit/merge/push, QAowner pendiente.

Último visual atención aprobado: solo paseQR, 300pxdesktop/260mobile, logo64 y
QR156/128. Escena de productos/leyendas retirada; también quitada leyenda de cuenta.
Cálculo30→3→27, modalidades6sellos→café/30puntos→café. Server3003 activo y responde.

## ⇥ 0191 — ESCENA DE ATENCIÓN EN PRUEBA (2026-10-10)

Owner rechazó vista simplificada de Mostrador; aprobó escena con menos texto:
«Sus favoritos, a mano», paseQR→café y empanada, frase «Identifica al cliente y
encuentra lo que suele pedir». Aplicada con HTML/CSS y SVG Iconoir. Copy de la
sección conservado. Supersede visual anterior, sin capturas ficticias de producto.

Checks reales Node24: typecheck public/lint/diff0; Prettier aplicado. Localhost3003
HTTP200, H1/canonical/anclas, sin overflow/pageerror390/1440. Captura móvil de
escena vista /tmp/0191-history-390.png; también generada1440. QA owner pendiente.
Sin suite/verify ni commit/merge/push. Servidor público3003 sigue activo.

## ⇥ 0191 — ATENCIÓN CON UI DE HABITUALES, LOCAL (2026-10-10)

Owner pide visual coherente con atención personalizada. Aplicada ilustración
simplificada de Mostrador: cliente identificado, Habituales de este cliente en
bloque destacado superior, resto del catálogo debajo. Basada en sale-forms.tsx
(sección habitual) y CSS merchant existente, sin tocar merchant/kit. No es captura
real ni promesa de habituales en editor POS, que todavía pasa lista vacía.
Investigación NN/G imagery-in-visual-design prioriza visuales informativos.

Localhost3003 fue reiniciado por pedido explícito owner: antiguoPID67362 no liberó
lock con TERM, cerrado con KILL; Next webpack actual sesion88478 activo. HTTP200.
Typecheck public/lint/diff0 y formato. QA390/1440 en3003: HTTP200, H1/canonical,
anclas, sin overflow/pageerror. Capturas /tmp/0191-history-{390,1440}.png vistas.

Cambios iterativos previos conservados: leyendas retiradas, cálculo30→3→27 sin
porcentajes; reglas simplificadas6sellos→café y30puntos→café; encabezado hero
retirado. Sin suite/verify ni commit/merge/push. Capturas reales demo y QAowner
pendientes. Representaciones son ilustraciones, no clientes/operaciones reales.

## ⇥ 0191 — HERO EN CUADRÍCULA, LOCAL (2026-10-10)

Owner pidió retirar nota del hero, más separación entre encabezado y título, y
texto mayor o foto/cuadrícula con criterio UX. Elegida cuadrícula informativa
con NN/G imagery-in-visual-design: QR/entrada protagonista, acumulación y canje.
Encabezado «Lo que antes quedaba en un cartón / Una historia que puedes seguir»
con gap18 y título28–36; tarjetas con títulos23–29, texto16/1.65 e iconos mayores.
Nota inferior retirada. Sin foto decorativa ni métricas inventadas.

Typecheck public/lint/diff0 y Prettier aplicados. Copia temporal3013 actualizada:
HTTP200, H1 único/canonical/anclas, sin overflow/errores390/1440; capturas hero
/tmp/0191-hero-{390,1440}.png vistas. Diseño legible y espacio aprovechado con
bloque grande superior y dos inferiores; móvil en columna. Server3003 sigue
agotando curl10s0bytes, por tanto owner puede estar viendo versión anterior.
Sin reiniciar3003, sin suite/verify, commit/merge/push. Servidor QA3013 detenido.

## ⇥ 0191 — REVISIÓN UX APLICADA, LOCAL (2026-10-10)

Owner pidió agente UX/UI independiente y aprobó sus propuestas. Informe en
/private/tmp/0191-ux-review.md; auditoría previa sustentada en código e investigación,
sin render porque localhost3003 agotó espera. Implementación: hero nombra puntos y
sellos; transición breve; reglas con ejemplos visuales en dos columnas y cashback
secundario; cálculo $50→$5 con 10% destacado; historial ilustrativo y diagrama de
una cuenta con dos programas/saldos separados. Títulos concretos, sin filas de
3 tarjetas. CSS propio programa.css, paleta adaptada a modo oscuro. Conservadas
las dos eliminaciones de copy pedidas por owner. Sin capturas demo verificables:
esquemas explícitamente ilustrativos, no supuestas capturas reales.

Checks reales Node24: typecheck public, lint de página, Prettier y diff --check 0.
Localhost3003 volvió a agotar 30s. Para QA, copia exacta temporal de app en
/private/tmp/0191-public-qa con Next webpack3013, sin reiniciar servidor compartido.
HTTP200, H1 único, canonical propio, sin anclas rotas, overflow ni errores de página
390/1440 claro y oscuro. Capturas /tmp/product-programa-de-fidelizacion-{390,1440}.png
inspeccionadas, además móvil oscuro; diagramas y cifras legibles, composición vista.
QA owner en entorno habitual3003 y capturas reales demo pendientes. Sin suite ni
verify global; sin commit/merge/push. Material actual conserva scope Mostrador para
productos habituales y previsión consumo/precio de venta, no margen por costos.

## ⇥ 0191 — REENFOQUE APROBADO, LOCAL (2026-10-10)

Owner aprobó sustituir la repetición de landing por origen para comercios de
barrio, actividad registrada, reglas de sellos/puntos, previsión antes de activar,
historial y una cuenta común con programas/saldos/datos separados. Aplicado en
programa-de-fidelizacion/page.tsx; retirados LoyaltyJourney y pasos de preparación
repetidos. Metadatos propios actualizados; CTA y precios conservados. Ejemplos
explícitamente ilustrativos, sin capturas ficticias de producto ni clientes reales.
Cashback Próximamente. Productos habituales mencionados en Mostrador, donde
existen; no prometidos durante edición de pedidos POS.

Previsión aprobada: consumo necesario frente a precio de venta del premio.
Ejemplo 1 punto/$1, premio $5 por 50 puntos: $50 de consumo, premio equivalente
al 10%. No llamarlo margen real: faltan costos y gastos. FAQ explica alcance.

Checks reales con Node 24: typecheck public, eslint de página y diff --check en 0;
Prettier aplicado. Revisión Chromium intentada a 390/1440: sandbox bloqueó el
inicio; repetida con escalación, navegación agotó 30 s esperando localhost:3003.
El puerto tiene un proceso escuchando, pero la página no respondió a la sonda.
No se afirma QA visual nuevo; capturas anteriores pertenecen a la versión previa.
QA visual owner y capturas reales de demo pendientes. Sin suite ni verify global,
sin commit, merge ni push; cambios previos del árbol conservados.

## ⇥ 0191–0194 — PÁGINAS DE PRODUCTO Y SEO LOCAL (2026-10-10)

Tres agentes por autorización del owner crearon rutas independientes de fidelización,
marketing y POS. Root revisó contenido, integró enlaces y sitemap, ajustó footer para
anclas de raíz y crédito de foto solo en landing. Metadatos de raíz actualizados y
WebSite añadido. Precios expresamente conservados; cashback Próximamente.

Typecheck public/merchant/consumer y lint afectados en 0. HTTP 200, H1 único,
canonical propio, anclas válidas, sin errores de página ni overflow en las tres rutas
a 390/1440 con Chromium. Se inspeccionaron seis capturas /tmp/product-*-{390,1440}.png.
No se corrió suite de tests ni verify completo para estas páginas informativas.

Noindex aplicado a layouts raíz merchant/consumer; comprobado en HTML local de
onboarding y raíz consumer. Admin es zona Claude: encargo concreto y siguientes
pasos en docs/plan-seo-merchant-2026-10-10.md. Noindex global de respuestas no HTML,
validación producción y retirada de índices siguen pendientes. Sin merge ni push.

Capturas de producto aún por preparar con datos demo, para páginas interiores:
editor/pase en programa, campañas en marketing, catálogo/mesas/pedido en POS.
Imagen social pendiente. No hay casos reales: no inventarlos. QA owner pendiente.
La landing conserva los ajustes iterativos aprobados sin commit aún.

## ⇥ 0188 (2026-10-10) — LANDING EN DEV, QA LOCAL

Ajustes de copy L0 aprobados por el owner, aplicados localmente sin commit aún:
hero «Atrae nuevos clientes y dales motivos para volver», eyebrow «PARA COMERCIOS
LOCALES», descripción en lenguaje concreto y «Empezamos en Cuenca». Franja con
personas/regalo/reloj: Atrae nuevos clientes, Motívalos a volver y Ahorra tiempo al
atender, cada uno con la descripción aprobada. Tres columnas en escritorio y los
tres beneficios visibles en una columna móvil. Por indicación del owner no se
corren tests para estos ajustes; QA visual en localhost a cargo del owner. La
aserción existente del título se actualizó mecánicamente, sin ejecutar E2E.

Iconoir aplicado en toda la landing por pedido del owner: franja (Group, Gift,
Clock), flechas, confirmaciones, listas de planes, plus de FAQ y sellos ilustrados
(Circle). Dependencia directa iconoir-react 7.11.0 en public, misma versión que
merchant; lock actualizado sin descargas. Sin SVG de iconos hechos a mano ni
glifos usados como iconos. Marca y números ilustrativos conservados. Typecheck
public y lint de componentes en 0; sin E2E ni revisión visual automatizada: owner
comprueba en localhost. Cambios locales todavía sin commit.

Gráfico de red actualizado según opción aprobada por owner: tres momentos con
María/peluquería → regalo destacado de café → motivo para visitar tu cafetería.
Iconoir Scissor/User/Gift/CoffeeCup y flechas; se eliminan rubro, distancia y Cuenca
del gráfico. Nota explícita de ejemplo ilustrativo y beneficio elegido por negocio.
QA visual pendiente del owner en localhost; sin E2E para este ajuste.

Owner reemplaza la historia individual por diagrama de convergencia: grupos de
personas en gimnasio/peluquería/veterinaria → café de bienvenida → tu local.
Grupos Iconoir arriba, conexiones CSS, regalo central y destino «Nuevas personas
descubren tu negocio / Más oportunidades de recibir nuevos clientes». Sin métricas
ni visitas garantizadas. Tres fuentes visibles también en móvil; QA local por owner.

Owner aprueba reordenamiento de contenido L0 sin tests: sección Programa de
recompensas antes de la red, explicando QR, puntos/sellos y canje de premios.
La sección de red conserva pregunta y gráfico, integra canal de avisos al teléfono,
campañas automatizadas y Venta cruzada como ejemplo para atraer nuevos clientes.
CampaignSection y seis tarjetas retirados de la landing; archivo conservado.
Texto de futura página del programa ubicado en su propia sección, sin enlace aún.
Asersión de tarjetas actualizada mecánicamente, sin corrida; QA visual por owner.

Owner pide probar secuencia visual del programa: mismo pase digital con 0, 3 y
6 sellos, QR ilustrativo Iconoir al unirse y regalo disponible al completar.
Escenas Se une / Avanza hacia su premio / Disfruta su recompensa conectadas por
flechas horizontales en escritorio y verticales en móvil. Sustituye los tres
bloques textuales de fidelización. QA local por owner, sin ejecutar tests.

Último ajuste aprobado: owner descarta tres pases similares. Secuencia simplificada
con escenas distintas (celular frente a QR, tres sellos grandes, café de recompensa),
sin tarjetas ni texto pequeño. Título y una frase por escena, Iconoir y flechas.
QA visual por owner en localhost; sin tests. Los diseños anteriores son históricos.

Ilustración POS sustituida por teléfono central con pedido, mesa, cliente y cobro;
acompañan catálogo desde foto/PDF con IA, mesas y recompensa +1 sello. Solo SVG
Iconoir, sin leyendas de ejemplo ni datos reales. Adaptación responsiva de la
composición. QA visual del owner en localhost, sin tests.

Última propuesta POS aprobada: cuadrícula de cinco bloques de tamaños distintos,
Pedidos/cobros protagonista, Catálogo IA, Mesas, Fidelización y Tickets. Reemplaza
composición alrededor del teléfono. Iconoir, poco texto y paleta propia; en móvil
pedido a ancho completo y cuatro bloques en dos columnas. QA en localhost por
owner, sin tests ni publicación. Los previews anteriores son históricos.

Trabajo del owner implementado en `84df923`, después de reservar spec cerrada en
`b101434`. Rama dev; sin merge a main, push, publicación ni cambios de billing.
Se conserva el lenguaje visual de la landing y se reordena: hero, red, campañas,
POS/mostrador, tres pasos, cliente, planes, FAQ y CTA. SEO alineado con red en
Cuenca; enlace a /explorar y redirect /negocios conservados. Previews de red y POS
son ilustrativos; no inventan métricas, clientes reales ni QR de tickets.

Hero recomendado «Más clientes nuevos. Más razones para volver.»; antes de código
se propusieron también «Tu negocio de barrio, con herramientas de gran cadena» y
«Que te descubran. Que vuelvan. Que tu negocio crezca», con bajadas y copy completo.
Planes recomendados Conecta/Impulso; alternativas Club/Club Pro y Esencial/Crece.
Propuesta visual $20 (1 local), $45 (hasta 3), $12/local adicional, todos USD/mes,
con nota referencial. CTA «Pruébalo gratis 3 meses», todo incluido; sin prometer
que no requiere tarjeta. POS fuera de columnas; no se decide su asignación.

Verificación real: typecheck public, lint public/prueba, formato de cambios y
git diff --check en 0 con Node 24. E2E 4/4 a 390 y 1440 px, claro/oscuro;
última corrida con servidor Next levantado/cerrado por la propia suite, 5.1 s,
log /tmp/0188-landing-autonomous.log. Capturas hero/red/POS/planes inspeccionadas.
La revisión visual detectó columnas móviles heredadas y recorte oculto: oráculo
nuevo rojo por ancho 183.921875 < 292.5 y luego verde con una columna y gap fijo;
log /tmp/0188-mobile-regression-red.log. Contraste secundario oscuro corregido.
No se corrió verify completo ni se afirma CI remoto verde; gates específicos L2
según encargo y ADR 0129. Artefactos en test-results/landing-*.

Antes de landing se arregló CI de nuestra zona en `4f37e70`: capturas POS,
impresión y mesas pasan de ruta macOS /private/tmp a /tmp portable. E2E 116/116,
20.8 s, lint/formato/diff en 0; log /tmp/0187-ci-portable.log. Pendiente confirmar
Linux en CI cuando exista push autorizado; no se tocaron tooling ni tests de API.

QA del owner: abrir http://localhost:3003 (pnpm dev:public). El modo oscuro sigue
el esquema del sistema. Los CTA conservan onboardingUrl; esta tarea no cambia
el alta real ni concede un trial. El ambiente merchant/consumer continúa aparte.

**Antes de live:** Claude debe implementar la prueba de 3 meses y Venta cruzada en
el plan base (hoy alta free y campañas plus), salvo excepción explícita del owner.
Owner debe confirmar nombres, $45, $12/local y en qué plan va POS. Precios finales,
cobro y publicación son dependencias externas; aquí solo propuesta local. Kit,
API, servidor y DB intactos. QA visual del owner pendiente.

## ⇥ MAIN LOCAL — HISTÓRICO: MESAS MERGEADAS, SIN PUSH

Owner autorizó merge a main. Árbol limpio; fetch confirmó main/origin main
9405c93 como ancestros de dev. Fast-forward local ejecutado hasta 869e65c,
incluyendo 0187 y ajustes del owner. Sin conflictos, push ni publicación.
Este registro se commitea en dev y se incorpora por fast-forward de docs;
se deja checkout main para QA del owner y se restaura el ambiente local.

Gates acumulados reales: typecheck/lint/guard/formato/unit2458/build verdes;
Neon related merchant 4/4, consumer omitido sin cambios; E2E final 298 passed
y 21 skipped, 1.3 min, salida 0. Verify inicial devolvió ROJO porque el ambiente
local impedía levantar otros Next; se detuvo temporalmente para repetir E2E.
La corrida real encontró un oráculo de impresión sin la nueva lectura de mesas;
869e65c añade mock y espera esa lectura antes del baseline, manteniendo la
igualdad estricta de fetch durante impresión. Printing15/15 y E2E completo
posterior verdes; lint/formato de prueba en 0. Sin modificar printing ni API.

Detalle, tabla y logs en docs/preparacion-main-2026-10-10.md. No se afirma
una segunda corrida de verify completa ni CI remoto verde. Sin migración PROD:
0067/0068 ya aplicadas. QA main local por owner y push live quedan pendientes.

## ⇥ 0187 (2026-10-09) — HISTÓRICO: MESAS EN DEV LOCAL

Ajuste visual en 8cdb050: eliminado «Mesa seleccionada» del paso 1 y prop
redundante del selector. Chip elegido con borde accent de 1 px y accent-soft,
sin ring. Capturas de paso 1 y modal vistas; captura inicial finaliza animaciones
para medir el color final. E2E mesas 10/10 en 4.5 s y caso de captura repetido
en 0; typecheck merchant, lint de pantallas, guardia sin aumentos, formato
y diff --check en 0. Logs /private/tmp/0187-accent.log y
/private/tmp/0187-accent-capture.log. Dev local, sin merge/push ni cambios de kit.

Ajuste de texto en 3b1f37f: quitado el nombre del único local («Principal»)
debajo del selector del paso 1. Typecheck merchant, lint del archivo, guardia
sin aumentos, formato del archivo y diff --check en 0. Solo se eliminó copy;
no se repitieron E2E. Dev local, sin merge ni push.

Regla vigente del owner en d3fe5c4: Nombre de mesa solo cuando la consulta del
local confirma cero mesas, tanto nueva orden como Cambiar mesa. Sin input con
mesas configuradas, todas ocupadas o carga/error. Sin mesas, edición libre
conserva Guardar directo. Nueva orden con mesas requiere id; una orden antigua
libre no necesita reasignarse para editar productos, pero al cambiar mesa en
local configurado debe elegir una registrada. Eliminada alternativa Usar nombre.
Verificado: 101/101 E2E (10 mesas + 91 POS), 17.1 s; typecheck merchant,
lint de archivos cambiados, guardia de dos pantallas, formato global y diff
en 0. Log /private/tmp/0187-configured-tables.log. Casos todas ocupadas y error
sin fallback hasta confirmar lista vacía incluidos. Dev, sin merge/push;
API, kit y DB intactos. Los registros siguientes son históricos.

Último ajuste del owner implementado en fe5803b: modal Cambiar mesa muestra
libres y la propia, oculta las ocupadas por otras órdenes. Guardar reemplaza
Listo; deshabilitado sin cambios o selección inválida. PUT directo de mesa con
versión y productos confirmados; conserva aparte productos editados pendientes.
Éxito cierra y muestra toast; error literal dentro del modal conserva selección.
Verificado: 100/100 E2E (9 mesas + 91 POS), 17.3 s; merchant typecheck y lint
de archivos cambiados en 0; guardia de tres pantallas sin aumentos; formato
global y diff --check en 0. Captura móvil actual vista. Log
/private/tmp/0187-direct-save.log. Caché ahora usa productos como borrador;
texto libre comprueba fallo/reintento y conservación/guardado separado del
borrador de productos. Dev local, sin merge/push ni cambios API/kit/DB.

Ajuste posterior del owner: reserva 227a798, implementación 6851d7a.
Selector con chips como el badge, borde de 1 px y sin ring exterior recortado.
Cambiar mesa elimina «Mesa seleccionada» y «Usar nombre de mesa»; texto libre
se conserva en el paso inicial y al editar una orden que ya tiene nombre libre.
Ya no se ofrece desligar una mesa registrada desde ese modal. E2E actual
9/9 verdes, 4.4 s; typecheck merchant, lint de archivos cambiados, guardia de
dos pantallas y formato global en 0. Capturas nuevas del modal móvil/desktop
vistas; log /private/tmp/0187-chips.log. Sin cambios API/kit ni merge/push.
La evidencia de 99/99 más abajo corresponde al cierre previo al ajuste.

Encargo del owner leído completo, contrato 0182 y ADR 0131 completos. L2,
sin subagentes. Reserva local 5b4bb99; Locales eb54d1c, POS 550fab1,
pruebas y cierre 8a944ff. Checkout dev, sin merge ni push por instrucción
del encargo. API y migración 0067 ya en live: no se migró de nuevo.

Locales: Mesas junto a Editar con POS activo según sesión. Modal independiente,
solo activas, crear/renombrar/quitar con guardado inmediato y confirmación de
archivo. Busy impide dobles escrituras y cierre; respuestas tardías aisladas
por local; errores HTTP literales, toast compartido. Editar intacto.

POS: selección de mesas del local con ocupación; propia mesa elegible al editar.
POST con tableId, PUT con id o null explícito para texto libre. Dirty, descarte
y conflicto incluyen id; cambio a texto libre con igual nombre se detecta.
Ocupada/archivada refresca sin perder productos y permite volver a Mesa.
Fallo de lectura ofrece reintento o texto libre. Mesa elegida con borde y fondo
semánticos; no hubo cambios en el kit ni CSS.

Checks reales finales: typecheck seis paquetes en 0, lint global en 0,
format:check global en 0, ui-guard seis archivos sin aumentos, check-numbers
y diff --check en 0. E2e final 99/99 verdes (8 mesas + 91 POS), 17.4 s.
Los oráculos previos de caché siguen comparando sus endpoints originales y
cuentan aparte las lecturas nuevas. Corregido el heading posterior al POST del
wizard para esperar el pedido guardado, evitando pasar en la pantalla previa.

Capturas Locales 390/1280 y POS 390 vistas; evidencia, comando y QA en
docs/handoff-0187-mesas-locales-pos.md. HTTP simulado con UI/CSS reales:
persistencia real y QA owner pendientes. No se afirma verify global ni CI
remoto verde (ci:status al inicio no accedió por red). PARQUEADO #83 punto (1)
cerrado localmente; publicación pendiente. Server/API/kit/printing/DB/tooling
intactos. Cambio previo en apps/merchant/next-env.d.ts dejado fuera de commits.

## ⇥ MAIN LOCAL (2026-10-09) — HISTÓRICO: MERGE COMPLETADO, SIN PUSH

Owner entrega cierreClaude ef769b6 (Prettier14archivos, format:check/diff0 y
printing23/23) y estado4c9032b con árbol limpio. Comprobados commits/rutas,
main ancestro de dev. Merge --ff-only ejecutado: main3e26701→4c9032b, sin
conflictos ni push. Este registro se commitea en dev y se incorpora también
por fastforward a main; se deja checkoutmain para QA local antes de live.

Gates acumulados reales: typecheck/lint/guard/unit2458/build/Neon3256 verdes,
e2e completo final288/21skip verde, formato corregido/verificado por Claude.
Sin repetir suites por docs/formato; no se afirma segunda verify completa.
Owner informa0067/0068 YA aplicadas enPROD con snapshot
pre-0067-0068-2026-10-09 y SQL de integridad: no migrar de nuevo. EstadoClaude
confirma69migraciones y tablas/columna/índices/datos intactos.
Publicación no ejecutada: pushmain pendiente de OK y QAowner enmainlocal.

## ⇥ PREPARACIÓN MAIN (2026-10-09) — HISTÓRICO DEL GATE

Owner autoriza todos los commits y dev→main, live después. Notas ajenas pendientes
guardadas e1f685a con autorización de todos los cambios. Plan cierre3c4eab9.
Primera verify completa: typecheck/lint/guard30/unit2458/build/Neon3256 verdes;
formato14archivosClaude rojo; e2e270/18rojos. Detalle/tabla en
docs/preparacion-main-2026-10-09.md y log /private/tmp/checkpass-2026-10-09-pre-main-verify.log.

Corregidos los18fallos de navegador en500f8fa: selectorAyuda acotado a main en
3specs y8referencias Dialog revisadas conoverlay actual, sin tocar kit/relajar
tolerancias. Gate e2e completo repetido288passed/21skip,1.3m verde. Formato de
printing/API prohibido por encargo anterior: autorización consultada al owner,
sin respuesta aún. Main permanece3e26701; no merge/push. No afirmar verifyverde.
Entorno local detenido para gates y volviendo a levantarse en dev al cierre.
Al obtener permiso, aplicar soloPrettier a14archivos, correrformat:check y
registrar evidencia antes de fastforwardmain; no repetir otros gates sin motivo.
Luego QA main local por owner; live requiere0067/0068PROD y autorización posterior.

## ⇥ 0186 (2026-10-09) — OPCIONES DEL TICKET EN CONFIGURACIÓN

Incidente owner503 al abrir Configuración: log merchant pos_route_failed42P01
en GETticket; consulta Docker confirmó core.ticket_settings ausente y68
migraciones (hasta0067). Aplicado migrador local existente con URL Docker fija,
sin seed/reset ni PROD. Exit0:69migraciones; to_regclass ahora devuelve tabla y
SELECTshow_business_name/show_table exitoso (sin filas, defaultsAPI). No cambios
UI/API/DBfuentes. Owner debe recargar para confirmar GET autenticado en navegador;
no se afirma HTTP200 sin su sesión. ImpresiónPOS fallaba por la misma tabla.

Reserva b2d4f89; UI7664df1 en dev local sin merge/push. Owner aclaró que
impresión siempre activa: toggle Imprimir tickets solo abre/cierra opciones,
sin persistir ese estado visual. Propuesta de ampliar API/DB descartada.

Tarjeta owner junto a POS consume GET/PUT existente de0184. Switch del kit
para nombre y mesa; cambios guardados automáticamente, ambos falsos válido.
Éxito ConfirmationToast compartido; fallo conserva configuración confirmada,
lectura fallida ofrece reintento, bloqueo síncrono durante PUT evita concurrencia.
Abrir/cerrar no escribe, desmontaje ignora respuestas tardías. Sin owner no
consulta ticket. Sin cambios POS/printing/API/DB/kit ni ajustes de impresora.

Typecheck/lint merchant completos en0; formato/diff verdes; guard2archivos sin
incrementos. E2e3tickets+regresiónPOS4verdes2.5s, final3verdes2.8s con capturas
390/1280 vistas. Harness API simulado; PUT persistente real ya probado por Claude
0184, sin DB real ni migraciones en esta tarea. Evidencia/comando en spec0186.
QA owner pendiente; sin gate global/live ni CI remoto declarado (red falla).
Commits --only preservan cambios ajenos gotchas/LECCIONES.

## ⇥ 0185 (2026-10-09) — BOTÓN IMPRIMIR POS CONECTADO

Reserva 8264cc5; implementación 9dfd240 en dev local, sin merge/push. Encargo
2026-10-09 y printing/README leídos completos. Botón circular junto a Cobrar
consume printing/index de 0184/c264dbf; módulo, API, kit y DB intactos.

GET ajuste al abrir POS autorizado, sin defaults ni fetch al tocar. buildTicket
y printTicket en gesto; guard síncrono y botón bloqueado durante impresión o
borrador sin guardar. Éxito con ConfirmationToast compartido. no_printer y
not_found ofrecen elección/reemplazo BLE o serial en gesto nuevo; reimprimen
el documento congelado. Mensajes del módulo intactos. Unsupported publica
TicketDoc antes de window.print, sin Precuenta/QR, nombre/mesa opcionales.
Orden/contexto invalidan resultados tardíos; error de autorización revoca POS.

Typecheck y lint completos merchant en cero. Corrida conjunta: 105 verdes
(14 impresión + 91 POS), 21.6s; final específica con caso adicional de revocación:
15 verdes, 6.7s. Transportes simulados, módulo real. Formato/diff verdes y
guard de cinco archivos UI sin incrementos. Capturas diálogo desktop y ticket
con media print vistas. Evidencia en docs/handoff-0185-impresion-pos.md.

QA físico WD-58P1/Chrome Android pendiente del owner: dos tickets seguidos y
uno tras recargar para comprobar el filtro guardado. No se certifica hardware,
serial real ni CI remoto (ci:status falló por red); gate global antes de live.
Commits --only con rutas explícitas preservan gotchas/LECCIONES ajenos.
Fuera: ajustes dispositivo/papel58/80, pantalla owner, QR, órdenes cerradas.

## ⇥ AJUSTE (2026-10-09) — ACENTO Y TRASH EN CLIENTE

Commit a7e0bef devlocal. Owner pide borde noverde, precisa1px y papelera roja.
Cliente usa border-accent naranja por defecto y TrashIconoir/text-danger;
fondo/ancho responsive y confirmación intactos. L0 lint/typecheck:ui/diff verdes,
sin nueva suite ni captura. Spec/handoff0183 actualizados, sin kit/CSS/API/push.
Commits --only preservan ajenos; QA/gateglobal previos pendientes.

## ⇥ AJUSTE (2026-10-09) — CLIENTE COMO CONTEXTO VISUAL

Commit99e56c1 devlocal. Owner pide fullwidth móvil/compactodesktop y menos
competencia con tabs. Cardneutral surface-subtle/bordersuave con iconocírculo,
etiqueta Cliente/nombre; retirado segmentoverde. X discreta/modal intactos.
Cuatro casos existentesverdes3.7s usados para capturas320/390/1280; capturas
390/1280vistas confirman anchomóvil y compactodesktop. Lint/typecheck:ui,
formato/diff/guardscoped verdes. Sin kit/CSS/API ni handlers nuevos.
Spec/handoff0183 actualizados. Commits --only rutas explícitas preservan ajenos;
sin merge/push, pendientesQA/gateglobalprevios conservados.

## ⇥ AJUSTE (2026-10-09) — BADGE DE CLIENTE Y CONFIRMACIÓN

Commit ee2dc5a devlocal. Owner pide cápsula de cliente en Pedido con estilo
pestañas/mesa: contorno surface, segmento primary con User/nombre y Xmark.
Nombre largo ajusta con wrap-anywhere; modal confirma retiro. Cancelar/Escape
conserva cliente/cupón; confirmar removeClient existente, productos intactos.
ErrorclientError usa mismo modal, busy bloquea; Cobrar y kit/API/CSS intactos.
Corrida6casos5verdes/1fallo320por nombre sin espacios; corregido. Última2/2verde
1.6s a390/320. Loading/confirmaciones4verdes previas. Capturasbadge390/320 y
modal390vistas; lint/typecheck:ui/formato/diff/guardscoped verdes.
Handoff/spec0183 actualizados. QA/gateglobalprevios pendientes, sinpush.

Incidente staging concurrente: commit inicialc893314 incluyó8eliminaciones de
Claude. Corregido con índice temporal/amend comprobando HEAD estable: ee2dc5a
contiene SOLO4archivos previstos; staging real/deletionsClaude intactos.
En próximos commits compartidos usar commit --only con rutas explícitas para
no consumir staging ajeno aunque cambie durante aprobación. Cambios0184,
paquetes/schema/lock/ticket/printer temporales y estadosClaude preservados.

## ⇥ AJUSTE (2026-10-09) — ACCIONES DE ORDEN SOLO ANULAR

Commitfc07a30 devlocal. Owner retira Imprimir precuenta de modalAcciones;
Anular usa Button danger. Copydirty antesdeanular, guardas/handler conservados.
BotónImprimirPedido y trabajoClaude0184 intactos. L0: lint/typecheck:ui/diff
verdes, regresión existenteadaptada sin corrernavegador; mediaprint conservada.
Spec/handoff0183 actualizados antes/cierre. Sin kit/CSS/API/push.
Ajenos paquetes/schema/lock/ticketservidor/spec0184/estadosClaude preservados.
QA/gateglobal previospendientes.

## ⇥ CORRECCIÓN (2026-10-09) — AVISO SOLO TRAS GUARDAR

Owner corrige trigger: Descartar no actualiza pedido, vuelve sin toast.
Mini plan326183a, códigoa555ce2. Pedido actualizado se publica solo tras
Guardar cambios exitoso de orden existente. Fallo no avisa éxito y mantiene
Editar; guardadoysalida/nuevas conservados. Tres pruebasverdes2.7s,
casosdescarte390/1280 y falloguardado→éxito. Typecheck6/lint/formato/diff verdes.
Handoff0183 actualizado. Localdev sin merge/push, ajenos preservados,
pendientesQA/gateglobalprevios intactos. Esta decisión reemplaza aviso al
confirmar descarte documentado anteriormente.

## ⇥ AJUSTE (2026-10-09) — DESCARTAR CAMBIOS EN EDITAR

Mini plan2a3c12b, codec7ec4c1, devlocal sin merge/push. Owner pide Xroja junto a
Guardar cambios cuando Editar dirty. Button danger circular48/IconoirXmark y
Dialog Descartar cambios reutilizan kit. Cancelar/Escape conserva borrador/tab;
confirmar restaura apply(order), limpia eliminaciones/aviso producto, vuelve a
Pedido con ConfirmationToast Pedido actualizado (copy owner). Sinrequests,
cliente/cupón intactos, busy bloquea. Nueva orden/salida previas intactas.
5pruebas específicasverdes4.5s y2descarte finalesverdes1.8s trasajuste círculo;
verifican inline, cancelar, snapshotrestaurado, ceroescrituras, tab y toast.
Capturasinline/modal390vistas;1280capturado. Typecheck6/lint/formato/diff y
scopedguardeditor sinincrementos. Handoff0183 actualizado. QA/gateglobalprevios
pendientes; ajenosgotchas/LECCIONES/estadosClaude preservados.

## ⇥ AJUSTE (2026-10-09) — CONFIRMACIONES UNIFICADAS

Owner define confirmaciones iguales a Producto añadido: cápsula oscura,
móvil abajo centro, desktop arriba derecha. Mini plan1a8e83d, código59998d2.
ConfirmationToast en app/components adapta Toast compartido con Tailwind/tokens;
pos-editor y pos-scan lo reutilizan sin clases propias. Patrón futuro obligatorio
para confirmaciones documentado en design-system con ejemplo. No kit/CSS/API.
Cinco pruebas verdes2.8s, comparan cliente/producto a390/1280 y conservan
loading/cancelación/pedido largo. Capturasmobile/desktop vistas; lint/formato,
typecheck6/diff y guardscoped3archivos sin incrementos. Handoff0183 actualizado.
Devlocal sin merge/push, ajenos preservados, QA/gateglobal previos pendientes.

## ⇥ CORRECCIÓN (2026-10-09) — TOAST POS ALCANZABLE EN VIEWPORT

Owner no veía toast. Regla counter-flow.toast positionstatic lo dejaba después
pedido fuera pantalla. Mini plan6b31c78, fixec69ffb: Toast compartido fixed
arriba centrado por utilidades explícitas, sin CSS/kit ni cambios de resolve.
Regresión20líneas: rojo antes viewportratio0, verde después positionfixed y
viewport. Tres pruebas específicasverdes1.9s, typecheck6/lint/formato/diff verdes;
captura390×600vista. Handoff0183 registra evidencia. Devlocal sin merge/push.
Cambios ajenos preservados; QA físico/gateglobal previos siguen pendientes.

## ⇥ AJUSTE (2026-10-09) — IDENTIFICACIÓN POS CON C ANIMADA

Owner pidió pantalla loading intermedia y toast al encontrar cliente.
Mini plan L1 cerrado en1660b87, código68ab865, dev local sin merge/push.
pos-scan mantiene fullscreen durante resolve con C oficial centrada/pulso,
texto solo sr-only, reduced-motion sin animación y Cancelar alcanzable.
Toast compartido Cliente identificado solo tras éxito vigente; nuevo escaneo
limpia aviso, cancelar/error/tardío no avisan éxito. No kit/CSS/API ni dinero.

3pruebas específicas verdes2.1s (éxito/loading/reducedmotion, cancelartardío,
error/auth); typecheck6verde, lint/formato/diff verdes. Dos capturas390px vistas.
Guardgeneral rojo por nuevos archivos ajenos prueba-impresora; countFile
antes/después del cambio POS:increases[] ambos. Handoff0183 registra límites.
QA físico y gateglobal de0183 siguen pendientes; PASSindependiente76ff4ed
es del flujo anterior, ajuste L1 no usó subagentes ni suiteglobal.
Cambiosajenos gotchas/LECCIONES/PARQUEADO/prueba-impresora/investigación preservados.

## ⇥ ESTADO (2026-10-09) — 0183 LOCAL, PASS AUTOMATIZADO INDEPENDIENTE

Código **03fad03**, corrección **76ff4ed**, rama dev sin merge/push.
[Spec 0183](../specs/0183-pos-escanear-pase-y-confirmar-cobro.md) sigue cerrada:
QA físico y gate global pendientes. [Handoff](../handoff-0183-implementacion.md)
y [revisión independiente](../revision-0183-pos-cobro.md).

QR por cámara identifica desde Pedido; cliente/beneficio temporal. Cobrar y
Escanear fullscreen; Código del pase retirado por decisión owner. Dialog es
única excepción de kit autorizada expresamente antes del código (03b9306).
Preview en centavos/base+extras, Cancelar sin close, cierre incierto conserva
UUID/cuerpo y bloquea navegación. Ningún servidor/API/tooling modificado.

Revisor encontró FAIL real: GET de recuperación503 tras409 permitía reabrir
con snapshot anterior. Root corrigió barrera persistente recoveryRequired:
Cancelar, reintentar o Quitar cliente no permiten confirmar hasta GET exitoso
más revisión. Seis regresiones nuevas verifican ambas vías, exclusión de cliente,
versión recuperada y nuevo UUID después de revisar.
Revisor **PASS automatizado76ff4ed**:86e2e+6reproducer,28preview,11Neon,
checks y Merchant Webpack verdes. Dos mutaciones rojas y fuentes restauradas.
Root6regresiones/typecheck6/lint/format/diff verdes. Corrida root81tests:
80pasan/1wizard falla por nombre accesible de heading; rerun puntual1/1verde,
y mismo wizard verde en suite86independiente. Se registra intermitencia,
no se afirma causa ni PASSglobal.

Root unitarios globales con4workers2435pasan/1036skip, lintglobal verde.
Verifyglobal previo rojo: formato servidor ajeno, tours10, referenciaskit8,
TurbopackEPERM incluso escalado. Kitbaseline03b9306==actual por8hashes;
no referencias regeneradas. QA cámara/teclado físico pendiente; viewport320x400
con scroll/foco pasa simulado. No marcar spec implementada ni publicar.

Dev local owner3200/3201 intacto. Copia aislada build:
/private/tmp/check-point-0183-build-_w_xmqt_, envlocal validada.
No DATABASE_URL producción. Owner preguntó solo cómo probar sin usuario real:
seed define Carla Ficticia/Café de bienvenida, pase dev-my /c/seed-local-web-1,
condicional a base sembrada; no ejecutar seed por esa consulta.
Cambios ajenos gotchas/LECCIONES y commits concurrentes de Claude preservados.

## ⇥ AJUSTE (2026-10-08) — CABECERA LIMPIA EN TOMAR PEDIDO

Owner pidió menos texto en paso 2. Ajuste 0181 cerrado en d739938 antes de código:
progreso Paso N de 3 solo sr-only; título de etapa y contexto mesa/local pequeño.
Volver a mesa/tomar pedido pasa a flecha circular junto al título (aria-label
conservado); X protegida sigue a derecha. Catálogo ya no tiene título/fila adicional
en nueva: categorías y lupa en una fila. DetailedSale showHeading true por defecto
conserva Mostrador/abiertas. Sin CSS, kit, API ni cambios de cache/escrituras.
Typecheck 6 paquetes (4,348 s), lint, formato, guardia 6 archivos sin aumentos,
diff-check verdes. E2e existente adaptado sin ejecución, QA visual owner pendiente.
Dev, sin merge/push, cambios ajenos preservados.

## ⇥ AJUSTE (2026-10-08) — PRECARGA POS EN MESA

Owner pidió catálogo listo antes de Tomar pedido. Ajuste 0181 cerrado en a179fcc:
nueva orden inicia catálogo en Mesa, inmediatamente con local único/recordado o
al seleccionarlo. Cache reutiliza/deduplica por local; no se precargan todos los
locales. Tomar pedido espera contexto/catalogo; spinner y reintento local explícito
en Mesa. Errores ordinarios de catálogo locales, auth 401/403 sigue limpiando contexto.
Navegar al paso 2 no hace otra lectura; abiertas mantienen carga al entrar Productos.
Typecheck, lint, formato, guardia sin aumentos y diff-check verdes. Aserción e2e
existente adaptada para lectura en Mesa y sin lectura/cargando al pasar; no ejecutada.
QA owner pnpm dev:local pendiente. Solo dev, sin merge/push, ajenos preservados.

## ⇥ ESTADO (2026-10-08) — SPEC 0181: WIZARD DE TOMA DE PEDIDO

Owner confirmó API POS sin productos null y autorizó concepto en pasos. Spec
reservada en d4d3819 antes de código. Nueva: Mesa / Tomar pedido / Revisar, guardar
al final; contexto compacto, catálogo reutilizado con lupa opcional, revisión sin
importes y búsqueda para añadir sin salir, Quitar línea completa y Deshacer.
Captura de precio retirada de POS, cero conservado, null rechazado sin inventar
precio. Snapshot/lineId y abiertos/cobro/ticket preservados. Mostrador conserva defaults;
props compartidas opcionales. Cache sin refresh/polling/autosave ni cambios de API.
[Handoff](../handoff-0181-wizard-pos-2026-10-08.md).

Typecheck 6 paquetes (3,792 s), ESLint UI/fixture, Prettier, guardia 6 archivos sin
aumentos, números y diff-check verdes. E2e adaptados y escenario wizard/cero/undo/add/cache
agregado sin ejecución: owner mantiene preferencia de no más suites. QA visual/teclado
y gates de publicación pendientes; no declarar implementada ni PASS completo.
Solo dev, sin merge/push; kit/CSS/servidor/contrato intactos y ajenos preservados.

## ⇥ INVESTIGACIÓN (2026-10-08) — WIZARD DE NUEVA ORDEN

Owner pidió evidencia antes de avanzar: Mesa / Tomar pedido / Revisar, sin precios
habituales y con eliminación de línea completa. Consultadas fuentes NN/g, Toast y
Apple; [informe](../design-explorations/2026-10-08-pos-wizard-toma-de-pedido.md).
Tres etapas son candidata razonable, no mejoría medida; wizard tiene costo en tarea
repetitiva. Eliminación completa respaldada por POS real, con Deshacer propuesto.
Ocultar importes es inferencia del contexto; sin estudio específico comparativo.
No evidencia para prohibir búsqueda al tomar pedido: Toast la mantiene; lupa opcional
recomendada frente a solo búsqueda en revisión. API 0169 requiere precio excepcional
si catálogo no lo tiene; no ocultar ese requisito ni guardar cero automáticamente.
Sin implementación ni nueva spec cerrada. Evaluación de campo propuesta, no ejecutada.
Solo docs en dev; sin merge/push, cambios ajenos preservados.

## ⇥ ESTADO (2026-10-08) — SPEC 0180: NUEVA ORDEN CON REVISIÓN

Spec cerrada antes de código en 60b773b. Owner cuestionó tabs/botones duplicados y
resumen fijo durante selección. Nueva orden: catálogo sin tabs ni total/cantidad
fijos, única CTA Revisar pedido; revisión con líneas editables, Total y Guardar orden.
Volver a productos conserva catálogo montado/draft. No crea desde selección,
incluso salida protegida ofrece revisar antes de guardar. Orden abierta conserva
su UI; cache/contrato/API/Mostrador/kit intactos, sin autosave.
Typecheck 6 paquetes (3,59 s), ESLint, formato, guardia 4 archivos sin aumentos,
números y diff-check verdes. E2e existentes adaptados sin ejecución adicional.
QA visual owner con pnpm dev:local pendiente. Dev, sin merge/push, ajenos preservados.

## ⇥ AJUSTE (2026-10-08) — MÁRGENES COMUNES POS

Owner pidió alinear listado, nueva orden y orden abierta. Ajuste 0178 cerrado en
fa86d77 antes de código: main común w-full px-6 pt-6 md:px-12 md:pt-12; contenido
backoffice-home w-full en todos los estados. Padding lateral/superior 24 px mobile,
48 px desde md; ya no alterna 24/14 px ni ancho máximo del listado contra workspace.
Padding inferior/navbar/footer/print mantienen comportamiento existente.
Sin CSS, kit, API ni escrituras. Formato, lint y guardia sin aumentos verificados;
QA visual owner en pnpm dev:local pendiente, sin suites adicionales.
Solo dev, sin merge/push; archivos ajenos preservados.

## ⇥ AJUSTE (2026-10-08) — TEXTO CENTRAL NAVBAR POS

Owner pidió misma tipografía que Mostrador original. Ajuste 0179 cerrado antes de
código en f3f9267: acceso central reutiliza Link con texto directo y clase existente
mobile-counter-access, eliminando Button/Text que imponían 16/14 px. Tamaño original
10 px, 9 px hasta 380 px, mismo peso/altura de línea, sin CSS ni tokens nuevos.
Click previene navegación y conserva evento local a consola; permisos y posición
sin cambios. Sin pruebas de navegador adicionales; QA visual owner pendiente.
Solo dev, sin merge/push; cambios ajenos preservados.

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

Ajuste L0 de landing (2026-10-10): retiradas la sección «FÁCIL DE QUERER, FÁCIL DE USAR» y su ilustración. Selectores existentes actualizados; sin correr tests, conforme a la instrucción del owner para estos ajustes. Revisión en localhost pendiente del owner.

Ajuste L0 aprobado (2026-10-10): el cierre práctico queda en este orden: 01 Prepara tu local, 02 Activa tu programa, 03 Invita a tu primer cliente. Aplicado sin tests; el owner revisa en localhost.

Ajuste L0 aprobado (2026-10-10): encabezado de planes cambiado a «MÁS POSIBILIDADES PARA TU NEGOCIO». Sin tests; revisión en localhost por el owner.

Ajuste L0 aprobado (2026-10-10): título de planes directo, banner de prueba con las tres herramientas y campañas explicadas por beneficio. POS mencionado como herramienta de la plataforma sin asignarlo a un plan: el encargo mantiene esa decisión abierta. Precios sin cambios. Sin tests; revisión del owner en localhost.

Decisión del owner (2026-10-10), aplicada a la comparación de planes: POS, catálogo con IA, mesas, pedidos, Bienvenida, Venta cruzada, push y ficha pública en ambos; puntos y sellos en Conecta; Impulso agrega cashback y todas las campañas avanzadas, sin enumerar campañas pendientes de definir. Locales y precios sin cambios. Push con nota de límites futuros por tipo de cuenta (hoy sin límites); precio referencial con doble asterisco para distinguirlo. Esta decisión reemplaza la restricción de copy sobre cashback del encargo original; no implementa cashback ni cambia contratos de API. Requiere coordinar esa funcionalidad con Claude antes de publicar la promesa. Ajuste L0, sin tests, revisión del owner en localhost.

Ajuste L0 aprobado (2026-10-10): FAQ con «Resuelve tus dudas antes de empezar», sin bajada redundante, nueve preguntas sobre prueba, fin de prueba, uso independiente del programa, app, premios, Venta cruzada, puntos/sellos, equipos y locales. Fin de prueba descrito conforme al ADR 0134 (bloqueo sin suscripción y conservación de datos). Selector de pregunta actualizado; sin tests, revisión del owner en localhost.

Ajuste L0 aprobado (2026-10-10): cierre final «PRUÉBALO EN TU NEGOCIO», título «Empieza hoy. Descubre lo que puedes lograr en tres meses», resumen de fidelización, contacto y ventas con prueba gratuita. CTA de registro conservado. Sin tests; revisión del owner en localhost.

Ajuste L0 aprobado (2026-10-10): CTA de registro «Pruébalo gratis 3 meses» y nota «Todo incluido durante la prueba» añadidos en las secciones de marketing y POS usando SignupLink y start-actions existentes, como en el cierre práctico. Accesos informativos futuros conservados. Sin tests; revisión del owner en localhost.

Ajustes L0 aprobados tras revisión UX (2026-10-10): hero identifica fidelización, marketing y POS; programa explica QR → acumulación → canje; marketing distingue clientes propios y nuevos; planes resumen diferencias, simplifican POS y avisos al teléfono y explican campañas avanzadas; preparación del POS opcional en paso 1; anclas de configuración dicen Cómo empezar. Diseño, precios y mecanismo de cashback conservados. Selectores de copy actualizados; sin tests, conforme a instrucción del owner. Revisión en localhost pendiente.
