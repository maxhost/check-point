# TASKS

**Estado actual del proyecto. Este es el punto de retorno.**

Si una sesion se cae, se cierra o se compacta, se vuelve aca — no al chat. Hay un hook
`Stop` que bloquea el fin del turno si se toco codigo y este archivo quedo viejo.

Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido,
cosa vista en pantalla. No "deberia andar". El auto-reporte no es evidencia.

Ultima actualizacion: 2026-08-14 (spec 0034 catálogo de productos IMPLEMENTADA con PASS de revisor independiente; migración 0017 en prod).

## Ahora

Que esta pasando ahora mismo y cual es el proximo paso. Si una sesion se cae, la
siguiente arranca leyendo este bloque.

La V1 de Mi Pasaporte está planificada para consumidor, comercio y administrador de
plataforma: wallet/QR, backoffice y wizard, app de operación, ruleta, métricas y
rutas/eventos curados. La propuesta de arquitectura está documentada en
`docs/ARCHITECTURE.md` y ADRs 0011–0017. El lanzamiento del entorno está ordenado en
`docs/SCAFFOLD-PLAN.md`. La Spec 0010 de scaffold está `cerrada` e implementada: el árbol
estaba en disco pero sin instalar ni verificar. En esta sesión se resolvió el bloqueo de
red, se fijó Node 24.19.0 + pnpm 11.4.0, se generó y versionó `pnpm-lock.yaml`, y se
corrieron los controles con resultado verde real (frozen install, format:check, lint,
typecheck, unit 3/3, build 3/3, contrato health exacto + 405). Se corrigieron dos defectos
del árbol que nunca se habían ejecutado: la config de Vitest 4 (`test.projects` en
`vitest.config.ts` en vez del removido `vitest.workspace.ts` con `--workspace`) y el alcance
de Prettier (`.prettierignore` para no reformatear docs de producto). Falta el PASS del
revisor independiente. Las specs de producto siguen en `borrador` hasta validar la arquitectura, incluyendo
entrega/costo de OTP en Ecuador. La Spec 0003 fue rediseñada alrededor de un Incentive
Engine interno (ADR 0018): reglas tipadas, efectos, presupuestos, versiones y simulación;
no se implementará un DSL libre ni lógica especial por pantalla.

El remoto canónico es `https://github.com/maxhost/check-point.git`, documentado en
`docs/REPOSITORY.md`. La rama de publicación acordada es `main`; la autenticación local de
GitHub debe revalidarse antes del primer push. El commit inicial local `6467628` está listo
para publicar; el intento de conexión no resolvió `github.com` desde este entorno.

Handoff guardado en `docs/HANDOFF.md`. Se aceptó ADR 0019: Mi Pasaporte conserva la
estructura accesible de UI y cada negocio publica branding limitado y validado para sus
superficies. La primera feature de producto es la Spec 0011, `cerrada`: un prototipo QA
consumer sin backend para probar en teléfono QR → permiso de ubicación → validación
simulada → recompensa → wallet guest temporal. Requiere URL HTTPS temporal para que el
teléfono pueda conceder geolocalización. La arquitectura y stack transversal siguen
pendientes de validación antes de cerrar las features reales de V1.

El 2026-08-12 se cerraron las tareas 18 (Spec 0024, programa de fidelización real) y 19
(Spec 0025, marca real y assets R2): gates locales verdes (typecheck 3/3, unit 22/23 con
1 skip por env, lint, build 3/3), fix de fixture e2e (`tests/e2e/support/demo.ts`,
seed-once para que `sessionStorage` sobreviva a `page.reload()` sin pisar el estado que
persiste la app), push a `main` (`b576a4b`) y QA manual en vivo sobre el deploy de Vercel
confirmado por el owner. La Spec 0024 sigue `en curso` en su frontmatter — cerrarla
formalmente pide el PASS del revisor independiente de `AGENT-WORKFLOW.md`, que esta sesión
no corrió. La Spec 0025 se marcó `implementada` a pedido explícito del owner con 3 de 6
casilleros de su DoD sin marcar (casos límite de subida, concurrencia, e integración
R2/Neon + E2E de `brand`, inexistente); no hubo PASS de revisor independiente tampoco.

El 2026-08-12 se revisó la feature de fidelización (Spec 0024) contra el comportamiento
deseado del Owner. Decisión confirmada: el cierre fechado es el único mecanismo de apagado
(no se agrega «desactivar» inmediato). Se cerraron los huecos production-grade en ADR 0028
y se implementaron localmente con gates verdes (ver tarea 18). La integración Neon se corrió contra una rama de test
aislada y efímera (creada y borrada vía Neon MCP), la migración 0010 se aplicó a `main` de
producción con `drizzle-kit migrate` (verificada) y el código se pusheó (`1887db8`). El único
residual es el E2E `loyalty-real.spec.ts`, que requiere un entorno desplegado con un owner de
prueba sembrado (`E2E_MERCHANT_BASE_URL`/`EMAIL`/`PASSWORD`).

El 2026-08-13, durante el QA en vivo del programa de fidelización, el owner reportó que «los
términos seleccionados al crear no persisten al editar». Diagnóstico: el texto sí persistía
(`terms_markdown`), pero el modelo de **checkboxes de plantilla** se reseteaba al reabrir la
edición y, peor, re-marcar una plantilla **duplicaba** su texto (ya incrustado en el markdown).
Contradecía el intento de la spec 0024 («partir de una plantilla y editar el texto antes de
guardar»). Fix production-grade (UI): las plantillas dejan de ser selección persistente y pasan
a ser botones **«+ Insertar»** que copian su texto ya renderizado (variables resueltas contra el
formulario vivo) al textarea editable; al guardar sólo viaja `[{ text }]`. Round-trip idéntico al
editar, sin duplicación ni estado fantasma. Typecheck 3/3, unit de loyalty 6/6, e2e sin impacto
(usan el textarea directo). El servidor sigue aceptando cláusulas por `templateId` (no-breaking).

Segunda ronda de QA (2026-08-13), cinco ajustes UX del programa (todo UI, sin tocar el servicio):
(1) el textarea de términos crece con el contenido (`AutoGrowTextarea`) y arranca alto; (2) el
TOS guardado respeta saltos de línea y espacios al mostrarse (`white-space: pre-wrap` en
`.published-term`); (3) los inputs `datetime-local` de cierre traen `min` (fin de acumulación ≥
ahora en la zona del negocio; canje ≥ fin de acumulación) para no ofrecer fechas pasadas; (4) los
errores de cerrar/cancelar/cargar salen como **toast de error** (`Toast kind="error"`), no debajo
del formulario; (5) el modal de confirmación se cierra siempre al confirmar (antes quedaba abierto
si el cierre fallaba). Typecheck 3/3 y unit de loyalty 6/6 verdes.

Tercera pasada de pulido visual (2026-08-13, sólo CSS + una clase): la tarjeta de «programa en
cierre» gana jerarquía —`.closing-summary` pasa de `<dl>` por defecto (con sangría del navegador)
a panel con etiquetas en mayúsculas atenuadas y valores prominentes—; el botón «Cerrar programa»
deja de tener borde sin fondo y pasa a texto rojo sin borde con subrayado en hover
(`.close-program-link`).

Cuarto ajuste (2026-08-13): el formulario de cierre deja de ser inline (`.transition-fields`
colgado bajo el botón) y pasa a una pantalla propia con el mismo formato del editor —nuevo
`program-closing.tsx` como `section.panel.loyalty-panel`—. `page.tsx` alterna vista/editor/cierre
y el header cambia título y la X para volver, igual que en «Editar». `ProgramView` queda sólo con
la vista activa y el enlace «Cerrar programa» que abre esa pantalla.

