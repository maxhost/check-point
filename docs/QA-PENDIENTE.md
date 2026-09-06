# QA pendiente del owner

**Estado al 2026-09-05.** Todo lo de acá está **desplegado en prod** (`8f52d36`, Vercel
`success`, health 200). Este archivo es el punto de retorno del QA: se tacha lo probado y se
anota el resultado **acá**, no en el chat.

> **Antes de empezar:** verificar que prod tenga el commit que vas a probar.
> `GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/status --jq '.state'` → `success`.
> Ya pasó una vez que se hizo QA contra un build viejo y los resultados no valían.

---

## Bloque A — Verificar los 3 arreglos de hoy (cortos, son los que desbloquean decisiones)

### A1. El toast del re-enroll (spec 0054 / ADR 0051)
- [ ] Re-enrolarse con un teléfono **ya registrado** (sirve `+593998877654321`, cuenta
      "Cliente iOS 4") en un programa **distinto** al que ya tiene.
- [ ] **Esperado:** aparece el toast **"Ya tienes una cuenta con ese teléfono: te enrolaste
      en el programa con tus datos."**
- [ ] **Esperado:** el pase y el portal muestran los datos **guardados** ("Cliente iOS 4"),
      no lo que se acaba de tipear. Eso ahora es correcto y el toast lo explica.
- [ ] Con un teléfono **nuevo**: el toast **NO** debe aparecer.

### A2. El cropper con archivos de galería en iOS (spec 0052)
En **marca** (`/backoffice/brand`), desde el iPhone:
- [ ] Foto de **galería** → debe abrir el modal **"Encuadra tu imagen"** (con botones
      Cancelar / Usar). Si no ves ese título, no es el cropper.
- [ ] **PNG** de galería → ídem.
- [ ] **Cámara** ("Tomar foto") → tiene que **seguir** funcionando (ya andaba; es la
      regresión a vigilar).
- [ ] Si tarda y no pasa nada: anotarlo. El probe tiene hasta **8 s** de presupuesto y **no
      muestra ninguna señal en pantalla** mientras trabaja (observación conocida, tarea 42).

### A3. Android — **el dato que cierra el ADR 0047 §4**
- [ ] En marca, subir una foto de **galería** desde el Android.
- [ ] **Anotar cuál de los dos pasa:**
  - Abre el cropper → HEIC crudo **no** llega desde Android; el tema del decoder HEVC en
    WASM queda **cerrado definitivamente**.
  - Cae al fallback (sube directo, sin modal) → HEIC crudo **sí** llega; se **reabre** la
    evaluación del decoder WASM (ADR 0047 §4).
- [ ] Verificar que la imagen **se guarda igual** en los dos casos (el fallback no debe
      bloquear la subida).

---

## Bloque B — El E2E que quedó a mitad de camino

El recorrido de comercio + cliente se probó hasta el paso 2.5 y **nunca se llegó al canje**.
Esto es lo que falta, y es el corazón del producto.

### B1. Mostrador (staff)
- [ ] Login de staff y entrar a `/backoffice/counter`.
- [ ] Escanear el QR del cliente (el del pase de Wallet **o** el de "Mi QR" en `/wallet`).
- [ ] **Acreditar** puntos: probar **venta rápida** y **venta detallada**.
- [ ] Verificar que el saldo sube en el pase de Wallet (puede tardar unos segundos por el
      push de actualización) **y** en `/wallet` del cliente.

### B2. Canje
- [ ] Escanear de nuevo y **canjear la recompensa** configurada.
- [ ] Verificar que el saldo **baja** correctamente en el pase y en `/wallet`.

### B3. Notificaciones (la regresión a vigilar)
- [ ] **iOS**: al acreditar, confirmar que llega **una sola** notificación — no el duplicado
      pase + Web Push que la spec 0038 cerró. Si reaparece, es regresión.
- [ ] **Android**: ídem, una sola.

### B4. Cierre del recorrido en Android
- [ ] Enrolarse en Chrome de Android, agregar a **Google Wallet**, activar notificaciones, y
      hacer el ciclo acreditar → canjear.

---

## Cosas que ya se probaron y **funcionan** (no repetir)

- Onboarding, marca (colores), programa, catálogo, staff.
- Enrolamiento en iOS, branding de la landing, **Apple Wallet**.
- **El ícono de inicio abre el wallet del consumidor** (specs 0050/0051) — probado y
  confirmado por el owner.
- El cropper con **cámara** en iPhone.

---

## Residuales conocidos que NO son bugs del QA

- **Tarea 29** — el arte visual del pase (logo/strip/colores reales) es todavía un
  placeholder hardcodeado. Que el pase se vea genérico es esperado, no un hallazgo.
- **Tarea 41** — el enroll entrega una sesión completa a quien conozca un teléfono ya
  registrado, sin verificarlo. **Preexistente**, pendiente de decisión del owner.
- **Tarea 42** — deuda de cobertura de la 0052 (2 líneas del probe sin test) y la falta de
  señal en pantalla durante el probe.
