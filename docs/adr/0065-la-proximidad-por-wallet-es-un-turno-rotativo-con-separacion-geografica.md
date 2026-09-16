---
adr: 0065
fecha: 2026-09-15
estado: aceptada, con la **decision 4 SUPERSEDIDA por el ADR 0066** (2026-09-15): el owner decidio que el merito rige desde el dia uno, medido por LIFT contra el holdout (no por tasa cruda, que es lo que el argumento de §4 y de «alternativas descartadas» realmente refuta). Todo lo demas sigue vigente. Los parametros numericos marcados como del ORQUESTADOR son configurables y se ajustan con QA real
resumen: La campaña de proximidad usa el campo `locations` del pase de Wallet (Apple: hasta 10 por pase, radio ~100 m, texto por ubicacion; Google: `merchantLocations`, hasta 10 por objeto, radio fijado por Google, sin texto por ubicacion). Como el pase es UNO por consumidor compartido entre todos los comercios (ADR 0033), las 10 ubicaciones son un recurso escaso POR CONSUMIDOR. Se reparten en dos bolsas: UTILIDAD (hasta 3 locales con relacion viva; muestra el propio saldo del consumidor; siempre encendida, sin turno ni cuota) y REACTIVACION (hasta 5 TURNOS de 5 dias sobre relaciones dormidas). El turno es un PRESTAMO: lo gana quien NO tiene al cliente y lo devuelve al vencer; separacion minima de 400 m entre turnos activos del mismo pase, maximo 1 turno por negocio y consumidor, cola por rotacion pura (FIFO), cooldown de 30 dias por negocio y consumidor, cuota por negocio en TURNOS concurrentes (no en campañas), y un HOLDOUT aleatorio como unico oraculo de efecto. Nadie «lanza» proximidad: no hay boton de enviar; la cola coloca. El consumidor apaga las promociones de un negocio desde una seccion de Configuracion de su portal, sin perder lo transaccional ni su saldo; `free` no corre campañas y bajar de plan esta BLOQUEADO mientras haya alguna activa (calcado del bloqueo de locales). El refresco del pase va por un carril propio y silencioso (`pass_refresh`) que no toca el cooldown ni posterga campañas. Limites medidos y declarados: `maxDistance` solo ACHICA el radio (no hay «zona»), no existe reporte de impresion en ninguna plataforma (la exposicion solo se controla al COLOCAR), y en Android el mensaje no viaja en el aviso.
---

# 0065 — La proximidad por wallet es un turno rotativo con separacion geografica

## Contexto

De los 13 escenarios del ADR 0064, el canal de proximidad cubre tres con un costo de infraestructura
de cero: el pase de Wallet ya lleva un campo `locations` y **el sistema operativo** muestra el pase
en la pantalla bloqueada cuando el telefono esta cerca — sin app, sin permiso extra, sin bateria, sin
push. Hoy no lo usamos: `buildPassJson` (`wallet/apple.ts`) y `buildLoyaltyObject`
(`wallet/google.ts`) no escriben ubicaciones.

Es tambien **el canal mas invasivo** del arco, y el owner fue explicito: hay que evitar que todos lo
usen, que un consumidor reciba 10 avisos el mismo dia, y **no se cobra por campaña** (el motor va
incluido en el plan), asi que el racionamiento tiene que ser no monetario.

### Hechos medidos (2026-09-15), con su fuente

**Apple** (documentacion vigente de Wallet Passes, leida por la API de datos de developer.apple.com):

- `locations`: «An array of **up to 10** objects». Cada objeto tiene exactamente `latitude`,
  `longitude`, `altitude` (opc.) y **`relevantText`** (opc., el texto de la pantalla bloqueada).
- **`maxDistance` es una clave del PASE, no de cada ubicacion**, y «the system uses the **smaller**
  of this distance or the default distance»: **solo achica el radio**. No se puede tener un radio
  distinto por local ni agrandar el default.
- Nuestro pase es **`storeCard`** (`wallet/apple.ts:61`). Para ese estilo la guia de Apple dice:
  ubicaciones relevantes soportadas, radio **pequeño (~100 m)**, y **`relevantDate` NO soportado**
  — la relevancia por HORA no se puede expresar en nuestro pase.
- Lo que aparece es una **tarjeta pasiva** en la pantalla bloqueada: sin sonido ni vibracion.