Quinto ajuste (2026-08-13): el mensaje único «Indica una ventana futura válida en la zona horaria
del negocio» era confuso porque cubría tres fallas distintas. `validateClosingWindow` ahora lanza
un mensaje específico por caso (fechas inválidas / fin de acumulación no futuro / fin de canje no
posterior al fin de acumulación); test unitario actualizado a los textos nuevos.

Revisión independiente (2026-08-13, `AGENT-WORKFLOW.md`) sobre la feature completa: veredicto
FAIL estrecho (sin bloqueantes) por dos IMPORTANTES, ya resueltos y reverificados contra Neon
real: (1) **atomicidad de auditoría** —el cambio de estado y el evento eran dos round-trips;
ahora cada transición es un CTE `UPDATE … RETURNING` + `INSERT event` en una sola sentencia, y
la creación usa `db.batch` (rollback ante el índice único), ver enmienda ADR 0028—; (2) **tests
del núcleo** —se agregaron índice único (`23505`→`409`) y autorización (`403`) al test de
integración—. MENORES arreglados de paso: JSON inválido → `400` (antes `503`), guard de fecha de
`cancelClose` movido al `WHERE` (elimina TOCTOU), `isUniqueViolation` recorre `.cause`. Gates:
unit 25/25, typecheck 3/3, lint, e integración Neon 3/3 (rama aislada efímera, creada y borrada
vía MCP). MENORES no accionados hoy (documentados, no bloqueantes): `ownerBusiness` ordena
`desc` vs `asc` en brand —inalcanzable con 1 negocio/owner—, validación de formato de
`stampImageObjectKey` (reservado hasta R2), y `program_kind` como literal en inglés en términos.

Re-revisión independiente (2026-08-13): **PASS**. Verificó los arreglos contra el código real
del driver (`db.batch` = transacción en neon-http; semántica CTE de Postgres) y confirmó los dos
IMPORTANTES resueltos correcta y suficientemente; solo MENORES no bloqueantes. Con el PASS
verificable, la **Spec 0024 pasa a `implementada`** (frontmatter + INDEX + DoD marcados; commit
`50228a7`). Cierra la tarea 18 como production-grade. Único residual documentado: el E2E real
automatizado (`loyalty-real.spec.ts`) sustituido por QA manual en vivo del owner (crear/editar/
cerrar/cancelar/ciclo completo/términos con saltos de línea, todo OK sobre el deploy de Vercel).

**Cierre de sesión 2026-08-13 — punto de retorno.** Fidelización (0024), marca+R2 (0025) y
diseño de sello en R2 (0026) quedan **`implementada` con PASS de revisor independiente** y QA
manual del owner; migraciones aplicadas a prod (última: `0012`), gate verde (typecheck 3/3, lint,
unit 28/9-skip), todo pusheado a `main` (`629d15f`). **La próxima feature es la tarea 21 / spec
0027** (wizard de creación + diseño visual de la tarjeta de Sellos): la spec está en BORRADOR con
los requisitos del owner; **el primer paso de la próxima sesión es cerrar la sección «Abierto» de
`docs/specs/0027-…md` con el owner** (modelo de datos, degradé, si la edición es wizard, defaults
de color) y recién entonces implementar con el protocolo de `AGENT-WORKFLOW.md`. Patrón
reutilizable ya disponible: pipeline de imagen en `server/assets/image.ts` y el de assets R2 con
borrado diferido (marca/sello); las features nuevas se verifican con rama Neon efímera + revisor
independiente antes de `implementada`.

**Actualización 2026-08-13 — spec 0027 CERRADA.** Se resolvieron las seis decisiones abiertas con
el owner (columnas dedicadas nullable con checks hex/ángulo a nivel DB, no jsonb; degradé lineal de
**ángulo configurable**; crear **y editar** por wizard; preview con `round(target/2)` sellos;
defaults de color derivados de la marca; Puntos sin diseño, columnas `null`). Se escribió **ADR
0030** (modelo de datos de la tarjeta), se pasó la spec 0027 a `cerrada` en INDEX (`disjunta: sí` —
ninguna spec abierta toca loyalty) y se ancló la spec técnica al código real (mapa de archivos:
create+update comparten `PUT`, colores no son secretos → van al DTO, splits por `file-size`).

**Implementación 2026-08-13 (spec 0027, en revisión).** Hecho: 4 columnas `card_*` + 5 checks
hex/ángulo/pareja en `schema/loyalty.ts` (migración **`0013_broad_turbo`**); `validateCardDesign`
(server, 422 por caso) y `CardDesignInput` en `core.ts`; `saveProgram` escribe las columnas en
INSERT/UPDATE; `ownerBusiness` ahora expone los colores de marca al cliente para los defaults; UI
reescrita como **wizard** (`program-editor.tsx` contenedor + `steps/{units,stamp-basics,card-design,
terms,review}.tsx`), `CardPreview` puro-props compartido (`card-preview.tsx`) con helpers
`cardBackground`/`filledCount`, hook `use-card-design.ts` (split para no cruzar `file-size`), CSS
del wizard/tarjeta en `globals.css`. Tests: `card-preview.test.ts` (helpers), `loyalty-card-design.
test.ts` (validación), integración `loyalty-card-design.neon.integration.test.ts`. **Verificación:**
typecheck 3/3, lint, Prettier, **unit 33/10-skip**, **integración Neon 6/6** en rama efímera
(`br-cold-mountain`, auto-expira), **migración `0013` aplicada + verificada en prod** (columnas +
checks presentes) y **build 3/3** (turbo, Node 24). **Pendiente para `implementada`:** PASS de
revisor independiente (`AGENT-WORKFLOW.md`) y QA manual en vivo del owner sobre el deploy.

**Fix de entorno 2026-08-13 (build local).** El `pnpm build` fallaba en `/_global-error`
(`useContext` null) — diagnosticado mal al principio como «Node 22 vs 24». Causa real: el harness de
dev inyecta `NODE_ENV=development` en el proceso, y `next build` con ese valor mezcla los builds
dev/prod de React y revienta el prerender. No es del repo (ningún dotfile lo setea; con `env -i` el
build pasa) ni de la feature (falla en `main` limpio). **Fix durable:** `NODE_ENV=production` en el
script `build` de los tres apps (no-op en Vercel, que ya es production) + local alineado a Node
24.19.0 vía nvm (`.node-version`) + corepack pnpm 11.4.0. Verificado: `pnpm build` = 3/3 con
`NODE_ENV=development` en el entorno.

**Cierre del arco — Spec 0027 IMPLEMENTADA (2026-08-13).** Se corrió el **revisor independiente**
(`AGENT-WORKFLOW.md`), que ejecutó los gates por su cuenta (typecheck 3/3, lint, unit 33/10-skip,
build 3/3, Prettier, file-size) y verificó el DoD ítem por ítem, la no-fuga de `*ObjectKey`, la
coherencia server↔checks de DB, la atomicidad de `saveProgram` y la ausencia de tests borrados:
**veredicto PASS**, sin bloqueantes ni importantes (solo menores informativos). El **QA manual en
vivo del owner pasó perfecto**. Con PASS + QA, la Spec 0027 pasa a `implementada` (frontmatter +
INDEX + DoD marcados; tarea 21 → `hecho`). Commits en `main`: `4388662` (feature) + `967a080` (fix
build). **La próxima feature es el wallet consumer que consumirá la tarjeta** (spec propia; reusar
`CardPreview` puro-props ya preparado para portarse).

