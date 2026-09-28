# API faltantes para Marketing

Actualizado: 27 de septiembre de 2026. **Estado: verificadas, pendientes.** El owner pidió no implementar estas APIs todavía. El contrato vigente es [0101](specs/0101-contratos-de-api.md); el seguimiento está en [TASKS.md](TASKS.md). El documento [api-faltante.md](api-faltante.md) trata huecos históricos de onboarding.

## 1. Vista previa fiel a plantilla y canal

**Caso de uso:** antes de activar una plantilla, mostrar cuántas personas alcanzaría la configuración elegida.

**Límite de la API actual:** `GET /api/marketing/audience-preview?dormantDays=&locationIds=` (§3.7 del contrato) calcula la audiencia de dormancia y proximidad. No conoce el ritmo de visitas de `at_risk` (#4), el saldo y el premio de `near_reward` (#7) o `unclaimed_reward` (#8), ni la alcanzabilidad real de push. Además exige `dormantDays` entre 7 y 365; #7 ofrece 3 días y esa consulta respondería `400 validation`.

**Comportamiento temporal de la UI:**

- En plantillas, muestra una cifra solo para `missed_you` (#3) y `win_back` (#5) cuando el canal elegido incluye proximidad. La rotula **«alcance por proximidad»**. Si se eligen proximidad y push, aclara que la cifra no incluye push.
- Para #4, #7, #8, una elección de solo push o la falta de acceso a locales, muestra: «El alcance se calcula al activar y lo vas a ver en los resultados». No muestra un número.
- Nunca llama a `audience-preview` con `dormantDays < 7`.
- El compositor **a medida** conserva su vista previa numérica, rotulada «alcance por proximidad»: esa ruta sí representa su audiencia custom de dormancia y proximidad. Esta excepción fue confirmada por el owner.

La adaptación está aislada en [`marketing-audience-preview.tsx`](../apps/merchant/src/app/backoffice/marketing/marketing-audience-preview.tsx). Hace falta un contrato de vista previa que incorpore las reglas reales de cada plantilla y canal; **no se propone una ruta ni un cuerpo sin decisión del equipo de API**.

## 2. Lectura de locales con permiso de Marketing

**Caso de uso:** elegir exclusiones (`excludedLocationIds`) al activar una plantilla y elegir inclusiones (`locationIds`) al crear una campaña a medida.

**Límite de la API actual:** la lista solo sale de `GET /api/locations`, que requiere el permiso `locations`. Un empleado con `marketing` y sin `locations` recibe `403` aunque puede usar las rutas de Marketing. El `POST /api/marketing/campaigns` custom exige **al menos un** `locationIds`; no existe un valor contratado que signifique «todos».

**Comportamiento temporal de la UI:**

- Ante `403` al leer locales, oculta el selector sin mostrarlo como error de Marketing. En `POST /api/marketing/templates/{key}/enable` omite `excludedLocationIds`, por lo que se usan todos los locales disponibles.
- Si la plantilla usa solo push, no pide elegir locales ni envía exclusiones.
- Una campaña custom existente puede editar otros campos conservando los `locationIds` que devuelve su DTO. **Crear una campaña custom nueva sin acceso a la lista sigue bloqueado**: inventar IDs u omitir el campo haría fallar el contrato actual. La UI lo explica en lugar de enviar una activación inválida.

La lectura y el selector están aislados en [`marketing-locations.ts`](../apps/merchant/src/app/backoffice/marketing/marketing-locations.ts) y [`marketing-location-picker.tsx`](../apps/merchant/src/app/backoffice/marketing/marketing-location-picker.tsx). Hace falta contratar una forma de leer los locales necesarios con permiso de Marketing, o una semántica server-side explícita para «todos» en el compositor custom. **No se inventa un endpoint.**
