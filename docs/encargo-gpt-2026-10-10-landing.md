# Encargo para GPT — 2026-10-10: nueva landing del comercio (checkpass.club)

Lo arma Claude a pedido del owner, despues de una sesion de posicionamiento y competencia. **Tu trabajo tiene dos
partes: (1) enriquecer el mensaje y proponer los nombres de los planes, (2) reescribir la landing con el sistema de
diseño que ya tiene.** Es zona GPT (pantallas y estilos, ADR 0114).

## 0. Rama `dev`, sin push

Commits chicos en `dev`. Nada de merge a `main` ni push: el paso a live lo hace Claude con OK del owner
(`docs/TRABAJO-EN-PARALELO.md` §3). Si escribis spec, numerala desde la siguiente libre (`node tools/check-numbers.ts`).

## 1. Donde esta

- Landing del comercio: `apps/public/src/app/page.tsx` (la raiz; `/negocios` redirige aca).
- Secciones: `apps/public/src/app/negocios/{preview,campaign-section,closing-sections}.tsx`, estilos en
  `negocios/negocios.css` y `globals.css`.
- **Respeta el patron de diseño actual**: `eyebrow`, `kicker` en mayusculas, `h2` con una palabra en `<em>`,
  `section-heading`, tarjetas, `plan-grid`, `final-cta`, los previews ilustrados. Nada de rediseñar desde cero:
  se reorganizan secciones y se reescriben textos; las piezas nuevas salen del mismo lenguaje visual.
- Ya existen la red publica `/explorar` y las fichas `/lugares/[slug]`: la landing tiene que llevar ahi para mostrar
  la red.
- Tuteo (no voseo), español de Ecuador. Lanzamiento en **Cuenca**.

## 2. Que es el producto (posicionamiento acordado con el owner)

**Categoria:** red de fidelizacion para comercios locales — «herramientas de nivel cadena para el comercio de barrio».

**Lo que el comercio tiene que entender en 10 segundos:**
1. **Herramientas de nivel top** que hasta ahora solo tenian las cadenas, por el precio de un almuerzo a la semana.
2. **La red:** los otros comercios de la ciudad **te mandan clientes nuevos**. Este es el diferencial: las apps de
   tarjeta de sellos (Perkstar, Boomerangme, Loyalzoo) fidelizan a quien ya entro; Square/Toast son caras y atadas a
   su caja. Nadie mas le trae al comercio clientes que todavia no lo conocen.
3. **El POS:** caja con ordenes por mesa, escaneo del pase del cliente y ticket impreso por Bluetooth.
4. **Marketing con un solo click:** campañas armadas que se encienden con un boton y trabajan solas.

**Frase guia (enriquecela, no la copies literal):** «CheckPass Club te da lo que tienen las grandes cadenas —tarjeta de
cliente en el celular, marketing que trabaja solo y una caja con mesas— y ademas te conecta con los comercios de tu
ciudad para que te manden clientes nuevos.»

**Para el cliente final** (una seccion corta, porque al comercio le importa que su cliente lo quiera usar): una sola
tarjeta en el celular para todos sus lugares favoritos, sin descargar app, y regalos sorpresa de comercios vecinos.
Ojo: los puntos de un comercio **no** se gastan en otro; no lo sugieras.

## 3. Funcionalidades que EXISTEN hoy (solo se promete esto)

