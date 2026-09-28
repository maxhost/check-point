---
adr: 0099
fecha: 2026-09-27
estado: aceptada
resumen: La plantilla #1+#2 «Bienvenida» (`welcome`) regala un cupon con el premio estructurado (ADR 0098) a cada alta NUEVA del programa cuando el cliente INSTALA el pase (Apple = registro del dispositivo; Google = callback firmado de `save`), nunca por proximidad ni push. El cupon vale desde el dia siguiente (zona del negocio) por defecto o en la misma visita, vence a los 7/15/30 dias (def. 15), lleva un push de aviso 1/3/7 dias antes (def. 3) y se anuncia solo en la pagina de alta. Antiabuso: tope mensual por negocio (numero libre, def. 50), un iPhone recibe la bienvenida de un negocio una sola vez (registro durable, sobrevive a borrar el pase), canje presencial. Sin holdout.
---

# 0099 — La bienvenida regala al instalar el pase y vale desde el dia siguiente

## Contexto

El ADR 0091 §5 puso primero la fusion de #1 Bienvenida y #2 Segunda visita («escaneá hoy y en tu
proxima visita te llevas X»): actua sobre cada cliente nuevo y vale aunque la base sea chica. Su
dependencia, el premio emitible fuera de un turno, quedo resuelta por la spec 0106 (ADR 0098).

Medido en el arbol el 2026-09-27:

- Hoy «tiene pase» significa pase **generado**: `consumer.wallet_pass` se crea en `ensureWalletPass`
  (`wallet/core.ts:183`) al servir el pase, se haya instalado o no (`has_pass` en
  `marketing/audience-store.ts:167`).
- Apple avisa la instalacion: el sistema registra el dispositivo (`registerDevice`,
  `wallet/passkit.ts:91`, fila en `consumer.wallet_push_device`). Al **borrar** el pase lo
  desregistra y la fila se borra (`unregisterDevice`, `:108`).
- Google tiene callbacks `save`/`del` por `callbackOptions` de la clase, firmados con
  `ECv2SigningOnly` (sender `GooglePayPasses`, recipient = issuer id, claves en
  `https://pay.google.com/gp/m/issuer/keys`), **best-effort** y **sin id de dispositivo** (docs de
  Google Wallet, «use callbacks for saves and deletions»). El codigo no los tiene; la clase es una
  sola (`<issuer>.mipasaporte_identity`, `wallet/google-object.ts:15`) y el `objectId` es
  `<issuer>.<serial_number>` del `wallet_pass`.
- El cupon ya tiene vigencia propia (`valid_from`/`valid_until`, `schema/campaign-coupon.ts:79`), y el
  mostrador y la lista del cliente solo muestran los que ya empezaron (`counter/coupon-scan.ts:72`,
  `consumer/coupons.ts:115`).

## Decision (del owner, 2026-09-26 y 2026-09-27; textual en `docs/TASKS.md`)

1. **A quien.** A cada alta NUEVA del programa despues de encender la plantilla; los clientes ya
   enrolados no reciben nada.
2. **Cuando se entrega.** Solo con el pase **instalado**: en Apple, el registro del dispositivo; en
   Android, el **callback de `save` de Google** (si Google pierde el aviso, ese cliente se queda sin
   regalo — limite declarado).
3. **Desde cuando vale.** Por defecto **desde el dia siguiente** en la zona del negocio (el escaneo
   del alta no lo muestra); editable a **misma visita**.
4. **Vencimiento.** 7 / 15 / 30 dias desde la entrega, def. **15**. **Push de aviso** 1 / 3 / 7 dias
   antes, def. **3**, y tiene que caer despues de la entrega (con 7 dias de vigencia no se elige 7).
5. **Anuncio.** Solo en la pagina de alta (`/enroll/[programId]`), no en el afiche.
6. **Antiabuso.** Regalo solo con pase instalado + **tope mensual por negocio** (no por local; numero
   libre, def. **50**) + canje presencial + **filtro Apple durable y por negocio**: un iPhone que ya
   recibio la bienvenida de ESE negocio no la recibe de nuevo, aunque borre el pase o cambie de numero.
7. **Free vs premium:** «lo pensaremos luego» → sigue el gate de plan de todo marketing
   (`campaigns.enabled`) hasta que el owner decida.

## Decisiones del orquestador (consecuencias tecnicas, no de producto)

- **Sin holdout.** La pagina de alta promete el regalo: negarselo al 10 % rompe la promesa. Los
  resultados son metricas observadas (ADR 0091, Consecuencias).
- **Sin canal.** La bienvenida no sale por proximidad ni por push: se emite en el alta/instalacion.
  Sus dos columnas de canal van en `false` (el tick no la ve) y la base lo exige.
- **Un regalo por alta, para siempre** (unico por membresia), y el tope mensual se cuenta en el mes
  calendario de la zona del negocio sobre los cupones entregados.
- **Sin `coupon_max_redemptions`.** Un tope de canjes haria que un regalo ya prometido se rechace en
  el mostrador; el freno es el tope mensual de entrega.
- **Sin locales excluidos:** la oferta es del programa, no de un local.
- La entrega tiene tres disparadores idempotentes (registro Apple, callback Google, alta con pase ya
  instalado) y un **barrido en el tick** que recupera lo que un disparador best-effort perdio.

## Consecuencias

- Un iPhone compartido por dos personas recibe la bienvenida de un negocio una sola vez.
- En Android no hay filtro por dispositivo: el freno es el tope mensual.
- La lista de cupones del cliente muestra el regalo antes de que empiece a valer (estado nuevo),
  para que el cliente lo vea el dia del alta; el mostrador sigue sin mostrarlo hasta el dia siguiente.
- La clase de Google necesita `callbackOptions.url` configurado una vez (paso operativo).
