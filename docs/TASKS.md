# TASKS

**Estado actual del proyecto. Este es el punto de retorno.**

Si una sesion se cae, se cierra o se compacta, se vuelve aca — no al chat. Hay un hook
`Stop` que bloquea el fin del turno si se toco codigo y este archivo quedo viejo.

Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido,
cosa vista en pantalla. No "deberia andar". El auto-reporte no es evidencia.

Ultima actualizacion: 2026-08-12.

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
| 15 | Diseñar e implementar Catálogo único de beneficios | 0021 | pendiente | Reutilizable entre campañas, juegos y canjes; los términos de uso pertenecen a cada distribución |
| 16 | Implementar registro y autenticación real de Owner | 0022 | hecho | Registro/login, alta de negocio/local, Stripe Checkout y webhook implementados y desplegados; QA manual contra Neon y gates locales verdes. El selector final de planes es carrusel con Plus mensual por defecto. |
| 17 | Implementar búsqueda y procedencia de locales | 0023 | en revisión | Geoapify principal y fallback automático Mapbox sólo ante fallo de Geoapify implementados; migración 0003 aplicada. Pendientes QA real/E2E y PASS independiente |
| 18 | Implementar programa de fidelización real y términos | 0024 | hecho | Ciclo mutable Puntos/Sellos, TOS editables y cierre fechado (ADR 0027) + endurecimiento production-grade (ADR 0028): cancelar cierre (`PATCH`), auditoría por eventos (`loyalty_program_event`), fin del éxito falso (`RETURNING`+409), normalización de `configuration`, last-write-wins. `schema.ts`/`loyalty-program.ts`/página divididos por el límite de tamaño. Gates locales verdes; **integración Neon verde** (schema + ciclo de vida completo + auditoría + 409) contra rama de test aislada; **migración 0010 aplicada a `main` de producción** (11 migraciones registradas, tabla+índices verificados) y **código pusheado** (`1887db8`) el 2026-08-12. Residual: el E2E `loyalty-real.spec.ts` queda listo pero pendiente de correr contra el entorno desplegado con owner de prueba. QA en vivo 2026-08-13: fix de persistencia de términos al editar (plantillas como botones «+ Insertar» que copian texto renderizado al textarea, sin duplicación) + ronda de UX. Endurecimiento post-revisión (auditoría atómica, tests de núcleo, 400/TOCTOU) y **PASS de revisor independiente**; Spec 0024 → `implementada` (commit `50228a7`). |
| 19 | Implementar marca real y assets R2 | 0025 | hecho | Nombre, colores, timezone y logo privado procesado/servido desde R2; reemplaza el mock de Marca. Gates locales verdes, pusheado a `main` (`b576a4b`) y QA manual en vivo confirmado por el owner el 2026-08-12. Spec cerrada a `implementada` a pedido del owner. 2026-08-13: **revisión independiente** (FAIL estrecho) resuelta — fuga de `logo_object_key` en `/api/brand` (ahora DTO sin la clave), JSON malformado → `400` (antes 503), UUID inválido → `404`, y tests agregados: `normalizeLogo` SVG/oversize + integración Neon (`409` optimista/`403`/`422`) verde en rama efímera. Concurrencia real **a futuro** (>1 owner). Núcleo de seguridad verificado correcto por el revisor. **Re-revisión: PASS** — 0025 al mismo estándar que 0024. |
| 20 | Diseño de sello del programa de fidelización en R2 | 0026 | en curso | Input para subir el diseño de la imagen del sello (modalidad Sellos): PNG/JPEG/WebP, **conserva transparencia** (decisión B del owner 2026-08-13; la tarjeta pinta los recuadros en blanco), borrado diferido a Guardar (igual que marca). Spec **cerrada** + **ADR 0029** (módulo de imagen compartido `server/assets/image.ts`; tabla `loyalty_asset_upload` paralela; `brand.ts` se divide). Implementación por fases: **(a) hecha** — `server/assets/image.ts` (`normalizeImage`, conserva alfa) extraído y `brand.ts` dividido (`brand/core|validation|cleanup`, 221 líneas), sin cambio de comportamiento (unit 26/26 + integración brand 3/3 verde en rama efímera). **(b–e) hechas**: columnas `stamp_image_object_key`/`stamp_image_version` + tablas `loyalty_asset_upload`/`loyalty_asset_cleanup` (migración `0012`); módulo `loyalty-program/stamp.ts` (upload firmado, procesamiento con `normalizeImage` que conserva alfa, resolución del cambio con rollback y borrado diferido, cron de limpieza, lectura pública); endpoints `POST /stamp-upload`, `stampAction` en el `PUT`, `GET /api/public/loyalty/.../stamp`; el `GET` del programa **oculta** `stampImageObjectKey` y expone `stampImagePath`; UI: campo de sello en el editor (solo Sellos) con subir/quitar diferido (`use-stamp-upload.ts`). Verificado: unit 7/7, typecheck 3/3, lint, integración Neon **9/9** en rama efímera, **migración 0012 aplicada a prod** (verificada). Residual: **PASS de revisor independiente** (corriendo) + QA manual del camino de subida R2 en vivo. |

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

## Descartado (y por que)

Los caminos descartados importan: sin registro, se reintentan.

| Que | Por que no |
|---|---|
