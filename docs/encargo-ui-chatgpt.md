# Encargo: UI mobile-first de CheckPass Club

> **⚠️ DESACTUALIZADO EN PARTE (2026-09-20).** Despues de este documento se implemento y desplego
> el arco de specs **0077–0081**, que **cambia la API que la UI consume** — entre otras cosas
> **`POST /api/onboarding/program` fue BORRADO**. El delta esta en
> **`docs/ui-delta-arco-0076.md`**, y es lo primero que hay que leer. Lo de aca sigue vigente salvo
> donde el delta diga lo contrario.

Sos un diseñador-desarrollador de producto. Vas a construir la interfaz de CheckPass
Club, un SaaS de fidelización para comercios (programas de sellos y puntos, pases de
Wallet, campañas). **La API existe y está en producción; vos no la tocás.** Tu trabajo es
la UI que la consume.

Trabajá por fases y **mostrame el resultado de cada una antes de seguir**.

---

## FASE 0 — Investigación (NO la saltees, y citá fuentes)

Antes de escribir una línea de código, investigá y entregá `docs/ux-research.md`:

1. Mejores prácticas actuales de **UX mobile-first** para SaaS B2B que usa un dueño de
   comercio, muchas veces parado en el mostrador y con una sola mano: tamaño mínimo de
   áreas táctiles, jerarquía tipográfica, thumb zone, formularios largos en pantallas
   chicas, estados de carga y de error.
2. Cómo se hace un **wizard de alta de 3 pasos que no se abandone**: indicador de
   progreso, validación por paso vs al final, qué pasa si se cierra a mitad.
3. **Accesibilidad**: WCAG 2.2 nivel AA como piso — contraste, foco visible, navegación
   por teclado, `prefers-reduced-motion`, lectores de pantalla.
4. Cómo escalar de mobile a desktop **sin rediseñar**: en qué breakpoints, y qué patrones
   cambian (bottom nav → sidebar, sheet → modal, lista → tabla).

Cerrá con **decisiones explícitas**, no con un resumen. Si dos fuentes se contradicen,
decilo y elegí una, con el motivo.

---

## FASE 1 — Leer la API, EN ESTE ORDEN

Repo público: https://github.com/maxhost/check-point

1. `docs/specs/0067-contratos-de-api.md` — identidad: login del owner por email con link
   mágico, login del staff por `handle@slug` + PIN, verificación de email, cambio de slug,
   y las 4 rutas de staff.
2. `docs/specs/0069-contratos-de-api.md` — el wizard: prefill de la pantalla 2, alta del
   negocio, creación del programa desde 2 campos, el sello y el QR.
3. `docs/specs/0072-contratos-de-api.md` — los códigos de error transversales, el orden
   exacto en que se evalúan, y las 33 rutas que los emiten.
4. **`docs/specs/0074-contratos-de-api.md` — las tres LECTURAS.** Es el documento más
   nuevo y el que resuelve el agujero que esta UI iba a chocar de frente. Leelo entero:
   su §4 lista **lo que no existe**, para que no lo inventes.
5. Opcional, para entender el *por qué* de decisiones que si no parecen arbitrarias:
   `docs/adr/0070-el-alta-del-comercio-es-un-wizard-de-tres-pantallas.md`

### Cuatro advertencias que cambian lo que leés

- **El documento 3 manda sobre el 1 y el 2 en materia de errores.** El 2 se escribió antes
  de un cambio: su tabla para `POST /api/onboarding/program` lista solo `403 not_owner`,
  pero esa ruta hoy **también** emite `403 business_suspended` y `403 business_closed`. El
  3 lo documenta bien.

- **Las tres rutas del documento 4 tienen su contrato cerrado pero TODAVÍA NO ESTÁN
  DESPLEGADAS.** Se implementan en paralelo a tu trabajo (spec 0074). **Construí contra su
  contrato**: es normativo y no va a cambiar bajo tus pies. Si necesitás correr algo antes
  de que aterricen, mockealas **con exactamente la forma del contrato** y dejá el mock
  aislado detrás de un módulo, para borrarlo cambiando un archivo. Las tres:
  `GET /api/merchant/session`, `GET /api/billing/state`, `GET /api/onboarding/state`.

- **`GET /api/auth/get-session` existe y es de better-auth**, no lo escribimos nosotros;
  devuelve `200` con cuerpo `null` si no hay sesión. **No lo uses:** `/api/merchant/session`
  trae todo lo que ese trae y además rol, negocio, `slug` y `status`.

- **Base URL: `https://www.checkpass.club`.** El apex `checkpass.club` responde `308` hacia
  `www`. Pegarle al apex desde el cliente rompe requests con cuerpo.

### Las tres lecturas, en una pantalla

El contrato completo está en el documento 4. Esto es el resumen para que no tengas que
tenerlo abierto todo el tiempo:

