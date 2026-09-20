# Arquitectura de superficies y rutas — CheckPass Club

> **⚠️ DESACTUALIZADO EN PARTE (2026-09-20).** Despues de este documento se implemento y desplego
> el arco de specs **0077–0081**, que **cambia la API que la UI consume** — entre otras cosas
> **`POST /api/onboarding/program` fue BORRADO**. El delta esta en
> **`docs/ui-delta-arco-0076.md`**, y es lo primero que hay que leer. Lo de aca sigue vigente salvo
> donde el delta diga lo contrario.

Estado: decisión de Fase 3 para la UI nueva. No crea pantallas ni modifica la API.

## Principios

1. Una superficie se define por audiencia, responsabilidad y posibilidad de despliegue independiente; no por el repositorio físico donde vive hoy.
2. La UI nueva consume HTTP. No importa `server/db`, Drizzle, guards internos ni componentes de `/backoffice`.
3. Los contratos 0067, 0069, 0072, 0074, **0078**, **0079** y **0081** son la frontera (los tres ultimos se sumaron el 2026-09-20; ver `docs/ui-delta-arco-0076.md`). Una lectura disponible en un server component legado no cuenta como API.
4. Las rutas autenticadas no envían identificadores que el servidor resuelve desde la cookie.
5. Los componentes compartidos de `src/ui` son neutrales respecto del merchant: presentación y comportamiento, sin consultas, sesión ni reglas de negocio.

## Árbol objetivo

```text
apps/merchant/src/app/
├── (public)/
│   ├── page.tsx                         → /                 (landing, futura)
│   └── login/page.tsx                   → /login            (futuro)
├── [locale]/
│   └── (merchant)/
│       └── business/
│           ├── onboarding/page.tsx      → /es/business/onboarding
│           └── dashboard/page.tsx       → /es/business/dashboard (futuro)
├── (consumer)/                          → rutas actuales; no tocar
├── backoffice/                          → legado; no extender
└── api/                                 → API existente; no tocar desde este encargo
```

Los grupos `(public)` y `(merchant)` organizan sin aparecer en la URL. `[locale]` sí es un segmento visible y permite añadir idiomas sin mover pantallas.

## Wizard

- Vive en `apps/merchant` porque su API, cookie y responsabilidad pertenecen al merchant.
- URL inicial: `/es/business/onboarding`.
- Las tres pantallas y el resultado final comparten una sola ruta estable. El estado se deriva de `GET /api/onboarding/state`; no se codifica el paso como URL ni como fuente de verdad persistente.
- El código específico se coloca junto a la ruta en carpetas privadas `_components` y `_lib`, que Next no publica.
- El adaptador HTTP será el único módulo que conoce paths, DTOs y normalización de errores. Los componentes reciben datos y acciones tipadas.
- Antes de usar las tres lecturas de 0074 se comprobará si ya aterrizaron. Si todavía faltan, el mock de desarrollo reproducirá exactamente el contrato y quedará detrás del adaptador; no se crearán Route Handlers falsos.
- Las llamadas del navegador serán relativas al origen (`/api/...`), conservando la cookie y evitando el apex que redirige. Cualquier llamada server-side futura debe usar la base canónica `https://www.checkpass.club`.

## Locale

- La lista inicial de locales contiene únicamente `es`.
- El layout `[locale]` valida el parámetro y responde 404 para valores no soportados; no interpreta cualquier primer segmento como idioma.
- Los diccionarios se cargan por locale desde un módulo neutral. Los componentes no contienen decisiones de routing basadas en texto traducido.
- Los códigos de API se traducen mediante allow-list. El campo `error` del servidor es copia reemplazable y nunca decide el flujo.
- El root layout puede conservar `lang="es"` mientras exista un único locale. Cuando se habilite otro idioma, el atributo se resolverá desde la estrategia de root document elegida en esa ampliación; esto no cambia las URLs ni las pantallas.

## Superficie pública

- Landing y `/login` se organizan bajo `(public)` y hoy se sirven desde `apps/merchant` únicamente para compartir origen con la cookie.
- No importan `_lib`, layouts, guards ni componentes específicos de `[locale]/(merchant)`.
- Pueden usar `src/ui`, porque el catálogo es deliberadamente neutral, y un cliente HTTP público propio.
- Su futura extracción exige mover archivos y dependencias neutrales, no reescribir lógica.
- No se construye en el alcance inmediato: el siguiente entregable sigue siendo el wizard.

## Otras apps y legado

- `apps/consumer`: sin cambios.
- `apps/platform`: sin cambios durante el wizard. Su API de administración no existe; cuando corresponda solo se entregará el esqueleto contratado.
- `/backoffice/*`: puede leerse para comprender el dominio, pero no se extiende, no se reutiliza visualmente y no se toma como evidencia de endpoints.

## Sesión y estados de negocio

- `GET /api/merchant/session` es el reportero general; no usar better-auth `get-session`.
- `GET /api/onboarding/state` decide reanudación del wizard sin gate de email.
- `GET /api/billing/state` queda fuera del wizard y se usará más adelante para dashboard/plan.
- `business_suspended` y `business_closed` pasan por el componente compartido `ApiError`.
- Suspensión y plan son ejes independientes. Ninguna pantalla ofrece upgrade como solución a una suspensión.

## Decisiones de alcance

- Fase 3 no añade páginas ni endpoints.
- Fase 4 comienza exclusivamente con `/es/business/onboarding`.
- Después del wizard, el orden sigue siendo `/login`, dashboard sin métricas, landing y esqueleto de plataforma.
- Si una pantalla exige datos fuera de los contratos, se detiene esa pantalla y se registra en `docs/api-faltante.md`.
