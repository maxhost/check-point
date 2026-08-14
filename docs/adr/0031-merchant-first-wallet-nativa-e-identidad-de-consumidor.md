---
fecha: 2026-08-14
resumen: Mi Pasaporte se posiciona como herramienta de fidelización y marketing para comercios locales (merchant-first), con la Wallet nativa (Apple/Google) como superficie de consumidor —no una app propia de descubrimiento—; el consumidor tiene una cuenta única a nivel plataforma con N membresías, donde la identidad/perfil se reusa entre comercios pero cada membresía y su economía quedan aisladas por comercio.
estado: aceptada; supersede la "red curada/descubridor" de 0003 y reencuadra la primera experiencia consumer de 0019
---

# ADR 0031 — Merchant-first, Wallet nativa como superficie de consumidor e identidad de consumidor compartida

## Contexto

El ADR 0003 definió la V1 con tres actores y una **red curada de descubrimiento** (wallet
propio del consumidor, exploración de rutas y eventos): una mezcla de "Foursquare ×
Niantic" con app consumer generalista. El ADR 0019 asumió en consecuencia una primera
experiencia consumer dentro de una app/pantalla propia con branding del comercio.

Esa dirección arrastra el problema más caro de consumer tech: el **cold-start de un
marketplace de dos lados**. Una app de descubrimiento no vale nada para el usuario sin
densidad de comercios, ni para el comercio sin usuarios; bootstrapearla desde cero,
sin IP ni first-mover en un mercado global, es de lo más difícil que existe y no es
fundable por un equipo chico en el mercado objetivo.

Aparecieron dos hechos que cambian el análisis:

1. **El pase de fidelidad puede vivir en la Wallet nativa** (Apple Wallet / Google
   Wallet): la tarjeta, el código de barras del cliente para acreditar en el mostrador, y
   las **notificaciones push** llegan por esa vía, sin necesidad de una app propia
   instalada ni de retención.
2. **Todo el sistema vive en una única DB**, así que la identidad que un cliente carga al
   enrolarse en un comercio puede reusarse cuando se enrola en otro comercio de la
   plataforma.

El valor de la herramienta (programa de fidelidad gratis; campañas, juegos, AR, sellos
por check-in y notificaciones en el tier Plus) es **autocontenido por comercio**: cada
comercio tiene valor completo desde el día uno con sus propios clientes, sin depender de
que exista una red. Eso elimina el cold-start.

## Decisión

**Mi Pasaporte se construye merchant-first: una herramienta de fidelización y marketing
para comercios locales, no una app generalista de descubrimiento de cara al público.**

- **Superficie de consumidor = Wallet nativa.** El consumidor no necesita instalar ni
  retener una app propia para el v1: su tarjeta de fidelidad, su código para acreditar en
  el mostrador y las notificaciones viven en Apple/Google Wallet. La app propia de
  consumidor **no** es parte de esta etapa.
- **Los juegos, AR, sellos por check-in y notificaciones son parte de esta etapa**, como
  capacidades del comercio (tier Plus), no de un futuro producto consumer separado. Son el
  diferencial que impide comoditizarse como "otra SaaS de tarjeta de sellos".
- **Identidad de consumidor a nivel plataforma, con N membresías.** Un cliente tiene **una
  cuenta única** que vive en la DB de plataforma; de ella cuelgan **N membresías**, una por
  cada programa al que se enroló.
- **Invariante identidad compartida / membresías aisladas:**
  - La **identidad / perfil** (nombre, teléfono, email, el pase) pertenece al
    **consumidor**, vive a nivel plataforma y **se reusa** entre comercios. Al enrolarse en
    un segundo comercio no vuelve a cargar sus datos.
  - Cada **membresía y su economía** (que es socio del comercio A, sus sellos/puntos/
    visitas/cupones ahí) pertenece al **comercio** y queda **aislada**. Un comercio nunca
    ve la actividad, saldos ni membresías del cliente en otro comercio.
  - Es el principio de "saldos aislados por local" (ADR 0002) y de auditoría/alcance por
    comercio (ADR 0007) extendido a la identidad de consumidor.
- **La red de descubrimiento se difiere como fase futura opcional, encendida sobre
  densidad.** No se descarta la visión original: se **reordena**. La herramienta acumula
  consumidores (poseedores de pases) como subproducto de cada comercio firmado; una capa de
  descubrimiento/juegos entre comercios recién tiene sentido —y arranca *tibia*, con ambos
  lados ya presentes— cuando hay densidad. Construirla primero es la versión que se muere.

## Consecuencias

- **El destino del QR de enrolamiento queda definido**: *enrolarse en el programa del
  comercio + agregar la tarjeta a Apple/Google Wallet*. Esto desbloquea la spec del "brand
  kit" (el afiche imprimible del local), cuyo QR ahora apunta a algo concreto y valioso.
- **Supersede la "red curada/descubridor" del ADR 0003.** Se conservan los tres actores
  (consumidor, comercio, administrador de plataforma), pero la exploración de rutas/eventos
  y el wallet-como-app-de-descubrimiento salen del alcance de esta etapa y pasan a fase
  futura condicionada a densidad.
- **Reencuadra la primera experiencia consumer del ADR 0019.** El primer contacto sigue
  siendo un QR físico del comercio, pero la entrega no es una pantalla/app propia con
  branding: es el enrolamiento + el pase agregado a la Wallet nativa. El branding del
  comercio se expresa en el pase y en el afiche, no en una UI de plataforma instalada.
- **Se necesita un modelo de datos de identidad de consumidor** a nivel plataforma
  (`apps/platform` / dominio consumer ya separado por ADR 0010): cuenta, perfil reusable, y
  membresías por comercio con su economía aislada. Se especifica en su propia spec antes de
  implementar.
- **La generación y firma de pases de Wallet** (Apple PassKit / Google Wallet API), su
  renovación y el canal de push por pase son una decisión de proveedor/infra transversal;
  se resuelven en un ADR/spec propio, no acá.
- **Pendiente (no decidido en este ADR):** el mecanismo de autenticación de la cuenta de
  consumidor (OTP por teléfono en Ecuador era un abierto previo) y si el pase de Wallet
  alcanza sin login para el v1. Se cierra en la spec de identidad de consumidor.
- **El tier Plus ($20) se sostiene sobre capacidades medibles** (campañas, juegos, AR,
  notificaciones), coherente con ADR 0022; el programa de fidelidad base es gratis.