| Ruta | Gate | Status | ¿Emite los 5 `code` de la 0072? |
|---|---|---|---|
| `GET /api/merchant/session` | ninguno | **200 siempre** | **NO** |
| `GET /api/billing/state` | owner | 200 / 401 / 403 | **SÍ**, en orden |
| `GET /api/onboarding/state` | sesión, **sin email verificado** | **200 siempre** | **NO** |

```jsonc
// GET /api/merchant/session — sin sesión
{ "authenticated": false }

// GET /api/merchant/session — con sesión
{ "authenticated": true,
  "user": { "id": "uuid", "name": "…", "email": "…", "emailVerified": true },
  "business": {                       // null si todavía no dio de alta el negocio
    "id": "uuid", "name": "…", "slug": "…",
    "status": "active",               // 'active' | 'suspended' | 'closed'
    "suspensionReason": null,         // string SOLO si suspended Y role='owner'
    "currencyCode": "USD", "timezone": "America/Guayaquil" },
  "membership": { "role": "owner", "status": "active" } }   // 'owner' | 'staff'

// GET /api/billing/state
{ "subscription": { "plan": "plus", "status": "active", "interval": "month",
                    "pendingPlan": null, "pendingPlanAt": null },
  "activeLocations": 2, "canCancel": true }

// GET /api/onboarding/state
{ "authenticated": true,
  "business": null,                   // o { "id", "name", "slug" }
  "program": null,                    // o { "id", "kind": "stamps" }
  "stampImage": false }
```

**Seis cosas que salen de ahí y te ahorran diseñar de más:**

1. **`authenticated: true` + `business: null` manda al wizard.** Es la única forma de
   distinguir «tiene que dar de alta» de «tiene que verificar el email».
2. **`/api/merchant/session` contesta 200 incluso con el negocio suspendido**, a propósito:
   si te devolviera 403 no podrías renderizar nunca la pantalla de cuenta suspendida.
3. **`status: "suspended"` NO es un problema de plan.** No mostrar «mejorá tu plan»: son
   dos ejes ortogonales. El owner suspendido entra, ve `suspensionReason` y un botón de
   contacto, y nada más. **No lo resuelve él**: es una decisión de la plataforma.
4. **`suspensionReason` llega `null` para el staff, siempre.** No es un bug.
5. **`pendingPlan: "free"` + `pendingPlanAt` = baja programada.** Mostrá la fecha, no un
   «cancelado»: hasta esa fecha el plan vigente sigue siendo el de arriba, con sus topes.
6. **`/api/onboarding/state` devuelve hechos, nunca un número de paso**, y no lo va a
   devolver. El paso lo derivás vos: `business === null` → paso 1; `business` sí y
   `program` no → paso 2; los dos → pantalla final con el QR.

### REGLA DURA: no inventes endpoints

Si para una pantalla te falta uno, **pará y anotalo** en `docs/api-faltante.md` con qué
necesitás, para qué pantalla y por qué no alcanza lo que hay. Un endpoint inventado no
produce una UI incompleta: produce una UI que no funciona contra la API real y que hay que
tirar. **Es preferible una pantalla menos.**

`docs/api-faltante.md` es un **entregable**: si al terminar está vacío, escribilo diciendo
explícitamente que está vacío. No lo omitas.

### Lo que YA SABEMOS que no existe — no lo anotes de nuevo, no lo inventes

Esto está medido contra el árbol y declarado en `0074-contratos-de-api.md` §4:

- **Ningún endpoint de métricas o analítica.** Cero. Lo único agregado es
  `GET /api/marketing/campaigns/[id]/results`, por campaña.
  **Consecuencia directa para vos: el dashboard v1 no tiene números.** Diseñalo como
  centro de acciones y de estado (qué falta completar, qué plan tenés, accesos a cada
  módulo), no como panel de KPIs. Si tu diseño necesita una tarjeta con un número, **dejá
  el hueco documentado en lugar de inventar la métrica**. Si querés, proponé en
  `docs/api-faltante.md` qué tres números pedirías y con qué ventana de tiempo — eso es
  útil; una tarjeta con datos falsos no.
- **Ninguna API de admin de plataforma** (`bo.checkpass.club`). `apps/platform` tiene una
  sola ruta: `/api/health`.
- **No hay tope por plan de staff ni de productos.** El catálogo de entitlements tiene
  exactamente dos entradas: locales y campañas. **No muestres «3 de 5 integrantes»**: hoy
  no existe ese límite. Solo locales lo tiene (`free`: 1 · `plus`: 3).
- **El `slug` no sigue al nombre.** Cambiar el nombre del negocio **no** cambia el `slug`
  (que es a la vez el login del staff y la URL pública). Son dos acciones distintas y la
  UI tiene que decirlo, porque cambiar el slug **rompe el login de todo el staff**.

