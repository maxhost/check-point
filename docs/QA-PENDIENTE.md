# QA del owner — resultados y lo que queda

**Corrido el 2026-09-05 contra `8f52d36`** (el commit que estaba en prod: status `success`,
health 200). **15 de 17 ítems pasan.** Los 2 que fallan son el mismo hallazgo: el canje no
existe.

> **Al retomar:** verificar contra qué commit se prueba.
> `GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/status --jq '.state'` → `success`.
> Ya pasó una vez que se hizo QA contra un build viejo y los resultados no valieron.
> Hoy `main` = `e79305b` **sin pushear**; prod = `8f52d36`.

---

## Bloque A — Los 3 arreglos ✅ TODO PASA

### A1. El toast del re-enroll (spec 0054 / ADR 0051) — ✅ 4/4
Toast correcto, datos guardados en pase y portal, y no aparece con teléfono nuevo.
**La spec 0054 queda confirmada en vivo.**

### A2. El cropper con galería en iOS (spec 0052) — ✅ 4/4
Galería, PNG y cámara: los tres abren "Encuadra tu imagen". Sin demoras ni fallback.
**La spec 0052 queda confirmada en vivo.**

### A3. Android — ✅ **cerró el ADR 0047 §4**
El cropper **abre** con foto de galería y **el fallback no se disparó nunca**. La imagen se
guarda bien. → HEIC crudo **no llega** desde Android → **ADR 0052: el decoder HEVC en WASM
queda cerrado, no diferido.** Se evitan 1–2 MB de WASM con LGPL-3.0.

**Hallazgo lateral → tarea 45:** en Android el selector ofrece **sólo galería, nunca la
cámara** (en iPhone sí aparece "Tomar foto").

---

## Bloque B — El E2E

### B1. Mostrador (staff) — ✅ 4/4
Login, escaneo, venta rápida y venta detallada: todo acredita y el saldo sube.

**Dos observaciones del owner, ninguna es bug nuevo:**
- **`/wallet` no se actualiza en vivo:** con el portal ya abierto hay que cerrarlo y
  reabrirlo para ver el saldo. Es la **tarea 25 / spec 0031**, que sigue `pendiente`. El QA
  confirma que el hueco es visible para el usuario.
- En iOS el aviso llega por **Wallet**, no dentro del ícono de inicio. **El owner lo declaró
  aceptable.**

### B2. Canje — ❌ **NO EXISTE** → tarea 44
El mostrador sólo ofrece venta y venta rápida. No hay forma de escanear para entregar una
recompensa y descontar puntos o resetear sellos.

**Verificado en el código:** `app/api/counter/` tiene sólo `resolve` y `grant`;
`server/counter/` no tiene ningún `redeem`; la UI ofrece exactamente dos acciones. Los
premios **sí** existen y están persistidos (`core.loyalty_reward`, migración `0019`): **se
pueden configurar recompensas que nadie puede canjear.**

**Causa raíz:** las specs 0030 y 0036 se delegaron el canje **mutuamente**. La 0036 §8 dice
*"La ejecución del canje es de la 0030"*; la 0030 dice *"Solo acreditación; el canje es otra
feature, otra URL"*. Las dos cerradas, las dos coherentes — el agujero está **entre** ellas.
No es regresión. **Necesita spec propia.**

### B3. Notificaciones — ✅ 2/2, sin la regresión de la 0038
Una sola notificación en iOS y en Android, por el lado del wallet. En Android tardó bastante.

### B4. Cierre del recorrido en Android — ✅

---

## Lo que queda por probar

- [ ] **El fallback a Web Push sin pase en el wallet** — la pregunta del owner en B3.2:
      *"¿qué pasa si no agrego el pase? ¿cómo sé si las push funcionan?"* Por el **ADR 0040**
      lo transaccional sale **sólo** por wallet, con fallback a Web Push **si no hay pase
      alcanzable** (`consumerHasReachableWallet`); nunca los dos, que es lo que mató el
      duplicado de la spec 0038. **Ese camino nunca se probó en vivo.**
      **Cómo probarlo:** enrolarse con un teléfono nuevo → activar notificaciones →
      **NO** agregar el pase al wallet → acreditar desde el mostrador → debería llegar una
      notificación del **navegador** (no de Wallet).
- [ ] **Re-QA de B2** cuando exista el canje (tarea 44).
- [ ] **Android: por qué tardó bastante** la notificación en B3.2 — sin medir, puede ser el
      cooldown del worker o el propio Google. Anotarlo si se repite.

---

## NUEVO — Canje de premios (spec 0055, desplegada 2026-09-08, commit `a9cbf3f`)

**Es la feature que cierra el loop del producto: hasta hoy podias configurar premios que
nadie podia canjear.** Todo lo de abajo esta verificado contra Neon del lado del servidor
(48 tests de integracion); lo que NO tiene oraculo automatizado es el **comportamiento de la
UI**, que es exactamente lo que estos items prueban.