| Para que le sirve al comercio | Funcionalidad real |
|---|---|
| Que lo descubran | **Venta cruzada en red**: cuando un cliente compra en otro comercio de la red, puede recibir un regalo sorpresa tuyo (rubro distinto, a menos de 2 km). Ficha publica en `/explorar` y `/lugares/[slug]`. Afiche y QR de inscripcion por local |
| Que vuelvan | Programa de **sellos o puntos**; pase en **Apple Wallet / Google Wallet** o en el navegador, sin descargar app; avisos push |
| Marketing con un click | Plantillas que se encienden con un boton: **Bienvenida**, **Venta cruzada**, Te extrañamos, Cliente en riesgo, Recuperar, Cerca del premio, Premio sin canjear, **Horas valle** (llena las horas flojas), campañas por cercania |
| Operar como cadena | **Mostrador**: sumar sellos, canjear premios, validar cupones solo; **POS** con ordenes por mesa, mesas del local, escanear el pase y cobrar, **ticket impreso** por Bluetooth; **catalogo cargado con IA** desde una foto o un PDF del menu |
| Conocer a sus clientes | Lista de clientes con su etapa (nuevo, frecuente, en riesgo…) |
| Equipo y locales | Personal con PIN y permisos; varios locales; kit de marca y diseño de la tarjeta |

**NO prometas** (no existen todavia): vencimiento de puntos/sellos, cashback, reporte de retorno («lo que la red te
trajo»), tarjetas de regalo, referidos, WhatsApp o email. Si queres insinuar el futuro, una linea generica tipo
«y vienen mas» sin nombrar nada.

## 4. Planes (decision del owner, 2026-10-10)

- **Se acaba el plan gratis.** Todo es de pago con **prueba gratis de 3 meses con todo incluido**, para todos.
- **Plan base: $20 USD/mes**, 1 local. Incluye programa, wallet, mostrador, catalogo, clientes, y de marketing
  **solo Bienvenida y Venta cruzada** («las dos sirven al comercio y a la red»).
- **Plan superior** (precio a proponer; referencia de la investigacion: ~$45/mes, hasta 3 locales): todas las
  campañas (Te extrañamos, En riesgo, Recuperar, Cerca del premio, Premio sin canjear, Horas valle, cercania).
- Local adicional: precio a proponer (referencia ~$12–15/local).
- **Los nombres de los planes los propones vos** (el owner lo pidio explicito). Da 2–3 opciones de pares de nombres
  en tu respuesta y usa la que recomiendes.
- **Sin decidir:** en que plan va el **POS** (hoy es un modulo que se activa por negocio, no por plan). Hasta que el
  owner decida, mostralo como parte de la plataforma sin atarlo a una columna, y anotalo en tu handoff.
- Mantene la nota «precio referencial» al pie. **La prueba de 3 meses y el plan base con Venta cruzada todavia no
  estan en el sistema de cobro** (hoy el alta crea el plan `free` y las campañas son solo de `plus`): es trabajo de
  Claude. La landing no pasa a live hasta que eso este o el owner diga lo contrario.

CTA principal: de «Crear mi negocio gratis» a algo del estilo «Pruébalo gratis 3 meses» (sin tarjeta no esta
decidido: no lo digas).

## 5. Que te pido

1. **Primero, en tu respuesta al owner** (antes de tocar codigo): la estructura de secciones propuesta, el hero
   (titulo + bajada, 2–3 variantes), los nombres de los planes, y los copys de cada seccion. Enfoque: **valor que el
   comercio percibe** (mas clientes, que vuelvan, vender en horas flojas, verse profesional), no lista de funciones.
2. Estructura sugerida (mejorala): hero con la propuesta de valor → la red (como te mandan clientes, con link a
   `/explorar`) → marketing con un click (plantillas como tarjetas, actualizar `campaign-section.tsx`) → el POS y el
   mostrador → como funciona en 3 pasos → lo que vive tu cliente → planes con la prueba de 3 meses → preguntas
   frecuentes (actualizadas: que pasa al terminar la prueba, si los puntos sirven en otros comercios, si el cliente
   necesita descargar algo) → CTA final.
3. Actualiza los previews ilustrados para que muestren la red y el POS, no solo la tarjeta de sellos.
4. Revisa en 390 px y en escritorio, modo claro y oscuro. Corre `typecheck` y `lint` del paquete `public` y los
   e2e que toquen la landing (si alguno afirma textos viejos, actualizalo: es arreglo mecanico).
5. Handoff en `docs/estado/gpt.md`: que cambiaste, que quedo abierto (POS en planes, precios finales).