---

## FASE 2 — Sistema de diseño (antes que las pantallas)

Stack obligatorio, sin sustituciones:

- **React Aria Components** (Adobe) para todo comportamiento interactivo: accesibilidad,
  manejo de foco, teclado, ARIA. Nunca un `<div onClick>` haciendo de botón.
- **Tailwind CSS** para el estilo.
- **Iconoir** para iconos. Un solo set, sin mezclar con otros.

Requisitos del sistema:

1. **Design tokens en UN solo lugar** (variables CSS + config de Tailwind). Cambiar la
   paleta entera tiene que ser editar un archivo. **Ningún color literal fuera del archivo
   de tokens** — ni un `#hex` ni un `rgb()` sueltos en un componente.

2. **Paleta de arranque**, que es la que el producto ya tiene en base de datos como default
   de cada comercio:
   - primario `#176548`
   - complementario `#2D8B68`
   - acento `#E78132`

   Derivá de ahí la escala completa (hover, pressed, disabled, superficies, bordes, texto
   sobre cada fondo) y **validá el contraste AA de cada par texto/fondo que uses**. Si un
   par no llega, ajustá el tono y decime cuál cambiaste y por qué.

3. **Modo claro y oscuro desde el token**, no con clases duplicadas.

4. **Cada comercio tiene SUS colores.** Los tres de arriba son defaults por comercio y el
   dueño los edita (`PUT /api/brand`). Diseñá los tokens para que la marca del comercio se
   inyecte **en runtime**, sin recompilar. Ojo con el contraste: si el comercio elige un
   primario clarísimo, tu texto blanco encima deja de cumplir AA. **Decidí y documentá qué
   hace el sistema en ese caso** (elegir el color de texto por luminancia es lo habitual).

5. **Catálogo de componentes documentado.** Cada componente con su propósito, sus props,
   sus estados (default / hover / focus / disabled / loading / error / vacío) y un ejemplo
   de uso. **Antes de crear uno nuevo, buscá si ya existe.** Un componente que aparece en
   dos pantallas vive en el catálogo, nunca duplicado. Si dos pantallas necesitan algo casi
   igual, resolvelo con props, no con un copy-paste.

6. **Un componente de error de API**, y no uno por pantalla. Los cinco `code` de la 0072
   (`unauthorized`, `not_owner`, `email_not_verified`, `business_suspended`,
   `business_closed`) aparecen en 33 rutas: el mapeo `code` → qué se muestra y qué acción
   se ofrece se escribe **una vez**. Cada uno tiene una acción distinta:
   `email_not_verified` se resuelve con `POST /api/merchant/auth/verify-email`;
   `business_suspended` **no lo resuelve el usuario** y lo único que podés ofrecer es el
   motivo y un contacto.

---

## FASE 3 — Dónde vive cada cosa

El repo es un monorepo Next.js (App Router) con tres apps: `apps/merchant`,
`apps/consumer` y `apps/platform`. Hoy **solo `apps/merchant` está desplegada** y sirve
todo lo que está vivo: la landing, el backoffice y las pantallas del consumidor
(`/enroll/[programId]`, `/wallet`, `/recover`, bajo el grupo de rutas `(consumer)`).

| Superficie | Qué es | Dónde va | Estado hoy |
|---|---|---|---|
| `checkpass.club` | Landing pública, comercial | superficie **pública** | existe |
| `checkpass.club/login` | **Login único** de los tres perfiles | superficie **pública** | **no existe: lo creás vos** |
| `checkpass.club/es/business/dashboard` | Pantalla principal del comercio | app del **merchant** | **no existe** |
| `bo.checkpass.club` | Panel del dueño de CheckPass | `apps/platform` | **no existe**; hay un esqueleto |

### Lo que va en la app del merchant

El **wizard de alta** y el **dashboard**. Es donde vive su API y donde ya está todo lo demás.

### Lo que va en la superficie PÚBLICA

La **landing** y el **`/login`**. El login es público a propósito: identifica a los tres
perfiles y **puede terminar mandando a merchant o a consumer**, así que no pertenece a
ninguno de los dos.

**Restricción técnica que no podés romper:** la cookie de sesión la setean rutas que viven
en `apps/merchant`, sobre el origen `checkpass.club`. La superficie pública **tiene que
servirse en ese mismo origen** o el `Set-Cookie` no pega. Hoy la raíz `checkpass.club` la
sirve `apps/merchant`.

Por eso: **construí `/login` y la landing como una superficie autocontenida, con CERO
imports de código específico del merchant.** Que consuma la API por HTTP y nada más. Hoy
puede vivir como un grupo de rutas `(public)` dentro de la app existente; mañana se extrae
a su propio deployable **sin reescribirlo**. Si en algún momento necesitás importar algo
del merchant para que el login funcione, **pará y decímelo**: es señal de que el límite se
rompió.