**Google** (referencia REST de `LoyaltyObject` y `MerchantLocation`, release notes 2025-10-14):

- El campo es **`merchantLocations`** («These locations will trigger a notification when a user
  enters within a **Google-set radius**»). El campo `locations` viejo esta **deprecado** y «is
  currently not supported to trigger geo notifications».
- `MerchantLocation` tiene solo `latitude`/`longitude`: **radio no configurable**, y dispara cuando el
  usuario «**dwells there**» (se queda), no al pasar. **No hay texto por ubicacion**: el aviso es
  generico de Google, y es una **notificacion real**, no una tarjeta pasiva.
- **10 por clase y 10 por objeto** (release notes). Fuentes **secundarias** (integradores): radio
  ~150 m y tope de **4 avisos/dia**; **no** se toman como firmes. Un proveedor (Splio) publica que
  los mensajes con geofence estuvieron «temporalmente no disponibles» en Google Wallet: la funcion es
  reciente e inestable en Android.

**Ninguna de las dos plataformas reporta impresiones**: no hay callback de «la tarjeta aparecio».

**Nuestro codigo** (leido, no supuesto):

- La etiqueta de «el pase cambio» es **una sola columna**, `consumer_account.message_updated_at`
  (`wallet/passkit.ts`, `passesUpdatedSince`). Cambiar `locations` sin tocarla ⇒ el dispositivo no
  baja el pase nuevo.
- La notificacion visible de una actualizacion la produce el `changeMessage: "%@"` del campo
  «Ultima novedad», y iOS solo la muestra **si ese valor cambio**. Tocar `locations` sin tocar
  `latest_message` ⇒ actualizacion **silenciosa**.
- El unico camino actual para forzar la actualizacion (`wallet/rotate.ts`) encola una fila
  **`transactional`**, y una `transactional` **saltea el cooldown y posterga las campañas
  pendientes** (`wallet/push-plan.ts`). Refrescar ubicaciones por ahi le comeria el turno a un push
  de campaña.
- Un negocio tiene como maximo **3 locales** (`PLAN_LOCATION_LIMITS`: free 1, plus 3).
- El pase es **uno por consumidor y proveedor** (`wallet_pass_consumer_provider_unique`) — decision
  del ADR 0033 que sostiene el auto-enrolamiento por escaneo y **no se reabre**.

## Decision

1. **Dos bolsas con reglas opuestas.**
   - **UTILIDAD** — locales con **relacion viva** (compra en los ultimos 30 dias, o saldo vivo de
     puntos/sellos). Hasta **3** por pase, ordenados por ultima actividad. El `relevantText` es el
     **propio estado del consumidor** («Panaderia Luis: te faltan 2 sellos», «Tenes un premio para
     canjear en …»). **Siempre encendida, sin turno, sin cuota, no es marketing.** Es lo que hace
     que el pase se gane su lugar en el telefono. *(Parametro «3» y formato del texto: orquestador.)*
   - **REACTIVACION** — locales con **relacion dormida** (ultima actividad —orden o alta— hace
     `dormant_days` o mas). Hasta **5 turnos activos** por pase (decision del owner).
   - Invariante duro: 3 + 5 = 8 ≤ 10. Sobran dos por diseño.
2. **El turno es un prestamo.** Un turno es `(campaña, consumidor, local)` por una **ventana de 5
   dias** (decision del owner). Al vencer se devuelve; su resultado queda escrito. Un negocio no
   vuelve a encolar al mismo consumidor hasta **30 dias** despues del fin de su ultima ventana
   (derivado de la regla del owner «una oportunidad por comercio por mes»; el numero es del
   orquestador). **Maximo un turno activo por negocio y consumidor.**
3. **Separacion geografica, no exclusividad temporal.** Dos turnos activos del mismo pase deben
   estar a **≥ 400 m** entre si (decision del owner). Es lo que evita cuatro tarjetas en una misma
   cuadra; la geografia hace el resto (nadie camina a 100 m de ocho puertas distintas en un dia).
   La separacion rige **entre turnos**; un turno puede convivir con un local de utilidad cercano
   *(orquestador)*.
