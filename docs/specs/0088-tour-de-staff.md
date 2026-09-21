---
spec: 0088
fecha: 2026-09-21
estado: cerrada
resumen: Publica un tour breve mobile-first de Staff con Driver.js y cuatro ayudas operativas reutilizables; las acciones de las ayudas son reales, el contenido traducible vive en archivos y solo el onboarding persiste progreso con la API existente.
disjunta: no
archivos: apps/merchant/src/app/backoffice/onboarding, apps/merchant/src/app/backoffice/staff, apps/merchant/src/app/globals.css
---

# 0088 — Tour interactivo de Staff

## Problema

- El checklist entrega `staff`, pero la UI sólo publica `verify-email`; Staff aparece “Próximamente”.
- Staff funciona, pero no expone anchors estables ni recorridos de Driver.js.
- La orientación del onboarding y las cuatro ayudas operativas deben poder ejecutarse por separado.

## Alcance

**Entra:** “Empezar” tras verificar email; navegación a Staff; orientación breve de la UI; ayudas independientes para crear, editar nombre/permisos, regenerar PIN y dar de baja; acciones reales/manuales en las ayudas; mobile-first; copy traducible en archivos.

**No entra:** migración, endpoint nuevo, CMS, persistencia de ayudas, simulación o ejecución automática, otros tours.

## Diseño

1. Definiciones en `staff-tour-definitions.ts` y copy en `staff-tour-locales.ts`: la lógica referencia claves; la base no guarda copy ni selectores.
2. Recorridos atómicos `create`, `edit-permissions`, `regenerate-pin` y `disable`. `onboarding` es una orientación breve de dos pasos y no ejecuta esos procesos. Sólo `onboarding` persiste `tourId: staff`; Ayuda no escribe progreso.
3. El checklist navega a `/backoffice/staff?tour=onboarding`; Staff espera a cargar antes de iniciar Driver.js.
4. Los pasos usan `data-tour` estables. El merchant hace cada acción real; el tour nunca llama directamente una API de Staff.
5. El onboarding señala dónde añadir y dónde gestionar; desde su primer paso permite avanzar o saltar. Al iniciarse oculta el checklist para no competir visualmente.
6. El primer permiso de la ayuda de alta es `counter`. Crear entrega credenciales reales; regenerar rota el PIN real; dar de baja revoca acceso real.
7. Ayuda ofrece los cuatro recorridos. Editar, regenerar y dar de baja requieren un integrante.
8. Copy inicial `es`; otro idioma agrega un diccionario, sin duplicar comportamiento.
9. En las ayudas, pulsar el control resaltado avanza automáticamente cuando el paso representa una acción inequívoca. Los campos de texto conservan avance manual y el onboarding informativo no ejecuta ni autoavanza acciones.
10. Cada paso centra automáticamente su elemento dentro del viewport o del contenedor con scroll más cercano y refresca el spotlight al terminar; esto incluye las acciones del footer de los modales.

## Archivos

| Archivo | Acción |
|---|---|
| `backoffice/onboarding/onboarding-checklist.tsx` | editar |
| `backoffice/onboarding/onboarding-view.ts` | editar |
| `backoffice/staff/staff-tour-*` | crear |
| `backoffice/staff/*` | editar anchors y Ayuda |
| `app/globals.css` | editar estilos mobile-first |

**Disjunta?** No: comparte Staff todavía sin commit.

## Definition of Done

- [x] Staff queda accionable en checklist y navega al tour.
- [x] Onboarding orienta sobre la UI sin ejecutar las ayudas y persiste estado con la API existente.
- [x] Ayudas independientes no persisten progreso.
- [x] Anchors estables, acciones reales, copy separado y catálogo tipado.
- [x] Funciona desde 320 px con controles táctiles de 44 px.
- [x] Tests de composición, **navegación** y **persistencia** (los dos últimos nacieron en la
      enmienda §11: antes estaban marcados y no existían).
- [ ] **Test de `locale`: NO existe, y se declara en vez de fingirse.** La completitud del
      diccionario la sostiene el TIPO (`StaffTourLocale = keyof typeof STAFF_TOUR_COPY`,
      `staff-tour-locales.ts:71`), así que un idioma incompleto no compila; lo que no hay es un
      caso que pase un `locale` distinto, porque hoy sólo existe `es`. Entra con el segundo idioma.