### Sobre `/login` en particular

Es **una sola pantalla** que identifica a los tres perfiles y redirige según el caso:

- **merchant** → escribe su email → `POST /api/merchant/auth/start`
- **staff** → `handle@slug` + PIN de 6 dígitos → `POST /api/merchant/auth/staff`
- **consumidor** → `POST /api/public/recovery/request` → código → `/verify` → `/profile`

**⚠️ `auth/start` TIENE DOS RAMAS y las dos contestan `200`. Si asumís una sola, la pantalla
queda rota para la mitad de la gente:**

- **Email desconocido** → crea el usuario y **abre sesión EN EL ACTO**: `200` con
  `{ "sent": false }` **y una cookie de sesión**. No hay que revisar ningún email: seguí
  derecho al wizard.
- **Email conocido** → **NO abre sesión**: `200` con `{ "sent": true }` y **sin cookie**.
  Ahí sí va la pantalla «revisá tu correo».

**Ramificá por `sent`, no por el status**, que es `200` en los dos casos. Y no es un capricho:
sin contraseña, escribir el email de otro merchant le entregaría su negocio, así que un email
ya registrado **tiene** que probar que tiene la casilla.

**⚠️ El login del staff también ramifica: el `200` trae `{ "mustChangePin": true|false }`.**
Con `true`, la persona entró pero **tiene que cambiar el PIN antes de operar** — mandala a
esa pantalla, no al mostrador. El PIN son **exactamente 6 dígitos** y es la credencial
entera del staff: no hay contraseña detrás.

**Ojo con el tercero: en la API se llama «recovery», no «login».** Es el mismo flujo; el
nombre es histórico. No busques un `/api/consumer/login` porque no existe.

**No diseñes tres logins separados, ni un selector de «¿qué tipo de usuario sos?» sin antes
evaluar si se puede inferir de lo que la persona escribe** — un email y un `handle@slug`
tienen formas distintas y distinguibles. Si después de evaluarlo concluís que hace falta un
selector, justificalo.

**Después del login, a dónde va cada uno lo decide `GET /api/merchant/session`:**
`membership.role === 'staff'` → mostrador; `role === 'owner'` + `business !== null` →
dashboard; `business === null` → wizard; `business.status === 'suspended'` → pantalla de
cuenta suspendida con el motivo; `'closed'` → deslogueo y landing.

### Sobre `/backoffice/*`

Es la UI vieja y **se va a borrar**. No la extiendas ni te inspires en ella: lo que
construís es su reemplazo. Podés leerla para entender qué hace el producto, pero **el
contrato de la API manda sobre lo que veas ahí**.

Un detalle que te va a confundir si no te lo aviso: esas pantallas son *server components*
que consultan la base de datos **en proceso**, sin pasar por HTTP. Por eso vas a ver que
muestran datos que ninguna ruta de la API devuelve. **Eso no significa que el endpoint
exista**; significa que esa pantalla se saltea la API. La tuya no puede.

### Sobre el prefijo `/es/`

Es i18n y **no existe todavía**: el ruteo actual no tiene locale. Lo introducís vos. Español
primero, pero la estructura tiene que soportar más idiomas sin rehacer el ruteo. **Los
textos de error de la API vienen en español**; tratalos como copia reemplazable y ruteá por
`code`, nunca por el texto.

### Sobre `bo.checkpass.club`

Subdominio aparte, en `apps/platform`, con **su propio login**, sin registro público y sin
un solo enlace desde la web pública. **Su API todavía no existe**: entregá el esqueleto, no
pantallas que dependan de endpoints inventados.

### No toques `apps/consumer`

Hoy tiene solo demos y está sin desplegar. Su futuro no está decidido.

---

## FASE 4 — Orden de construcción

1. Tokens + catálogo de componentes base.
2. **El wizard de alta** (3 pasos + pantalla final con el QR), en la app del merchant. Es lo
   que tiene la API más completa y contratada: **empezá acá**.
3. `/login` con los tres caminos, en la superficie pública.
4. `/es/business/dashboard`, en la app del merchant. **Sin números** (ver Fase 1).
5. Landing pública.
6. `bo.checkpass.club`, en `apps/platform` (solo esqueleto).

---

## Entregables

- `docs/ux-research.md` — la investigación, con fuentes y decisiones.
- El archivo de tokens, con la paleta validada en contraste.
- El catálogo de componentes documentado.
- Las pantallas, en el orden de la Fase 4.
- `docs/api-faltante.md` — todo endpoint que te haya faltado, **más allá de los ya
  declarados en `0074-contratos-de-api.md` §4**. Si está vacío, decilo explícitamente; no
  lo omitas.