**Pivote de posicionamiento 2026-08-14 — ADR 0031/0032, camino A.** Antes de arrancar el
"brand kit" (afiche imprimible con QR) se hizo un parate estratégico: el QR de "sumarse al
programa" no tenía flujo detrás (no existe enrolamiento ni wallet consumer). Se decidió
**merchant-first**: Mi Pasaporte es una herramienta de fidelización/marketing para comercios,
con la **Wallet nativa (Apple/Google) como superficie de consumidor** —no una app propia de
descubrimiento (esa "red Foursquare × Niantic" se **difiere** a una fase futura encendida
sobre densidad)—. Los juegos/AR/notificaciones son de **esta** etapa (tier Plus). **ADR 0031**
(posicionamiento + identidad de consumidor: cuenta única con N membresías, **identidad
compartida / membresías aisladas**, driver de analítica por-owner scopeada por negocio;
supersede la "red curada" de 0003 y reencuadra 0019). **ADR 0032** (dónde vive: esquema pg
propio **`consumer`**, auth **phone-OTP purpose-built**, DB única compartida, hospedado por
ahora en el backend de `apps/merchant`; refina 0012). La spec 0004 quedó **reencuadrada**.

El caso de uso del owner (Marcos escanea en "La Gringa" → landing nombre+apellido+teléfono →
OTP → QR personal + "Añadir a Wallet"; el encargado escanea el QR, arma carrito y otorga
puntos/sellos; el consumidor recibe aviso en el pase o la landing se actualiza) se **rebanó en
4 specs**: **0028** identidad+enrolamiento (**CERRADA**, lista para implementar), **0029** pase
de Wallet, **0030** acreditación en mostrador, **0031** notificación+landing en vivo (las tres
en `borrador`/stub). **El próximo paso es implementar la spec 0028** con el protocolo de
`AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente antes de `implementada`). El
**brand kit** queda **downstream**: su afiche recién tiene valor cuando el QR resuelve (0028+).
Nada de esto está commiteado aún (docs sin código). Dependencia dura de 0030: un **catálogo
económico de productos** (specs 0002/0021, en borrador).

**Ajuste 2026-08-14 — OTP diferido, 0028 sin proveedor.** Se decidió que el enrolamiento (0028)
**no verifica** el teléfono ni envía SMS: crea la cuenta con `phone_verified_at = null`
(gratis, sin fricción), porque el valor se acredita contra el **QR al portador**, no contra el
teléfono, y un SMS a Ecuador cuesta ~$0.25–0.34. Aclaración: "OTP" no es un SMS más caro —lo
caro son las *Verify API*; nuestro OTP es DIY (envío crudo). La **verificación/recuperación por
OTP** se movió a la **spec 0032** (nueva, `borrador`), que se quedó con la investigación de
proveedores (Twilio EC $0.339/BR $0.0599/ES $0.0875; Plivo más barato; Telnyx/Bird/AWS por
verificar; WhatsApp-auth más barato en BR/ES; Brasil ~10 semanas de alta de sender; España
registro CNMC desde 2026-09-15). Diseño agnóstico ya fijado: interfaz **`OtpChannel.deliverOtp`**
(SMS o WhatsApp bajo el mismo contrato) + canales `Console`/`Fake` para dev/test. **Consecuencia:
la 0028 queda implementable y lanzable HOY sin ningún proveedor de SMS** —el próximo paso sigue
siendo implementarla, ahora sin bloqueo de proveedor—. El ADR 0032 se ajustó (verificación
diferida); el ADR 0013 lo consume la 0032, no la 0028.

**Spec 0028 IMPLEMENTADA (2026-08-14) — identidad de consumidor y enrolamiento (camino A, 1ª
rebanada).** Primera noción de consumidor de plataforma: esquema pg `consumer` con 4 tablas
(`consumer_account` con teléfono E.164 único **sin verificar** + `qr_token` opaco; `program_membership`
aislada por `business_id`, unique `(consumer_id, program_id)`; `consumer_session` opaca con
`token_hash` sha256, cookie `HttpOnly` 30d; `enroll_attempt` para el rate-limit). Rutas públicas
`POST /api/public/enroll/:programId` (crea-o-reusa cuenta sin pisar perfil, membresía, abre sesión)
y `GET /api/public/enroll/me` (scopeado a la cookie); landing `(consumer)/enroll/[programId]`.
**Tres decisiones del owner (2026-08-14) bajadas a la spec antes de codear:** (1) reenrolar el
**mismo** programa con el mismo teléfono → **`409 already_member`** con CTA a recuperación (spec 0032),
sin duplicar membresía ni reabrir sesión (el teléfono no verificado no reabre acceso a una tarjeta
emitida en otro dispositivo — eso pasa por 0032); (2) **rate-limit 3 intentos/hora por teléfono**
(no por IP, para no bloquear al 4º cliente de la WiFi del local) → `429`; (3) enrolamiento permitido
en `active` **y** `closing`, solo `inactive`/inexistente → `404`. **Verificación:** implementador +
**revisor independiente PASS** (`AGENT-WORKFLOW.md`), ambos con gates propios (typecheck 3/3, lint,
prettier, **unit 46/19-skip** con 10 nuevos, build 3/3) e **integración Neon 9/9** en ramas efímeras
propias (no-fuga de `qr_token`/`token_hash`, aislamiento por negocio, seguridad del token de sesión
verificados). **Migración `0014_peaceful_harpoon` aplicada a prod** (`drizzle-kit migrate`;
verificado por SQL: esquema `consumer` con 4 tablas + 10 índices + 3 FK incl. cross-schema a
`core.loyalty_program`; `core`(14)/`merchant_auth`(4) intactos; 15 migraciones registradas). Ramas
Neon efímeras borradas. **Residual (post-deploy):** QA manual en teléfono sobre Vercel. Menores no
bloqueantes documentados por el revisor (TOCTOU del rate-limit ante concurrencia exacta del mismo
teléfono; intento contado también en 404/409 → consume slot del propio atacante; `23505` por colisión
de `qr_token` ~2⁻²⁵⁶ → 503) — todos dentro de los límites que la spec acepta y endurece la 0032.
**La próxima rebanada del camino A es la spec 0029** (pase de Wallet Apple/Google + push), bloqueada
por un ADR de proveedor de Wallet por escribir; reusa el `qr_token` ya emitido.

**Ronda QA 2026-08-14b sobre la spec 0028 (enmienda) — implementada + PASS.** QA en vivo del owner
sobre el deploy detectó tres ajustes (todo landing/UX + 1 columna): (1) **selector de país** con
banderita (emoji derivado del ISO) + código, **lista estática empaquetada** (`src/lib/countries.ts`
+ `countries.data.ts`, ~239 países; NO API ni tabla en DB — decisión del owner), número local que
compone el E.164; **default = país del negocio** (`core.business.country_code`, ISO-2; fallback `EC`);
(2) **`country_iso`** persistido para analítica (columna nullable en `consumer_account`, migración
**`0015_yummy_tusk`** aditiva; validado contra la lista → `422` si es desconocido; se guarda al crear,
**no se pisa en reuso**; entra al DTO, sin filtrar `qr_token`/`token_hash`); (3) **aviso de
recuperación movido al formulario** (junto al teléfono). **Implementador + revisor independiente
PASS**; gates verdes (typecheck 3/3, lint, prettier, unit 50→**53**, build 3/3) + integración Neon
9/9 en ramas efímeras. **Menor 1 resuelto post-PASS por el orquestador** (con tests): `composeE164`
evita duplicar el código si se pega un internacional con `+`, sin despojar dígitos pelados (colisión
Brasil dial `55`/DDD `55`). **Migración `0015` aplicada a prod y verificada** (`country_iso` text
nullable; `core`/`merchant_auth` intactos). El QR sigue sin renderizar a propósito (es la 0029).

**Cierre de sesión 2026-08-14 — punto de retorno.** La **spec 0028 (identidad de consumidor +
enrolamiento) + su enmienda 2026-08-14b (selector de país + `country_iso`)** quedan
**`implementada` con doble PASS de revisor independiente y QA manual del owner en vivo**: registro
real de **Marcos (`+49…`)** y **Julio (`+55…`/`country_iso=BR`)** sobre el deploy de Vercel,
verificados por MCP — selector de país OK, E.164 sin duplicar código, `country_iso` persistido.
Migraciones **`0014` + `0015` en prod**; commits **`b1f60d1`** (feature) + **`341f230`** (enmienda
país) en `main`. Gate verde (typecheck 3/3, lint, prettier, unit 53, build 3/3). Ramas Neon
efímeras borradas. **La próxima feature es la tarea 23 / spec 0029** (pase de Wallet Apple/Google +
canal de push): está en `borrador`/stub y **el primer paso es escribir el ADR de proveedor de
Wallet** (Apple PassKit / Google Wallet) que hoy la bloquea, y recién después cerrar la spec con el
owner. Reutiliza el `qr_token` ya emitido por la 0028 (no hay que re-emitirlo).

**Spec 0029 CERRADA + ADR 0033 + stub 0033 (2026-08-14) — punto de retorno.** Se cerró el
diseño del pase de Wallet con el owner. Decisión central (**ADR 0033**): **UN pase de identidad
"Mi Pasaporte" por consumidor** (no uno por comercio), **emisor único** Mi Pasaporte, en **Apple
Wallet (iOS, PassKit) y Google Wallet (Android)**; el **barcode lleva el `qr_token` global** de
la 0028 y **el comercio desambigua al escanear** (una sola credencial para todos los programas).
El pase es **casi estático — sin progreso por-programa**; enlaza a **"Ver mis programas"** (web)
vía un **`web_view_token` dedicado y revocable** (magic-link). Ciclo de vida = identidad (no
expira por cambio de programa; solo se rota ante pérdida de dispositivo). **Notificaciones
scopeadas por conjunto de destinatarios** (miembros de un negocio), no por el pase compartido: un
no-miembro no es alcanzable hasta que lo escanean. **Se desarrolla y verifica sin pagar Apple**:
`WalletProvider` intercambiable (`apple`/`google`/`console`/`fake`), firma **self-signed** del
`.pkpass` en tests + issuer **gratuito** de Google (modo demo); el install en iPhone real difiere
el $99 y queda como QA residual, no gate del PASS. La **spec 0029** quedó `cerrada` y `disjunta`
(dominio `wallet/*` nuevo; migración aditiva **`0016`**: `wallet_pass` + `web_view_token`). Se
separó el **canal de push a la spec 0033** (`borrador`: web service PassKit + APNs + `PATCH`/
`addMessage` de Google + rotación). Dos decisiones se mudaron a specs vecinas: **auto-enrolamiento
por escaneo + resolución del QR desambiguada por negocio → spec 0030**; **dashboard rico "Ver mis
programas" → spec 0031**. **Bloqueo externo del owner (no bloquea implementar):** dar de alta
Apple Developer ($99, solo para iOS real) y Google Cloud + Wallet API + issuer (gratis; guía
paso a paso acordada para el momento de implementar). **Próximo paso: implementar la spec 0029**
con el protocolo de `AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente antes de
`implementada`). **Antes de codear bajo codex: re-warmear el store de pnpm** (`pnpm fetch` en
terminal con red) porque la 0029 suma un paquete nuevo (render de QR / firma PKCS#7). Nada de
esto está commiteado aún (solo docs).

**Spec 0029 IMPLEMENTADA (2026-08-14) — pase de Wallet Apple/Google (camino A, 2ª rebanada).**
Se renderiza el `qr_token` de la 0028 y se lo hace portable en Wallet nativa. Dominio nuevo
`apps/merchant/src/server/wallet/*` con `WalletProvider` intercambiable (`apple`/`google`/`fake`,
seleccionado por entorno; 503 sin secretos): **Apple** arma `pass.json` storeCard + `manifest.json`
(sha1 por archivo) + firma **PKCS#7** con `node-forge` (cert real en prod, **self-signed en test**)
+ zip con `fflate`; **Google** arma el JWT RS256 de guardado con `node:crypto` nativo (sin lib).
Barcode = `qr_token` en ambos; branding Mi Pasaporte, sin progreso por-programa (ADR 0033). Rutas
públicas `GET /api/public/wallet/{apple.pkpass,google}` (401 sin sesión, crea-o-reusa **una** fila
`wallet_pass` por proveedor, runtime nodejs), `GET /c/[webViewToken]` (magic-link revocable → abre
sesión → `/wallet`, 404 si inexistente/revocado) y página `(consumer)/wallet` (QR SVG server-side +
ambos botones con detección UA y fallback + lista mínima "Ver mis programas"; el `done` de enroll
enlaza ahí). Ganchos de la 0033 provisionados (`webServiceURL` + `authenticationToken`, hash en
`wallet_pass.authTokenHash`). **Migración aditiva `0016`** (`web_view_token` en `consumer_account`
+ tabla `wallet_pass`); el backfill del NOT NULL se editó a mano (nullable → base64url por fila con
`gen_random_bytes(32)` → NOT NULL → unique). Paquetes nuevos agregados con red por el orquestador
(`qrcode`, `node-forge`, `fflate`, `@types/*`) — store caliente, lockfile versionado. **Anti-fuga**
blindada: DTOs por allow-list, ninguno serializa `qr_token`/`web_view_token`/`token_hash`/
`auth_token_hash`; test por entidad. **Implementador + revisor independiente PASS**
(`AGENT-WORKFLOW.md`), ambos con gates propios (typecheck 3/3, eslint, unit 60/23-skip con 7 de
wallet, build 3/3) + integración Neon **4/4** (wallet) y **9/9** (regresión 0028) en rama efímera
`br-small-surf-ax7jt3lk`. **Migración `0016` aplicada y verificada por SQL en efímera y en prod**
(17 migraciones; `web_view_token` NOT NULL/único/URL-safe, las 2 cuentas —Marcos+Julio— backfilleadas
con tokens distintos ≠ `qr_token`; `wallet_pass` + 3 uniques; `core`(14)/`merchant_auth`(4) intactos).
**Mistake→rule:** `drizzle/meta/` agregado a `.prettierignore` (json generado por drizzle-kit fallaba
`format:check` desde 0012). **Residuales aceptados** (no gate): install en iPhone real ($99, alta
Apple Developer del owner) + QA manual en **Android real** (issuer demo gratuito). **La rama Neon
efímera `br-small-surf-ax7jt3lk` sigue viva** (borrado gateado como destructivo — pendiente de
confirmación del owner). **Falta el `git push` a `main`** (commit local hecho; el push a `main` es
outward-facing y espera OK del owner; recordar el fix de `GH_TOKEN=` de CLAUDE.md). **La próxima
rebanada del camino A es la spec 0030** (acreditación en mostrador + auto-enrolamiento por escaneo);
depende del catálogo económico (0002/0021). El **canal de push del pase** es la spec 0033.

**Wallet en vivo (2026-08-14) — QA del owner en dispositivos reales, ambos pases en prod.**
**Google Wallet** verificado en **Android real** (issuer demo gratuito bajo cuenta Gmail
personal —la org GCP bloquea keys de SA vía `iam.disableServiceAccountKeyCreation`—; class
`3388000000023188934.mipasaporte_identity` `approved`; secretos `GOOGLE_WALLET_ISSUER_ID`/
`GOOGLE_WALLET_SA_JSON` en Vercel; script one-time `scripts/google-wallet/provision-class.mjs`).
**Apple Wallet** verificado en **iPhone real** con **certificado Pass Type ID real** (Apple
Developer personal, Team `SN489AVGUD`, `pass.com.checkpass.identity`, `.p12` con `-legacy` +
WWDR G4; 5 secretos `APPLE_*` en Vercel): el `.pkpass` instala y se agrega. Material de firma
local en `.secrets-apple/` (gitignoreado + **pre-commit hook** que aborta el commit de secretos,
verificado). Enmienda UX (commit `72081e5`): la confirmación de alta muestra los **dos botones de
Wallet directos** (componente compartido `WalletButtons`), sin paso extra. Checklist de go-live:
`docs/wallet-go-live.md`. **Residuales, cada uno su hilo:** (1) **diseño/arte** de los pases
(Google `heroImage` / Apple `strip` + logo/colores finales) — atado al rebrand **CheckPass**;
(2) **publishing access de Google** para salir de demo (gratis, ~2 días, post-arte); (3) pasaje
de la cuenta Apple **personal → organización** (regenerar cert); (4) **canal de push** = spec
0033. **Costos:** Google $0; Apple $99/año (ya pago hasta noviembre).

**Catálogo de productos CERRADO — spec 0034 + ADR 0034 (2026-08-14) — punto de retorno.**
Antes de implementar la spec 0030 (acreditación en mostrador, su prerequisito duro) se cerró
el catálogo con el owner. **Distinción clave:** el "catálogo económico" eran DOS cosas
distintas — (a) catálogo de **productos** (precio/coste), lo que 0030 consume; (b) catálogo
de **beneficios** (cupones/premios), motor de campañas. Se separaron: **ADR 0034** + **spec
0034** cierran el catálogo de **productos**; la **0002 quedó reencuadrada** (su marca/staff/
programa/negocio ya están implementados por 0025/0016/0024/0022) y la **0021 (beneficios)
diferida** con las campañas (andamiaje sin consumidor hoy). Decisiones del owner bajadas al
ADR/spec: catálogo **global por negocio con visibilidad opt-out por local**
(`available_all_locations` + `product_location`); **precio y coste opcionales** (sin precio,
el staff tipea el monto al escanear); el **valor en puntos NO vive en el producto** — lo
define el programa por **equivalencia `$X = Y puntos`** (se implementa en 0030, no en 0034);
**categorías gestionadas y libres** por negocio; **sin estados** (borrado directo, la
historia vive en el snapshot de 0030); **snapshot en la acreditación** para que editar/borrar
el catálogo no altere el wallet; **`currency_code` por negocio** (ISO 4217, default por país);
imágenes a R2 (pipeline de ADR 0029, DTO sin `*ObjectKey`); superficie real en
`/backoffice/catalog` (nueva tarjeta de nav), esquema `core` (`product`/`product_category`/
`product_location`), migración aditiva. La **spec 0034 quedó `cerrada` y `disjunta`**. Nada
commiteado aún (solo docs). **Próximo paso: implementar la spec 0034** con el protocolo de
`AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente), o 0030 en paralelo (0034 la
desbloquea). Re-warm del store de pnpm si se suma algún paquete.

**Spec 0034 IMPLEMENTADA (2026-08-14) — catálogo de productos del negocio.** Primer catálogo
real: dominio nuevo `apps/merchant/src/server/catalog/*` (barrel `catalog.ts` +
`core`/`validation`/`image`/`cleanup`/`products`/`categories`, todos < 300 líneas) sobre el
esquema `core` (`product` con precio/coste `numeric(12,2)` opcionales + checks `>=0 or null`,
`product_category` con unique `(business_id, lower(name))`, `product_location` para la
visibilidad opt-out, + `product_asset_upload`/`_cleanup` del pipeline de imagen). **`currency_code`
por negocio** en `business` (migración **`0017_opposite_cassandra_nova`**, backfill por país vía
CASE coherente con `lib/currencies.ts`; default `USD`). Rutas `api/catalog/**` (list/producto
CRUD/categoría CRUD/moneda + prep de subida **business-scoped** `product/image-upload` —soporta
imagen en el create, patrón diferido de stamp) + `api/public/catalog/[productId]/image`. UI real
en `backoffice/catalog/*` (lista mobile-first, editor con categoría inline + visibilidad por
local + imagen diferida, gestor de categorías, selector de moneda, estado vacío, `ConfirmDialog`,
toasts) + tarjeta "Catálogo" en el home. **El valor en puntos NO vive acá** (lo pone el programa
por equivalencia en 0030). **Anti-fuga blindada:** `toProductDTO` allow-list, ningún endpoint
serializa `image_object_key`; test unit + integración por entidad. **Implementador + revisor
independiente PASS** (`AGENT-WORKFLOW.md`), ambos con gates propios (typecheck 3/3, eslint,
prettier, **unit 70** con 10 nuevos, build 3/3) + **integración Neon 6/6 catálogo y 99/99 total**
(regresión de brand/consumer/wallet/loyalty verde) en rama efímera `br-rapid-moon-axlw221y`
(auto-expira 2026-08-17). **Migración `0017` aplicada a prod y verificada por SQL** (18
migraciones; 5 tablas `product*`; `currency_code` sin nulls, backfill AR→ARS/EC→USD/BR→BRL;
`core`(19)/`consumer`(5)/`merchant_auth`(4) intactos). **Sin paquetes nuevos** (reusa
`server/assets/image.ts`), no hizo falta re-warm de pnpm. **Menores del revisor (no bloquean):**
la ruta de prep es `product/image-upload` (business-scoped, no `[id]/…`); `requireOwner` da 403
para sesión sin negocio (más correcto que 401). **Residual:** QA manual del owner sobre el deploy
(subida R2 en vivo + crear/editar/borrar producto/categoría + restringir por local). **Commit
local hecho; falta el `git push` a `main`** (outward-facing, espera OK del owner; recordar el
fix `GH_TOKEN=` de CLAUDE.md). **La próxima rebanada del camino A es la spec 0030**
(acreditación en mostrador), ahora **desbloqueada** por el catálogo.

## Siguiente

| # | Tarea | Spec | Estado | Notas |
|---|---|---|---|---|
| 1 | Validar propuesta de stack y publicar remoto GitHub | ADR 0011–0017 | pendiente | Remoto público `maxhost/check-point` definido; falta reautenticar GitHub antes del primer push a main |
| 2 | Crear y cerrar Spec 0010 de scaffold | 0010 | hecho | Spec cerrada el 2026-08-10; sin comportamiento de producto |
| 3 | Implementar scaffold con protocolo de agentes | 0010 | en revisión | Implementado y verificado localmente (gates verdes); `pnpm-lock.yaml` versionado. Canonical `test:e2e` requiere puerto 3001 libre; falta PASS/FAIL independiente |
| 4 | Cerrar alcance y arquitectura técnica de V1 | 0001–0009 | pendiente | 0003 rediseñada; resolver abiertos y cambiar specs a `cerrada` antes de código |
| 5 | Implementar prototipo QA consumer v0.1 | 0011 | en revisión | Rutas y QR local implementados; format, lint, typecheck, unit y build verdes. Pendientes E2E del nuevo flujo, QA manual HTTPS en teléfono y PASS independiente |
| 6 | Implementar onboarding demo de owner y negocio | 0012 | en revisión | Wizard mock implementado en merchant; typecheck y format verdes. Pendientes unit/E2E, QA manual y PASS independiente |
| 7 | Implementar home demo del Backoffice owner | 0013 | pendiente | Campaña activa y navegación mock a locales, staff, marca, campañas y analíticas |
| 8 | Implementar pantalla demo de Marca | 0014 | pendiente | Nombre, logo y colores primario/complementario/acento con picker y hexadecimal |
| 9 | Diseñar e implementar Locales demo | 0015 | pendiente | Ver, añadir, editar y archivar locales con placeholder preparado para Mapbox |
| 10 | Implementar Staff demo | 0016 | en curso | Crear, permisos, reenvío mock, archivar y eliminar; sin backend |
| 11 | Refactorizar la fundación UI de merchant demo | 0018 | en revisión | Componentes reutilizables, código muerto y confirmaciones nativas eliminados; format, lint, typecheck, unit, build y E2E local 3/3 verdes. Falta PASS independiente |
| 12 | Implementar Programa de fidelización demo | 0019 | en revisión | Acceso propio; activar/desactivar Puntos o Sellos y configurar unidades, objetivo e imagen de sello mock. Gates locales verdes; E2E nuevo pendiente de ejecución local y PASS independiente |
| 13 | Implementar Analíticas owner demo multirubro | 0020 | en revisión | Dashboard universal con lentes Bar/Restaurante, Hotel y Retail; gates locales verdes. Pendientes E2E local y PASS independiente |
| 14 | Rediseñar wizard demo desde objetivos de negocio | 0003, 0017, ADR 0022 | en revisión | Flujo Constructor (objetivo editable) → Fechas/horarios → Revisión; requisitos explícitos para POS, duración y directorio; feedback sin incentivo |
| 15 | Diseñar e implementar Catálogo único de beneficios | 0021 | diferido | **Diferido con las campañas (ADR 0034).** Es el catálogo de **beneficios** (cupones/premios), no el de productos. Sus consumidores (wizard de campañas + Incentive Engine) no existen; revive con esa fase. El catálogo de **productos** que sí se necesita hoy es la tarea 30 / spec 0034. |
| 16 | Implementar registro y autenticación real de Owner | 0022 | hecho | Registro/login, alta de negocio/local, Stripe Checkout y webhook implementados y desplegados; QA manual contra Neon y gates locales verdes. El selector final de planes es carrusel con Plus mensual por defecto. |
| 17 | Implementar búsqueda y procedencia de locales | 0023 | en revisión | Geoapify principal y fallback automático Mapbox sólo ante fallo de Geoapify implementados; migración 0003 aplicada. Pendientes QA real/E2E y PASS independiente |
| 18 | Implementar programa de fidelización real y términos | 0024 | hecho | Ciclo mutable Puntos/Sellos, TOS editables y cierre fechado (ADR 0027) + endurecimiento production-grade (ADR 0028): cancelar cierre (`PATCH`), auditoría por eventos (`loyalty_program_event`), fin del éxito falso (`RETURNING`+409), normalización de `configuration`, last-write-wins. `schema.ts`/`loyalty-program.ts`/página divididos por el límite de tamaño. Gates locales verdes; **integración Neon verde** (schema + ciclo de vida completo + auditoría + 409) contra rama de test aislada; **migración 0010 aplicada a `main` de producción** (11 migraciones registradas, tabla+índices verificados) y **código pusheado** (`1887db8`) el 2026-08-12. Residual: el E2E `loyalty-real.spec.ts` queda listo pero pendiente de correr contra el entorno desplegado con owner de prueba. QA en vivo 2026-08-13: fix de persistencia de términos al editar (plantillas como botones «+ Insertar» que copian texto renderizado al textarea, sin duplicación) + ronda de UX. Endurecimiento post-revisión (auditoría atómica, tests de núcleo, 400/TOCTOU) y **PASS de revisor independiente**; Spec 0024 → `implementada` (commit `50228a7`). |
| 19 | Implementar marca real y assets R2 | 0025 | hecho | Nombre, colores, timezone y logo privado procesado/servido desde R2; reemplaza el mock de Marca. Gates locales verdes, pusheado a `main` (`b576a4b`) y QA manual en vivo confirmado por el owner el 2026-08-12. Spec cerrada a `implementada` a pedido del owner. 2026-08-13: **revisión independiente** (FAIL estrecho) resuelta — fuga de `logo_object_key` en `/api/brand` (ahora DTO sin la clave), JSON malformado → `400` (antes 503), UUID inválido → `404`, y tests agregados: `normalizeLogo` SVG/oversize + integración Neon (`409` optimista/`403`/`422`) verde en rama efímera. Concurrencia real **a futuro** (>1 owner). Núcleo de seguridad verificado correcto por el revisor. **Re-revisión: PASS** — 0025 al mismo estándar que 0024. |
| 20 | Diseño de sello del programa de fidelización en R2 | 0026 | hecho | Input para subir el diseño de la imagen del sello (modalidad Sellos): PNG/JPEG/WebP, **conserva transparencia** (decisión B del owner 2026-08-13; la tarjeta pinta los recuadros en blanco), borrado diferido a Guardar (igual que marca). Spec **cerrada** + **ADR 0029** (módulo de imagen compartido `server/assets/image.ts`; tabla `loyalty_asset_upload` paralela; `brand.ts` se divide). Implementación por fases: **(a) hecha** — `server/assets/image.ts` (`normalizeImage`, conserva alfa) extraído y `brand.ts` dividido (`brand/core|validation|cleanup`, 221 líneas), sin cambio de comportamiento (unit 26/26 + integración brand 3/3 verde en rama efímera). **(b–e) hechas**: columnas `stamp_image_object_key`/`stamp_image_version` + tablas `loyalty_asset_upload`/`loyalty_asset_cleanup` (migración `0012`); módulo `loyalty-program/stamp.ts` (upload firmado, procesamiento con `normalizeImage` que conserva alfa, resolución del cambio con rollback y borrado diferido, cron de limpieza, lectura pública); endpoints `POST /stamp-upload`, `stampAction` en el `PUT`, `GET /api/public/loyalty/.../stamp`; el `GET` del programa **oculta** `stampImageObjectKey` y expone `stampImagePath`; UI: campo de sello en el editor (solo Sellos) con subir/quitar diferido (`use-stamp-upload.ts`). Verificado: unit 7/7, typecheck 3/3, lint, integración Neon **9/9** en rama efímera, **migración 0012 aplicada a prod** (verificada). **Revisión independiente: PASS** (2026-08-13, sin bloqueantes ni importantes); se agregó un test que blinda que el `GET` nunca serializa `stampImageObjectKey`. Spec 0026 → `implementada`. Menores diferidos (URL firmada sin content-length, huérfano bajo edición concurrente del mismo owner — atado a la concurrencia a futuro; test de rollback con mock de R2). Residual: QA manual del camino de subida R2 en vivo (como en marca). Pulido QA 2026-08-13: botón "Quitar" del sello ahora al lado del preview (fila flex) y de tamaño normal, no full-width. |
| 22 | Identidad de consumidor y enrolamiento (esquema `consumer`, landing pública sin verificar, membresía aislada) | 0028 | hecho | Esquema pg `consumer` (4 tablas) + `POST /api/public/enroll/:programId` (crea-o-reusa cuenta **sin verificar**, `phone_verified_at=null`; **`409 already_member`** con CTA a recuperación al reenrolar el mismo programa; **rate-limit 3/h por teléfono** → `429`; enrola en `active`/`closing`, `inactive`→`404`) + `GET /enroll/me` scopeado + `program_membership` aislada por `business_id` + sesión opaca (`token_hash` sha256, cookie `HttpOnly` 30d) + `qr_token` opaco (nunca serializado). Landing `(consumer)/enroll/[programId]`. **No envía SMS** (OTP diferido a la 0032). Implementador + **revisor independiente PASS**; gates verdes (typecheck 3/3, lint, prettier, unit 46/19-skip, build 3/3), integración Neon 9/9 en rama efímera, **migración `0014` aplicada a prod y verificada por SQL**. Ramas efímeras borradas. Residual: QA manual en teléfono sobre el deploy. |
| 23 | Pase de Wallet (Apple / Google): UN pase de identidad por consumidor | 0029 | hecho | UN pase "Mi Pasaporte" por consumidor (**ADR 0033**), emisor único, barcode = `qr_token` global, sin progreso por-programa, enlace "Ver mis programas" (`web_view_token` dedicado revocable). Dominio `server/wallet/*` (`WalletProvider` apple/google/fake), rutas `GET /api/public/wallet/{apple.pkpass,google}` (401 sin sesión, crea-o-reusa 1 fila/proveedor, 503 sin secretos) + `/c/[webViewToken]` (magic-link → sesión → `/wallet`, 404 revocado) + página `/wallet` (QR SVG + ambos botones UA + lista mínima). Paquetes: `qrcode`, `node-forge` (PKCS#7 + self-signed en test), `fflate` (zip), JWT Google con `node:crypto`. Anti-fuga blindada (DTOs allow-list, test por entidad). **Implementador + revisor independiente PASS**; gates (typecheck 3/3, eslint, unit 60/23-skip, build 3/3) + integración Neon 4/4 (wallet) + 9/9 (regresión 0028) en rama efímera; **migración `0016` aplicada y verificada por SQL en efímera y en prod** (17 migraciones; `web_view_token` NOT NULL/único/URL-safe/≠`qr_token`, backfill de las 2 cuentas; `wallet_pass` + 3 uniques; `core`/`merchant_auth` intactos). Mistake→rule aplicado: `drizzle/meta/` a `.prettierignore` (json generado). **QA en vivo del owner 2026-08-14: Google verificado en Android real** (issuer demo gratuito, class `approved`) **y Apple verificado en iPhone real** (cert Pass Type ID real, Team `SN489AVGUD`, WWDR G4; `.pkpass` instala). Ambos en prod. Enmienda UX: botones de Wallet directos en la confirmación de alta (componente `WalletButtons` compartido). Checklist de go-live en `docs/wallet-go-live.md`. **Residuales (fuera de 0029):** diseño/arte del pase, pasaje cuenta Apple personal→org (regenerar cert), publishing access de Google (salir de demo). Push = tarea 28/spec 0033. |
| 24 | Acreditación en mostrador (consola de staff, puntos/sellos por reglas) + auto-enrolamiento por escaneo | 0030 | pendiente | Stub/borrador. 3ª rebanada. Escanear QR del consumidor → carrito → otorgar puntos/sellos (puntos por equivalencia `$X = Y puntos`; sello 1-por-compra; sello 1-por-cada-$X). **Hereda del ADR 0033:** resolución del `qr_token` global desambiguada por el negocio que escanea + **auto-enrolamiento por escaneo** (alta on-the-fly de un consumidor que ya existe pero no es miembro; términos accesibles en "Ver mis programas"). Prerequisito duro: **catálogo de productos (spec 0034, cerrada)**. Esta spec agrega al programa la equivalencia `$→puntos` y las reglas de sello (no viven en el catálogo). Depende de 0028. |
| 25 | Notificación y landing en vivo al otorgar + dashboard "Ver mis programas" | 0031 | pendiente | Stub/borrador. 4ª rebanada, cierra el loop. Push del pase (vía spec 0033) o actualización en vivo de la landing. **Hereda del ADR 0033:** aloja el **dashboard rico "Ver mis programas"** (CardPreview por programa + progreso + términos) al que enlaza el pase de la 0029. Depende de 0028/0029/0030/0033. |
| 28 | Canal de actualización y push de Wallet | 0033 | pendiente | Stub/borrador. Separado de la 0029 (2026-08-14). Web service REST de PassKit (registro de dispositivos + APNs) + `PATCH`/`addMessage` de Google + notificaciones scopeadas por destinatario + rotación/revocación del pase. Suma el secreto APNs (`.p8`). Depende de 0029. |
| 27 | Recuperación de cuenta y verificación por OTP (SMS/WhatsApp) | 0032 | pendiente | Stub/borrador. Endurece la identidad no verificada de la 0028: verificar teléfono + reclamar la tarjeta en otro dispositivo, vía la interfaz agnóstica `deliverOtp` (SMS o WhatsApp). Primera pieza que necesita un proveedor de mensajería (ADR 0013). Guarda la investigación de proveedores (2026-08-14). Depende de 0028. |
| 26 | Brand kit (afiche imprimible con QR de enrolamiento) | — | pendiente | **Downstream del loop.** Plantillas para un afiche imprimible con el QR que apunta a la landing de enrolamiento (0028). Reusa marca (colores/logo) y el pipeline R2. Sin spec aún; se abre cuando el QR resuelva. Las 6 decisiones abiertas ya relevadas en la conversación previa (plantillas curadas pintadas con la marca, PDF vs PNG, QR server-side, efímero vs persistido, sub-ruta en `/brand`). |
| 29 | Rebrand (¿CheckPass?) + diseño visual de los pases de Wallet | — | pendiente | **"Otra cosa" (post-QA 0029).** Dos piezas atadas: (a) **decidir la marca de consumidor** (hoy "Mi Pasaporte" en toda la app: `layout`, enroll, login, onboarding, wallet — es rebrand app-wide, amerita ADR); (b) **diseño de los pases** dentro del techo de cada plataforma (Google `heroImage` + `hexBackgroundColor` + logo; Apple `strip` + logo/icon + colores; sin diseño libre — ver ADR 0033: es pase de **identidad**, la stamp card rica es 0031). Requiere arte final (logo + banner) servido desde **dominio estable**. Conviene hacerlo antes del **publishing access de Google** (revisan branding). Sin spec aún. |
| 21 | Wizard de creación + diseño visual de la tarjeta de fidelización | 0027 | hecho | **PRÓXIMA FEATURE — spec CERRADA (2026-08-13), lista para implementar.** Wizard por pasos para crear **y editar** (Puntos: unidades → TOS → preview/activar; Sellos: básicos → diseño de tarjeta → TOS → preview/activar). Diseño de tarjeta (Sellos): fondo 1 + fondo 2 opcional en **degradé lineal de ángulo configurable** + color de borde, **preview en vivo** con `round(target/2)` sellos puestos; reutiliza la imagen de sello de 0026. Las 6 decisiones abiertas cerradas con el owner: **columnas dedicadas nullable** (no jsonb) con checks hex/ángulo a nivel DB (ADR **0030**), defaults derivados de la marca, Puntos sin diseño (columnas `null`). Requiere **migración `0013` aditiva** + `CardPreview` compartido + splits por `file-size` (`use-loyalty-program.ts`, `program-editor.tsx` → `steps/*`). Implementar con protocolo `AGENT-WORKFLOW.md`: rama Neon efímera + revisor independiente antes de `implementada`. |
| 30 | Catálogo de productos del negocio | 0034 | hecho | **IMPLEMENTADA (2026-08-14) con PASS de revisor independiente.** Catálogo de **productos** en `core`: `product`/`product_category`/`product_location` (+ `product_asset_upload`/`_cleanup`) + `currency_code` en `business`. Global por negocio, **visibilidad opt-out por local**; **precio/coste opcionales** (el valor en puntos lo pone el programa por equivalencia); **categorías libres**; **sin estados** (borrado directo); imágenes a R2 (pipeline ADR 0029, DTO sin `*ObjectKey`, test por entidad). Dominio `server/catalog/*`, rutas `api/catalog/**` + `api/public/catalog/[productId]/image`, UI `/backoffice/catalog` + tarjeta de nav. Gates (typecheck 3/3, eslint, prettier, **unit 70**, build 3/3) + **integración Neon 6/6 + 99/99 total** en rama efímera; **migración `0017` aplicada y verificada en prod** (18 migraciones, backfill de moneda por país, `core`/`consumer`/`merchant_auth` intactos). Residual: QA manual del owner en deploy. Falta `git push` a `main` (espera OK del owner). Desbloquea la spec 0030. |

## Hecho

| Fecha | Que | Verificado con |
|---|---|---|
| 2026-08-08 | Documentacion de Idea 01: Pasaporte local jugable (web) | Revision del archivo en raiz |
| 2026-08-08 | Refinamiento de Idea 01: Mi Pasaporte, wallet de fidelizacion gamificada | Revision del archivo en raiz |
| 2026-08-08 | Documentacion de Idea 02: Humbly, planes por actividad | Revision del archivo en raiz |
| 2026-08-08 | Documentacion de Idea 03: servicios confiables para el hogar en Cuenca | Revision del archivo en raiz |
| 2026-08-08 | Comparacion de tres ideas y recomendacion provisional | Revision del analisis y formulas de ingreso |
| 2026-08-08 | Investigacion de referentes y patrones de Mi Pasaporte | Revision de fuentes oficiales, casos y hoja de ruta |
| 2026-08-09 | Investigación de competencia local/nacional de fidelización, QR y promociones | Revisión de sitios y precios públicos de competidores |
| 2026-08-09 | Plan V1, roadmap, ADRs y nueve specs de producto en borrador | Revisión de documentos en `docs/` |
| 2026-08-09 | Protocolo de trabajo con agentes y plantilla de spec reforzada | Revisión de `AGENT-WORKFLOW.md` y plantilla |
| 2026-08-10 | Separación de arquitectura transversal y specs de feature | Revisión de `ARCHITECTURE.md` y spec 0004 |
| 2026-08-10 | Ciclo de vigencia de activos y retención guest definido | Revisión de ADR 0005 y DoD de spec 0004 |
| 2026-08-10 | Alcance de programas, campañas y eventos por negocio definido | Revisión de ADR 0006 y specs 0002/0003 |
| 2026-08-10 | Alcances de permiso y auditoría con snapshots definidos | Revisión de ADR 0007 y spec 0001 |
| 2026-08-10 | Owner definido como único administrador de merchant staff | Revisión de ADR 0008 y spec 0001 |
| 2026-08-10 | Cierre de local y validación de beneficios definidos | Revisión de ADR 0009 y specs 0002/0003/0006 |
| 2026-08-10 | Dominios de acceso de consumidor, plataforma y comercio separados | Revisión de ADR 0010 y spec 0001 |
| 2026-08-10 | Modelo de campañas compuesto mediante Incentive Engine definido | Revisión de ADR 0018 y Spec 0003 rediseñada |
| 2026-08-10 | Handoff para fase de arquitectura | Revisión de `docs/HANDOFF.md` |
| 2026-08-10 | Repositorio remoto canónico documentado y commit inicial local creado | `git log --oneline -1` muestra `6467628` |
| 2026-08-10 | Scaffold instalado y verificado: lockfile, install congelado, format/lint/typecheck, unit 3/3, build 3/3, contrato health exacto + 405, Playwright verde | Comandos corridos con Node 24.19.0 / pnpm 11.4.0 |
| 2026-08-10 | Diseño v0.1 de wallet contextual por comercio | Revisión manual: cover compacto, promoción futura, puntos, cupones, canjes y progreso de Bar Demo |
| 2026-08-10 | Diseño v0.1 de llegada desde QR y check-in | Revisión manual: pantalla simple, beneficios visibles y CTA único con explicación de ubicación |
| 2026-08-12 | Fix de fixture e2e: `seedDemo` con semántica seed-once (clave y tipo importados de la app) | `pnpm test:e2e` 5 passed / 1 skipped; antes fallaba en `loyalty.spec.ts` tras `page.reload()` |
| 2026-08-12 | Programa de fidelización real desplegado (Spec 0024, ADR 0027) | Gates locales (typecheck 3/3, unit 22/23, lint, build 3/3) + QA manual en vivo del owner sobre Vercel |
| 2026-08-12 | Marca real y assets R2 desplegados (Spec 0025) | Gates locales (typecheck 3/3, unit 22/23, lint, build 3/3) + QA manual en vivo del owner sobre Vercel |
| 2026-08-13 | Wizard de creación/edición + diseño visual de tarjeta de Sellos (Spec 0027, ADR 0030) | Gates (typecheck 3/3, lint, unit 33/10-skip, build 3/3) + integración Neon 6/6 + migración 0013 en prod + PASS de revisor independiente + QA manual del owner. Commits `4388662`/`967a080` |
| 2026-08-14 | Pase de Wallet Apple/Google (Spec 0029, ADR 0033, camino A 2ª rebanada) | Dominio `server/wallet/*` (provider apple/google/fake), rutas `wallet/{apple.pkpass,google}` + `/c/[token]` + página `/wallet` (QR SVG + botones). Gates (typecheck 3/3, eslint, unit 60/23-skip, build 3/3) + integración Neon 4/4 wallet + 9/9 regresión 0028 + **PASS de revisor independiente** + migración `0016` aplicada y verificada por SQL en efímera y **en prod**. Commits `4e4ba0b`/`72081e5`. |
| 2026-08-14 | Wallet en prod: Google en Android real + Apple en iPhone real (QA del owner) | Google Wallet (issuer demo gratis, class `approved`, secretos en Vercel) guarda el pase con QR en Android; Apple Wallet (cert Pass Type ID real, Team `SN489AVGUD`, WWDR G4, 5 secretos `APPLE_*`) instala el `.pkpass` en iPhone. Ambos vistos en pantalla por el owner. Setup en `docs/wallet-go-live.md`; secretos locales en `.secrets-apple/` (gitignore + pre-commit hook) |
| 2026-08-14 | Identidad de consumidor y enrolamiento (Spec 0028, camino A 1ª rebanada) | Esquema `consumer` (4 tablas) + rutas `enroll`/`me` + landing; `409 already_member`, rate-limit 3/h por teléfono, `closing` habilitado. Gates (typecheck 3/3, lint, prettier, unit 46/19-skip, build 3/3) + integración Neon 9/9 + **PASS de revisor independiente** + migración `0014` aplicada y verificada en prod (esquema `consumer` 4 tablas/10 índices/3 FK; `core`/`merchant_auth` intactos). Residual: QA manual en teléfono |
| 2026-08-14 | Catálogo de productos del negocio (Spec 0034, ADR 0034) | Dominio `server/catalog/*` + esquema `core` (`product`/`product_category`/`product_location` + upload/cleanup) + `currency_code` en `business`; rutas `api/catalog/**` + imagen pública; UI `/backoffice/catalog` + tarjeta de nav; anti-fuga `*ObjectKey`. Gates (typecheck 3/3, eslint, prettier, unit 70, build 3/3) + **integración Neon 6/6 catálogo + 99/99 total** + **PASS de revisor independiente** + migración `0017` aplicada y verificada por SQL en prod (18 migraciones; backfill de moneda por país; `core`(19)/`consumer`(5)/`merchant_auth`(4) intactos). Residual: QA manual del owner en deploy. Commit local hecho, pendiente `git push` a `main` |

## Descartado (y por que)

Los caminos descartados importan: sin registro, se reintentan.

| Que | Por que no |
|---|---|
