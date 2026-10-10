---
adr: 0134
fecha: 2026-10-10
estado: aceptada
resumen: Se elimina el plan gratis. Todo comercio nace en una prueba de 90 dias con todo incluido (`plan='trial'` + `trial_ends_at`) sin pedir tarjeta; despues paga el plan base ($20/mes, $200/año: 1 local, Bienvenida y Venta cruzada) o el superior ($49/mes, $490/año: 3 locales, todas las campañas). Sin suscripcion viva y con la prueba vencida el comercio queda BLOQUEADO (panel, mostrador, POS, inscripcion y campañas), con sus clientes intactos; al pagar vuelve todo. Cancelar corta al fin del periodo pagado y se puede reanudar. Reemplaza el piso `free` del ADR 0058 y la baja inmediata del ADR 0063.
---

# 0134 — Planes pagos con prueba de 90 dias

## Contexto

Hasta hoy hay dos planes (`entitlements/catalog.ts`): `free` (1 local, solo la Bienvenida) y `plus` ($20, 3 locales,
todas las campañas). Todo el cobro (ADR 0058, 0060, 0063, specs 0063/0064/0072) esta armado sobre `free` como piso:
cancelar aterriza en `free` (`_downgrade.ts`), existe la ruta `settle-free`, y los bloqueos de bajada comparan contra
`locationLimitForPlan("free")`.

El owner, 2026-10-10, despues de la sesion de posicionamiento (competencia: Perkstar £15–60, Square Loyalty
$49–149/local, Toast ~$185; el diferencial es la red que manda clientes): «pense en tener un plan gratis, pero no, van a
ser trial gratis y todo de pago … te doy una prueba gratis de 3 meses que incluye todo esto, luego son $20 al mes».

PROD el 2026-10-10 (leido por SQL): 3 comercios, los tres `free`/`active`, ninguno con Stripe.

## Decision

Todas las decisiones son del owner del 2026-10-10 salvo las marcadas *(tecnica)*.

1. **No hay plan gratis.** Planes: `trial` (prueba), `base`, `plus` (el superior) y `none` (sin acceso). Los nombres
   comerciales los propone GPT con la landing; los ids internos no cambian cuando lleguen *(tecnica)*.
2. **Prueba de 90 dias con todo incluido, para todos**, sin tarjeta al registrarse: el alta no cambia, solo el plan que
   escribe. Durante la prueba el comercio tiene lo del plan superior.
3. **La fecha de fin se guarda** (`subscription.trial_ends_at`), no se calcula: el owner necesita **extenderla** a mano
   mientras crece la red. Hoy la extiende Claude por SQL; despues, el panel de plataforma (`admin.checkpass.club`,
   `apps/platform`, spec propia).
4. **Plan base: $20/mes o $200/año**: 1 local; de marketing **solo Bienvenida y Venta cruzada** («ambas sirven al
   comercio y a la red»).
5. **Plan superior: $49/mes o $490/año**: hasta 3 locales y todas las campañas (Te extrañamos, En riesgo, Recuperar,
   Cerca del premio, Premio sin canjear, Horas valle, campañas propias).
6. **La tarjeta se puede poner antes del dia 90 y el primer cobro cae el dia 90** (Stripe `trial_end`). Si quedan menos
   de 48 h de prueba, Stripe no acepta `trial_end` en Checkout (`Sessions.d.ts:3007`, stripe@22.5.0) y se cobra en el
   acto *(tecnica)*.
7. **Al vencer la prueba sin suscripcion viva, el comercio se BLOQUEA**: panel (solo queda la pantalla de pago),
   mostrador, POS, login del personal, inscripcion de clientes nuevos, Bienvenida, Venta cruzada desde y hacia el, y
   todas sus campañas. **Los clientes conservan pase y saldo.** Al pagar (o al extenderse la prueba) vuelve todo como
   estaba, incluidas las campañas que el bloqueo pauso.
8. **Cancelar corta al fin del periodo pagado** y se puede **reanudar** antes. Revierte la baja inmediata del ADR 0063,
   cuyo motivo («pagaba Plus y ya solo podia tener 1 local») desaparece: ya no hay un plan menor al que caer mientras se
   paga.
9. **Cambiar de plan con suscripcion viva entra**: subir de base a superior cobra la diferencia prorrateada en el acto;
   bajar de superior a base exige el mismo ajuste previo que hoy (archivar locales de mas, apagar campañas que el base no
   incluye) y el precio nuevo rige desde la proxima factura, sin devolucion.
10. **Se mantiene el anual** con 2 meses gratis.
11. *(tecnica)* **Un solo eje de acceso**: «tiene suscripcion viva O la prueba no vencio». Lo deciden una funcion pura en
    TS (guards) y una funcion SQL (consultas del consumidor y del marketing), con la misma tabla de casos como oraculo
    de las dos. Las campañas activas se pausan con un motivo propio (`billing_blocked`) por un barrido diario y por el
    webhook, y se reanudan al recuperar el acceso.
12. *(tecnica)* Los 3 comercios de PROD pasan a `trial` con fin a 90 dias de la migracion.

## Consecuencias

- Mueren `free`, `settle-free` y la distincion `free`/`none` de `derive.ts` (ADR 0060 [R2-7] se conserva en su forma
  nueva: una tarjeta rechazada durante la prueba no quita la prueba).
- Hacen falta 4 precios en Stripe (base y superior, mensual y anual) en test y en live: los crea el owner en el
  dashboard; la app los lee de `STRIPE_PRICE_{BASE,PLUS}_{MONTHLY,YEARLY}_{TEST,LIVE}`.
- La landing (encargo GPT 2026-10-10) no sale a live antes que esto.
- El impago (`past_due`/`unpaid`) sigue sin bloquear: es PARQUEADO #54, aparte.
- Bloqueo por barrido diario: entre el vencimiento y el barrido una campaña ya activa puede seguir enviando hasta ~24 h.
  Los guards (panel, mostrador, POS, inscripcion) cortan en el acto.

Implementacion: spec 0189.
