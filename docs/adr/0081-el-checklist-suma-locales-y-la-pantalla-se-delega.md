---
adr: 0081
fecha: 2026-09-21
estado: aceptada
resumen: El checklist del onboarding pasa de CINCO a SEIS items — entra `locations`, como TOUR y no como hecho de dominio, porque el wizard del alta ya crea el primer local y un item derivado de «tenes un local» naceria hecho para todos. Y la pantalla de Locales deja de ser owner-only: la API de `/api/locations/*` ya estaba delegada en el permiso `locations` desde la 0086, asi que la pantalla cerrada dejaba el permiso vivo en la API y muerto en el producto. Enmienda el ADR 0078 §1 (cinco items) y la decision 4 de la spec 0061 (solo el owner administra locales).
---

# 0081 — El checklist suma Locales, y la pantalla se delega

## Contexto

El owner pidió el 2026-09-21 revisar el arco de Locales —crear, editar, archivar— y agregarlo al
checklist del onboarding, con el criterio de siempre: *«owner puede siempre CRUD sobre locales, y
luego staff con permiso de administrador de locales»*.

**La API ya cumplía eso entero.** Las cuatro rutas existen desde la spec 0061 y desde la 0086 pasan
por `requireApiPermission(request, "locations")`. No había nada que construir del lado del servidor.

## Decisión

### 1. La pantalla se gatea por PERMISO, no por rol

`/backoffice/locations` entraba con `requireOwner()` (decisión 4 de la spec 0061) y la navegación
sólo pintaba el link dentro de la rama del owner. Con la API delegada y la pantalla cerrada, **el
permiso `locations` estaba vivo en la API y muerto en el producto**: un integrante que lo tuviera
sólo podía ejercerlo llamando la API a mano.

Es el mismo patrón que la enmienda §10 de la spec 0086 —superficie delegada pero muerta— y **no es
una decisión nueva del owner, es cumplir la que ya dio.**

**Y la navegación se generaliza con un criterio explícito:** un link se le muestra a un integrante
sólo si la **pantalla** ya está gateada por permiso. Hoy son dos (Staff y Locales); las otras siguen
con `requireOwner()`, y ofrecerle a alguien una puerta que lo va a rebotar es peor que no ofrecerla.

### 2. El sexto item es un TOUR, y eso está medido

`POST /api/onboarding/business` —el wizard del alta— **ya crea el primer local**. Un item del tipo
«tenés un local» nacería `done: true` para todo el mundo: no informa nada. El único item con sentido
es un tour, con la misma forma que los otros cuatro (`completed` y `skipped` cuentan los dos).

Enmienda el ADR 0078 §1, que fijaba cinco. **La posición la delegó el owner** (*«ponlo donde quieras
da igual porque luego lo reordenaré»*): entra en la **2**, antes de Staff — primero dónde se opera,
después quién opera. Ningún tour bloquea a los que siguen, así que es orden de lectura.

### 3. El `href` de cada item sale de un mapa, no de un `if`

El botón «Empezar» decidía a dónde ir con `item.anchor === "staff"` hardcodeado. Entrar el segundo
item obligaba a tocarlo, y el tercero lo pediría de nuevo. Pasa a un mapa `anchor → href`, **y el
conjunto de anchors disponibles se DERIVA de ese mapa**: un anchor «disponible» sin destino pintaría
un botón que no lleva a ningún lado.

## Consecuencias

- El checklist devuelve **seis** items. Cuatro baterías de tests lo aseveran por conteo y por orden;
  las cuatro se actualizaron.
- **El item de Locales no se puede completar hasta que la pantalla tenga su tour.** No traba nada
  (ningún tour es obligatorio) y es el estado explícito del ADR 0078 §6.
- La pantalla de Locales queda con la misma forma de gate que la de Staff, **y con el mismo oráculo**
  (`page-guard.test.ts`): la lección de la 0088 fue que un gate sin prueba de que muerde se lee como
  protección sin serlo.
- El contrato HTTP de Locales queda escrito en `specs/0089-contratos-de-api.md`, que es lo que
  consume quien construye la pantalla por fuera (ADR 0070).