4. ~~**Cola por rotacion pura (FIFO por `queued_at`).**~~ **SUPERSEDIDA POR EL ADR 0066**
   (owner, 2026-09-15: «desde dia uno»). Lo que decia: el merito por resultado no entraba en fase 1
   porque, sin reporte de impresion, «compro en su ventana» esta sesgado hacia los clientes que iban
   a volver igual. **El argumento era correcto pero apuntaba al blanco equivocado**: refuta la
   **tasa cruda**, no el merito. El 0066 rankea por **lift** (tasa con turno − tasa del holdout),
   que es justo la resta que deshace el sesgo del ejemplo, con **encogimiento hacia el promedio
   global** para los que tienen poca historia (la «balanza con piso para debutantes» del ADR 0064
   §6) y **FIFO como desempate**.
5. **Holdout como unico oraculo.** Una fraccion **aleatoria** de los turnos elegibles se **retiene**
   (no se coloca en el pase, no recibe cupon) y se registra igual; su tasa de compra en ventana es la
   linea base. **No cuesta alcance** —la cola ya raciona— y no consume ni slots del consumidor ni
   cuota del negocio. *(Fraccion 10 %: orquestador.)*
6. **Cuota por negocio en TURNOS concurrentes, no en campañas.** «Podes tener N turnos vivos a la
   vez»; se recupera al vencer, sin reseteo mensual. Su funcion es frenar el abuso patologico, no
   repartir: **lo que raciona es la agenda del consumidor** (≤5 activos, 400 m). *(N = 50:
   orquestador.)*
7. **Nadie «lanza» proximidad.** No hay boton de «enviar ahora». El owner define audiencia, mensaje y
   beneficio; **la cola coloca**. El volumen queda acotado por la fisica: hay que pasar por la puerta.
8. **La exposicion solo se controla al COLOCAR.** Limite declarado: como no hay callback de
   impresion, «maximo 2-3 avisos por dia» **no se garantiza, se hace improbable** con las reglas 1-3.
   No se apoya en el tope de 4/dia de Android (fuente secundaria): si no existe, el diseño no se
   mueve.
9. **Refresco silencioso por carril propio.** Nueva clase `pass_refresh` en `wallet_push_queue`:
   APNs vacio a los dispositivos Apple + `PATCH` del objeto de Google; **sin Web Push, sin
   `addMessage`, sin tocar `latest_message` ni `last_push_at`, y sin postergar campañas** en el
   planificador. El tick sube `message_updated_at` para que el dispositivo baje el pase.
10. **Android, conservador y declarado.** Mismas reglas de colocacion. Como Google no admite texto
    por ubicacion, **el mensaje no viaja en el aviso**: el aviso es el generico de Google y el mensaje
    vive **dentro del pase** (un modulo de texto por turno activo). Sin `addMessage` (seria un push,
    no proximidad).
11. **Opt-out por negocio, en una seccion de Configuracion** (decision del owner, 2026-09-15). El
    portal del consumidor gana `/wallet/settings` con un interruptor por negocio, encendido por
    defecto (escanear = alta + consentimiento, ADR 0033 §2). Apagarlo saca al consumidor de la
    audiencia de ese negocio y le cancela los turnos vivos; **lo transaccional y la bolsa de
    utilidad siguen**, porque el propio saldo no es publicidad. La marca
    (`program_membership.marketing_opt_out_at`) la escribe **solo esa accion del consumidor** — es
    un discriminante de intencion y ningun otro camino del arbol puede escribirlo (ADR 0060).
12. **Free no corre campañas, y bajar de plan esta BLOQUEADO** (decision del owner, 2026-09-15):
    «para bajar de plan debe desactivar las campañas activas como sucede con los locales». Se calca
    el mecanismo existente —la funcion pura `decidePlanChange` con **orden de guardas declarado**—
    con una guarda nueva `downgrade_blocked_campaigns` + `deactivateCount`, **despues** de la de
    locales. No es una pausa automatica: el owner desactiva y despues baja.
    - **Residual, decision del ORQUESTADOR:** el bloqueo vive en **nuestra** ruta, y el plan puede
      aterrizar en `free`/`none` sin pasarla (cancelacion desde el dashboard de Stripe, impago) —
      exactamente el agujero del ADR 0060. Para sostener el invariante que el owner si decidio, el
      webhook pausa las campañas `active` con `pause_reason = 'plan_downgraded'` en la misma
      transaccion que escribe el plan. Cubre el camino que el bloqueo no ve; no lo reemplaza.