- [x] Gates root: typecheck, lint, test, format:check y **build** — los cinco verdes.
- [ ] `test:e2e`: bloqueado localmente por el puerto 3000 (ver «Evidencia»). Queda para la CI.

## Mutaciones — presupuesto: 4

| # | Mutación | Oráculo rojo |
|---|---|---|
| 1 | Ayuda persiste progreso | test de modo ayuda |
| 2 | Onboarding omite un recorrido | test de composición |
| 3 | Staff no está disponible | test de estado visual |
| 4 | Primer permiso no es counter | test del anchor |

**Condición de corte:** dos correcciones consecutivas que descubran otra rotura detienen la ronda.

## Enmienda §11 — los seis hallazgos de la revisión independiente (2026-09-21)

La revisión en contexto fresco devolvió **FAIL** sobre el commit `8ee91d1`, y **no por lo que el
owner vio en pantalla**: por un defecto funcional que el botón «Siguiente» del popover esconde, y
por cinco propiedades que la spec daba por cubiertas y no tenían oráculo. Los seis quedaron
reproducidos por el orquestador antes de escribirse acá, y los seis están cerrados.

1. **EL DEFECTO REAL — la ayuda de alta le pedía al merchant el clic que ROMPE el alta.** El alta
   abre con el switch de Mostrador **ya encendido** (`staff-console.tsx:30-32`,
   `useState(["counter"])`), y el paso `counter` decía *«Habilitá Mostrador»* y estaba en
   `autoAdvanceAnchors`: el anchor es el `<label>` que envuelve el switch
   (`permission-picker.tsx:33`), así que pulsarlo lo **APAGA** → `createPermissions` queda en `[]`
   → el alta se corta con *«Elegí al menos un permiso»* (`staff-console.tsx:75-76`). Quien avanzaba
   con «Siguiente» nunca lo veía, y por eso sobrevivió al QA. **Arreglo: el paso pasa a
   informativo** («Mostrador ya viene activado») y sale de `autoAdvanceAnchors`. Se eligió esto y
   no cambiar el default del alta a `[]` porque el default es una decisión de producto que el tour
   no tiene por qué mover: el permiso recomendado sigue viniendo puesto.
2. **El gate de la pantalla no tenía oráculo** (y es la primera página del backoffice gateada por
   PERMISO en vez de por `requireOwner`). Borrar el chequeo dejaba **1.526 tests en verde** y
   ningún test del repo importaba `page.tsx`. Nace `page-guard.test.ts`, sin base: cuatro casos
   —integrante sin el permiso, integrante sin ninguno, integrante con `staff`, y **el owner, que
   llega con los siete aunque su fila esté vacía**—. Es RM1, y muerde con dos rojos.
3. **La UI tenía su propia lista de los siete permisos**, en otro orden y sin nada que la atara al
   catálogo cerrado — justo lo que `server/permissions-catalog.ts` existe para evitar (su docblock
   lo dice: una copia por módulo serían cuatro fuentes de verdad para un conjunto que el `CHECK` de
   la migración 0041 declara cerrado). Ahora `staff-contract.ts` tipa su copy como
   `Record<PermissionScope, …>` —un permiso nuevo **no compila** hasta que se le escriba— y un test
   compara los dos conjuntos ordenados, porque el **orden** de la pantalla sí es de producto
   (recomendado primero, peligroso último) y un arreglo incompleto sí compila. Es RM3.
4. **El administrador no veía «Regenerar PIN».** El botón era `isOwner &&`, pero la API ya delega
   esa ruta en el permiso `staff` (`api/staff/_auth.ts:66`) y el copy del picker se lo **promete**
   («puede crear a terceros, ver sus PIN»): la ayuda «Regenerar un PIN» —que el menú ofrece a
   cualquier administrador— quedaba esperando un `[data-tour="staff-pin"]` que para él nunca se
   renderizaba, y con `skipMissingElement: false` y `waitForElement: 60_000` eso es un recorrido
   que no responde. Pasa a `!own &&`: se conserva el corte sobre **uno mismo**, porque rotarse el
   PIN revoca las propias sesiones. No abre escalada nueva: por la regla 2 del ADR 0079 §3 un
   administrador ya puede otorgarse los seis permisos no-`staff`, y el `WHERE role='staff'` de la
   ruta protege la membresía del owner (regla 4).
