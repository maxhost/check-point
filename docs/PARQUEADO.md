# PARQUEADO

**Todo lo diferido, parado o pospuesto de este proyecto vive aca.** Creado por la spec 0066
(ADR 0069): `docs/TASKS.md` pasa a contener **solo el arco en ejecucion**, y este es el unico
lugar donde buscar pendientes.

Cada fila dice **de donde salio** y **por que se paro**. El detalle largo de casi todas esta en
`docs/archivo/TASKS-historico-2026-09-16.md` (buscar con `grep -n` por el numero de tarea, que se
conserva).

Regla al sacar algo de aca: **nada toca codigo sin su spec cerrada.** Varias de estas filas dicen
explicitamente «necesita spec» — eso es literal.

## Decisiones tomadas que esperan spec

| # | Que | Origen | Por que se paro |
|---|---|---|---|
| 54 | **El impago bloquea el acceso** (backoffice + cuenta + mostrador): 3 reintentos en la semana y despues un modal que pide pagar para rehabilitar. El plan NO baja y los locales no se tocan. Disparador = estado de Stripe (`unpaid`, o `past_due` con `next_payment_attempt: null`), no un contador propio | ADR **0059** | Decision del owner del 2026-09-10, nacida de una pregunta abierta de la 0063. **Se saco de la 0063 a proposito:** el bloqueo vive en `requireBackofficeSession`, el guard compartido de 8 paginas **y del mostrador** — un bug ahi deja a todos afuera |
| 55 | **Cambio de intervalo anual → mensual** | ADR **0058** §10 | Recorte explicito del owner el 2026-09-10: «entregamos mensual a anual, no anual a mensual». El sentido inverso no tiene forma barata — exige devolver ~11 meses en credito (el owner excluyo los reembolsos), o `proration_behavior: 'none'` que **cobra de inmediato y pierde lo pagado**, o `subscription_schedules` (superficie nueva) |
| 48 | **`/wallet` no se actualiza en vivo**: el consumidor recibe el push, abre el icono y ve el saldo viejo hasta recargar | spec **0060** (en `borrador`) | 4 decisiones abiertas del owner. **No es regresion ni olvido:** la spec 0031 saco la «landing en vivo» de su alcance explicitamente y sin reemplazo. Confirmado por el owner en el QA B1.4 |
| 49 | **La clave publica de Geoapify quedo sin restriccion de origen** | QA / gotcha de CORS | Fix operativo del owner para destrabar el CORS (ACAO fijo = un solo dominio). El DoD «tokens publicos restringidos por origen» de la 0023 esta **falso en produccion, a proposito**. Fix durable ya identificado (Opcion B): proxear el autocomplete por el server con `GEOAPIFY_API_KEY`, same-origin |
| 29 | **Arte final de los pases de Wallet** (Google `heroImage` + logo; Apple `strip` + logo/icon + colores), servir assets desde dominio estable y actualizar la Loyalty Class real antes del publishing access | rebrand CheckPass Club (cierre de 0032) | El rebrand se hizo app-wide; el arte quedo fuera. Necesita spec |
| 15 | **Catalogo unico de beneficios** (cupones/premios, no productos) | spec **0021** | Diferido con las campañas (ADR 0034): sus consumidores —wizard de campañas + Incentive Engine— no existen. Revive con esa fase |

## Hallazgos a decidir (nadie los acordo todavia)

| # | Que | Origen | Estado |
|---|---|---|---|
| 43 | El probe de decode **no muestra ninguna señal en pantalla hasta 8 s**, y el fallback real paga un base64 de ~6,7 MB en el camino que **siempre** falla | revisor de la spec 0052 | **Hallazgo a decidir, no acordado.** 4 opciones escritas, ninguna elegida. Si el owner reporta «tarda y no pasa nada», **es esto, no un bug nuevo** |
| 45 | En **Android** el selector de imagen ofrece solo galeria, nunca la camara (Android 13+ rutea `image/*` al Photo Picker). No existe el atributo `capture` en ningun archivo del repo | QA del owner 2026-09-05, bloque A3 | Necesita decision + spec chica. Efecto colateral ya visible: el texto de ayuda del catalogo promete «podes tomar una foto» |
| 41 | Re-enroll de un telefono existente **abre la sesion de esa cuenta** | ADR **0057** | **Aceptado temporalmente.** Antes de ampliar ese flujo se suma OTP para probar posesion del telefono |

## Deuda de verificacion declarada (no perseguida, a proposito)

| Que | Origen | Nota |
|---|---|---|
| **0058 y 0059 no tienen oraculo de comportamiento**: su unica cobertura es un barrido estatico de strings | tarea 50, demostrado **por mutacion** el 2026-09-09 | Borrar `setIsAnalyzing(true)` de `use-brand-logo.ts` apaga «Preparando imagen…» —el **DoD #1** de la 0059— con los **5 gates verdes**. La tecnica que lo cierra ya existe en el repo: `login-form-retry.test.ts` stubea `useState` con `vi.mock("react")`, ~45 lineas y cero paquetes |
| Deuda declarada de la **spec 0065** | handoff de la 0065 | `stages.tsx` en 299/300 · la precedencia de `cancel_reason` · el cableado de los botones (solo lo cierra el QA humano) · los limites de la fase A: los 400 m sin caso de integracion, el orden de los seis motivos de exclusion, y «sin el advisory lock dos corridas se pasan de cuota» (racear dos ticks reales es un volado, declarado por la propia spec) |
| **`no-mutations-left.sh` solo ve `.ts`/`.tsx` bajo los `src/`** | medido el 2026-09-16 al implementar la 0066 | Una mutacion sobre un `.md`, un `.sh` o un hook **no la caza nadie**: las dos mutaciones de esta spec (una en una skill, otra en `CLAUDE.md`) habrian sobrevivido al Stop. Se **declara** en vez de arreglarse porque tocar los hooks existentes esta fuera del alcance de la 0066 |
| Las GitHub Actions tiran **warning de deprecacion de Node 20** (`actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4` forzadas a correr en Node 24) | fuera de alcance de 0047 y 0048 | No bloquea nada |

## Pendientes del owner (no son codigo)

| Que | Origen |
|---|---|
| Alta del remitente en **Resend** + envs en Vercel + QA en vivo del recovery | spec **0046** |

## Legado de la era demo/scaffold

Las tareas **3, 5, 6, 11, 12, 13 y 14** (specs 0010–0020) quedaron marcadas «en revision» —
implementadas y con gates locales verdes, **sin PASS independiente** y con E2E/QA manual
pendientes. En los hechos las superó el producto real (backoffice, marca, programa, wizard). Se
dejan registradas aca para que nadie las reviva por error creyendo que son trabajo pendiente:
**si algo de eso hace falta, sale como spec nueva contra el producto de hoy**, no retomando una
fila de agosto. Detalle en `docs/archivo/TASKS-historico-2026-09-16.md`.