13. **Ranking de asignacion: NUNCA por fuerza de la relacion.** El valor de un empujon es la
    probabilidad de que cambie el resultado, no de que el cliente venga. El cliente frecuente va a la
    bolsa de utilidad; el turno lo gana quien no lo tiene.

## Consecuencias

- **Migracion aditiva**: `campaign`, `campaign_location`, `campaign_turn`, `coupon_redemption`,
  `pass_placement`, `program_membership.marketing_opt_out_at`, y la clase `pass_refresh` en el check
  de `wallet_push_queue`. Ninguna columna existente cambia de significado.
- **El tick es un endpoint autenticado por `CRON_SECRET` disparado desde GitHub Actions** (Vercel
  Hobby: 2 crons diarios ya usados — gotcha de `CLAUDE.md`), idempotente, con lock por consumidor.
- **Metrica honesta para el owner:** «estas en el pase de K de tus C clientes» sale de
  `pass_placement` y explica por que no se muestra.
- **Lo que este canal NO puede hacer, y va por push en sus propias specs:** relevancia por hora
  (franja muerta), fecha (cumpleaños, evento), y llegar a quien no tiene pase instalado.
- El alcance real depende de cuanta gente **conserva el pase**; no se conoce hasta operar.

## Alternativas descartadas

- **Un pase por negocio** (multiplicaria los 10). Rompe la decision central del ADR 0033: un solo
  QR, escanear = alta + consentimiento, cero friccion. Descartada sin reabrir.
- **«Zona» en vez de puerta** (una ubicacion por barrio del consumidor con mensaje rotativo).
  **Muerta por medicion**: `maxDistance` solo achica. Ademas, un radio grande deja la tarjeta
  permanentemente en la pantalla bloqueada — ruido.
- **Asignar los slots por frecuencia de visita.** Le da el recurso a quien no lo necesita (el
  frecuente venia igual). Lo cazo el owner; se corrige con las dos bolsas.
- **Un turno activo por consumidor a la vez.** Confundia ocupacion con exposicion: dejaba 7 slots
  sin usar para prevenir un problema que la geografia ya previene. Lo cazo el owner; se corrige con
  la separacion por distancia.
- ~~**Merito por resultado desde el dia uno en proximidad.**~~ **REVERTIDA por el ADR 0066.** El
  ejemplo sigue siendo valido y por eso se conserva: A apunta a 100 dormidos que iban a volver solos
  (30 vuelven sin campaña, 33 con) y mide 33 %; B apunta a 100 perdidos (2 sin, 10 con) y mide 10 %.
  A gana el ranking generando +3 contra +8 de B. **La conclusion correcta no era «no hay merito en
  fase 1» sino «no se rankea por la tasa cruda»**: la ultima frase de este item —«solo el holdout
  separa esos dos numeros»— es justamente la receta, porque el holdout se retiene **desde el primer
  turno**. Rankeando por 33−30 = +3 contra 10−2 = +8, gana B, que es lo correcto.
- **Cobrar por slot o por turno.** Decision del owner: incluido en el plan.
- **Limitar «campañas por mes».** Una campaña puede apuntar a 3 o a 3.000; el incentivo seria meter
  todo en una. Se cuenta en turnos, como las plataformas de ads cuentan impresiones.

## Referencias

- Apple: [Pass (maxDistance, locations)](https://developer.apple.com/documentation/walletpasses/pass) ·
  [Pass Design and Creation — Relevance](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html)
- Google: [LoyaltyObject](https://developers.google.com/wallet/reference/rest/v1/loyaltyobject) ·
  [MerchantLocation](https://developers.google.com/wallet/reference/rest/v1/MerchantLocation) ·
  [Release notes 2025-10-14](https://developers.google.com/wallet/docs/release-notes)
- Secundarias (no firmes): [PassKit — GPS notifications Google vs Apple](https://help.passkit.com/en/articles/12441270-gps-location-notifications-google-wallet-vs-apple-wallet) ·
  [Splio — geofence temporalmente no disponible en Google Wallet](https://helpcenter.splio.com/kb/guide/en/geofenced-messages-temporarily-unavailable-on-google-wallet-5y55KPdMRZ/Steps/3381904)
