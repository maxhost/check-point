---
adr: 0103
fecha: 2026-09-29
estado: aceptada
resumen: Los beneficios de la red (propios, cruzados, horas valle, reactivacion) se ENTREGAN sin tope en la cuenta del cliente en checkpass.club («Mis beneficios»), filtrados por rubro no competidor y ≤ 2 km; la Wallet solo AVISA y nunca lleva el cupon de otro comercio. El aviso del escaneo acredita e invita a abrir la cuenta (hasta 2 por dia con compra; 1 recordatorio el dia sin compra). Horas valle = un tipo de beneficio con franja propuesta por la red desde los escaneos, visible a no-clientes y dormidos. Cuando varios comercios compiten por un lugar: urgencia → rotacion → cercania, con novedad, comercio nuevo, exploracion y horario de la persona.
---

# 0103 — Los beneficios viven en la cuenta; la Wallet solo avisa

## Contexto

CheckPass emite UN pase por cliente para toda la red (ADR 0031/0033). Google Wallet permite 3 avisos con
notificacion por pase cada 24 h (doc oficial, leida el 2026-09-29) → el cupo es de toda la red, y hoy cada
escaneo gasta uno (`wallet/google-object.ts:142-165`, `TEXT_AND_NOTIFY`; Apple `changeMessage`,
`wallet/apple.ts:86-94`). Apple, HIG de Wallet: «Never use a change message for marketing or other
noncritical communication». Con 20 comercios por cliente, la cola de avisos crece mas rapido de lo que se vacia
(owner). Planteo completo: `docs/red-y-atencion.md`; horas valle y modelo: `docs/red-horas-valle-y-modelo.md`.

**Decisiones del owner (2026-09-29, textuales resumidas; fuente: esos dos docs y `docs/TASKS.md`):**
- «"mis beneficios" seria la pantalla inicial [de la PWA], no el QR con el pase».
- Filtro: rubro no competidor = distinto `category_gcid` («mismo rubro exacto»); radio **2 km**; desde el GPS
  del telefono, o el ultimo escaneo si niega el permiso; **«Todo filtrado»** (tambien sus propios comercios).
- «En el wallet nunca metemos el cupon de otro comercio […] el cupon vive en la cuenta checkpass.club».
- Aviso del escaneo: **variante 2** — acredita e invita a abrir la cuenta; hasta 2 por dia si compra; si no
  compra, 1 por dia para recordar abrir la cuenta.
- Cupon cruzado en el recibo del escaneo **desde el dia uno** (E).
- Horas valle: prioridad («lo mas importante para tratar de conseguir que la gente compre»). Horario de
  apertura lo carga el comercio **en Marca** (A); publico: no-clientes **y** dormidos (B); beneficio: sellos o
  puntos extra segun el programa, un producto del menu, o texto libre («2x1 en cerveza») (C); la franja la
  elige **la red**, editable por el comercio que quiera mas control (D).
- Orden entre comercios: «urgencia mas rotacion mas cercania» (F) + **novedad, comercio nuevo, exploracion,
  su horario**.
- NO se le pide al comercio que costee sellos extra ni un nivel VIP de red; juego de la ciudad y aliado que
  paga: fuera por ahora; WhatsApp descartado como canal de la plataforma.

## Decision

1. **Entregar ≠ avisar.** Todo beneficio de todo comercio se entrega en «Mis beneficios» (cuenta del cliente,
   `checkpass.club`, pantalla inicial de la PWA), sin tope. El aviso es un empujon para abrir la cuenta, nunca
   el portador del beneficio.
2. **La Wallet solo avisa.** Nunca lleva un beneficio ni un cupon de OTRO comercio, ni en el texto que notifica
   ni en campos silenciosos. Lleva los sellos/puntos del comercio donde se escaneo y el enlace a la cuenta
   (`/c/[webViewToken]`, ya existente).
3. **El aviso del escaneo** (variante 2): cada escaneo acredita y el texto invita a abrir la cuenta; como mucho
   **2 avisos de escaneo por dia** por pase; el dia sin escaneo, **1 recordatorio** para abrir la cuenta. El
   tercer aviso de Google queda libre.
4. **Filtro de lo que se ve:** beneficios de comercios de distinto `category_gcid` que el de referencia, a ≤ 2 km
   de la ubicacion (GPS; si no, el ultimo local escaneado); aplica tambien a sus propios comercios.
5. **Horas valle = un tipo de beneficio** con ventana horaria:
   - la red propone la franja floja de cada local desde `core.order.created_at` (+ `location_id`, `total`,
     `business.timezone`), dentro del horario de apertura que carga el comercio en Marca; el comercio puede
     editarla;
   - visible a no-clientes y a dormidos de ese comercio, solo mientras la franja esta abierta;
   - contenido: unidades extra del programa activo (sellos o puntos), un producto del catalogo, o texto libre.
6. **Orden cuando varios compiten por un mismo lugar** (el destacado de la cuenta, el recibo, el aviso
   dirigido): urgencia → rotacion → cercania, enriquecido con novedad (lo que nunca vio), comercio nuevo en la
   red, el horario habitual de la persona y una fraccion de exploracion al azar (medible contra el grupo de
   control, ADR 0066).

## Consecuencias

- La spec 0110 (etapas por rubro) sigue valiendo para **la etapa** de cada relacion; su push por campaña queda
  subordinado a este modelo (lo que sale deja de ser «un push por campaña»). Requiere revisarla antes de cerrarla.
- Hace falta un **horario de apertura por local** (no existe: grep vacio) y un **tipo de beneficio con franja**.
- El hueco declarado en `red-y-atencion.md` §6b se cierra en parte: el cliente de iPhone sin PWA recibe el aviso
  del escaneo con el enlace a su cuenta.

## Abierto (no decidido — va a la spec o al owner)

- *(orquestador)* el recordatorio del dia sin compra, ¿siempre o solo si hay algo nuevo en la cuenta?
- *(orquestador)* los filtros previos al orden: cupo del comercio agotado → no sale; beneficio ignorado 3 veces →
  descansa. El owner no los eligio ni los descarto.
- Pesos exactos del orden, umbral de «franja floja» (propuesta: < 40 % de la mediana, repetida 5 de 8 semanas),
  fraccion de exploracion (propuesta ~10 %).
- Sin verificar en un telefono: si tocar el aviso de Wallet abre el pase (2 toques hasta la cuenta) o la cuenta.
- Riesgo: la HIG de Apple; el aviso acredita (transaccional) y ademas invita a la cuenta — tono a cuidar.
- Google AUP («an issuer cannot promote a separate issuer's products»): con la decision 2 el pase no promociona
  a otros comercios; la cuenta web no es un pase.