- [ ] **C1. Canje de Puntos.** Escanear el QR del cliente → modo **Canjear** → elegir un
      premio → confirmar. Verificar: la pantalla dice **que premio entregar**, y el saldo baja
      exactamente el costo del premio.
- [ ] **C2. Canje de Sellos con ARRASTRE.** Con la tarjeta pasada del tope (ej. 12 sellos en
      una de 10): canjear tiene que consumir **10 y dejar 2**, no dejarla en 0. Es la decision
      explicita del owner (la tarjeta nueva del mundo fisico).
- [ ] **C3. Premio que no alcanza.** Con saldo insuficiente y la configuracion por defecto, el
      premio se ve **deshabilitado** con «faltan N». No tiene que poder canjearse.
- [ ] **C4. La dispensa (config avanzada del programa, paso 4).** Activarla y canjear sin
      saldo: el canje ocurre y el saldo **queda en 0, nunca negativo**. **OJO, es a proposito:
      con la dispensa activa NO hay tope** — se puede canjear varias veces seguidas dejando
      filas de 0 unidades. Es consecuencia directa de tu decision §9; si te molesta al verlo,
      es otra spec.
- [ ] **C5. El push del canje** llega al pase de Wallet, y **un reintento no re-notifica**.
- [ ] **C6. El `i` del wallet ahora ofrece DOS accesos**: «Terminos y condiciones» (lo de
      antes) y **«Catalogo de premios»** (nuevo), con el costo y cuanto falta para cada premio.
      *(DoD sin oraculo automatizado — este item ES la verificacion.)*
- [ ] **C7. El canje aparece en el historial del dia** de la consola, distinguible de una
      acreditacion (signo `−` y la etiqueta del premio). *(Idem: el servidor esta verificado
      end-to-end, el render no.)*
- [x] **C8. Empleado deshabilitado — VERIFICADO por el owner (2026-09-08).** No puede
      loguearse, correcto. **Hallazgo nuevo, no bloqueante:** el login falla en **silencio**,
      sin ningun mensaje — parece que el login esta roto, no que la cuenta esta desactivada.
      Necesita spec propia (toast "Miembro del staff desactivado" o similar) antes de
      implementarse; no se toca a mano.

---

## NUEVO — El login avisa al staff desactivado (spec 0057, desplegada 2026-09-08, commit `239f271`)

Sale de tu propio hallazgo en C8. **Ojo: no era solo el cartel** — el login de un miembro
desactivado ademas **dejaba una sesion viva**, porque better-auth autentica sin saber nada de
las membresias. Ahora se revoca en el mismo paso.

- [ ] **S1. El cartel.** Con el staff desactivado del QA anterior, intenta entrar con su email
      y su contraseña **correcta**. Tiene que aparecer **«Miembro del staff desactivado»**.
- [ ] **S2. El reintento pisa el aviso.** Sin recargar, volve a intentar con la contraseña
      **mal**. El mensaje tiene que cambiar al de credenciales invalidas, **no** quedarse con
      el de staff desactivado ni apilar los dos. *(Este es el unico item que un test no puede
      cerrar del todo — el probe automatico cubre el mecanismo, no el navegador real.)*
- [ ] **S3. Nadie mas ve el cartel.** Entra normal con tu usuario owner: **no** tiene que
      aparecer ningun aviso.
- [ ] **S4. Presentacion.** Vos pediste «un toast»; esto es un **mensaje dentro del
      formulario**, en el mismo lugar donde sale el error de contraseña — a proposito, para que
      el reintento lo pise (S2). **Si lo preferis como toast flotante, decilo**: es un cambio
      chico, pero hay que decidir que pasa cuando conviven los dos mensajes.

---

## Ya probado y funcionando — no repetir
Onboarding, marca (colores), programa, catálogo, staff · Enrolamiento en iOS, branding de la
landing, **Apple Wallet** · El ícono de inicio abre el wallet del consumidor (specs
0050/0051) · Cropper con cámara y con galería en iPhone (specs 0040/0052) · Cropper con
galería en Android · Toast del re-enroll (spec 0054) · Mostrador: escaneo + acreditación,
venta rápida y detallada · Una sola notificación por acreditación en ambas plataformas ·
Google Wallet en Android.

## Residuales conocidos que NO son bugs del QA
- **Tarea 29** — el arte del pase es un placeholder. Que se vea genérico es esperado.
- **Tarea 41** — el enroll entrega sesión completa a quien conozca un teléfono ya
  registrado. Preexistente, **esperando decisión del owner**.
- **Tarea 43** — el probe sin señal en pantalla hasta 8 s. **Esperando decisión del owner.**
  El ADR 0052 **abarató la mitad de esta tarea**: el costo del base64 casi no tiene a quién
  afectar, porque en Android ese camino no se recorre. Queda en pie sólo lo de la UX.
- **Tarea 25 / spec 0031** — `/wallet` sin actualización en vivo (confirmado en B1.4).