5. **El cableado del arranque estaba escrito dos veces y sin oráculo.** El `href` que empuja el
   checklist y el query que la pantalla parsea vivían en dos archivos: romper uno dejaba «Empezar»
   navegando a una pantalla que no arranca nada, **sin rojo**. Ahora los dos salen de las mismas
   constantes (`STAFF_ONBOARDING_TOUR_HREF` / `wantsStaffOnboardingTour`), así que la
   desincronización **no es posible por construcción**; y el `persist: false` de las ayudas dejó de
   vivir en el `.tsx` y pasó a `staffHelpStart()`, que sí tiene oráculo (RM4). Lo que se pinnea con
   test es que el parseo **discrimine** (RM5).
6. **Efecto lateral sobre SEIS pantallas ajenas, revertido.** El `.confirm-dialog` había pasado de
   `background: #fff` a `var(--ui-surface)`, y ese diálogo lo comparten catalog, loyalty, locations,
   marketing, subscription (×3) y staff. Los tokens invierten bajo
   `@media (prefers-color-scheme: dark)` sin ningún gate (`ui/tokens.css:77-78`, y el merchant no
   setea `data-theme`) mientras las páginas de atrás siguen con `#fff` a mano en **69** reglas del
   mismo archivo: en un SO en modo oscuro, diálogo oscuro sobre pantalla clara. Vuelve a `#fff`.
   **El `z-index: 90` del backdrop se queda**: es lo que ordena las capas del tour
   (modal 70 < ayuda 85 < backdrop 90 < toast 100).

**Y dos docblocks que este commit volvió falsos**, los dos fuera de los archivos que tocó:
`server/onboarding/checklist.ts:123` decía *«Hoy `/backoffice/staff` no existe
(`backoffice-navigation.tsx:37`, `href: null`)»* citando la línea exacta que hoy afirma lo
contrario, y `server/onboarding/tours.ts:14` decía que el tour de staff *«apunta a una pantalla que
todavía no está»*. Corregidos los dos. Es la cuarta spec seguida con un docblock que afirma algo
que el árbol no sostiene.

**Mutaciones de la enmienda: 5, las cinco ROJAS y por la aserción correcta.** Bitácora con
`shasum`, alcance y salida transcrita en `docs/archivo/spec-0088-bitacora-de-mutaciones.md`.

**Lo que la revisión declaró y NO se persiguió:** `test:e2e` y los 560 tests de integración (no
corren sin base ni sin puerto), QA visual/responsive (lo hizo el owner), y el hecho de que
16 archivos fuente de `backoffice/staff/` tengan test sólo 2 — la clase ya quedó medida por las
mutaciones, y perseguir cobertura de `.tsx` sin navegador es gastar presupuesto en lo que el QA
humano ya cubrió.

## Declarado AFUERA

- Reanudación por paso, analítica por usuario y versión persistida; eso sí requeriría API nueva.

## Handoff

Implementación y revisión contra esta spec. La revisión independiente queda pendiente de disponibilidad de agente en esta sesión.

## Evidencia de implementación

**Ronda del 2026-09-21, corrida por el orquestador con Node 24.20.0 y `TURBO_FORCE=1`:**

- `typecheck`, `lint`, `format:check` y `test`: **verdes** — 148 archivos / **1.538 tests** pasaron;
  101 archivos / 560 tests de integración externa los omite la suite por falta de `DATABASE_URL`.
- `build`: **VERDE** (`3 successful, 0 cached`, 19,5 s). El `EPERM` de Turbopack de la ronda
  anterior era del sandbox del agente, no del código: corriendo sin sandbox el gate pasa.
- `test:e2e`: **NO SE PUDO CORRER, y no por el código.** Playwright levanta el consumer en
  `127.0.0.1:3000` y el merchant en `3001` (`playwright.config.ts:16-31`); el puerto 3000 está
  tomado por un `next dev` **del propio merchant** (PID 97387, `apps/merchant`), así que
  `webServer` aborta con *«Another next dev server is already running»* y exit 1 antes de abrir
  una sola pestaña. Es un proceso del owner: no se mata desde acá. **El gate queda para la CI**,
  que es el único lugar donde corre de verdad (`ci.yml:64`).
- `git diff --check`: verde.

**Trampa de medición, anotada:** el `pnpm run test:e2e | tail` de esa corrida devolvió
`exit 0` **con el gate fallado** — en zsh el status de un pipeline es el de `tail`. El fallo se
vio LEYENDO la salida, que es exactamente la regla de `CLAUDE.md` sobre gates que «pasan» sin
que nadie los mire.

## Abierto

Nada.
