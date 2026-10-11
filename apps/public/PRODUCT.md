# CheckPass Club — Web pública

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

CheckPass.club se dirige a dos públicos, confirmados por el owner:

- Dueños de comercios locales que quieren atraer nuevos clientes, darles motivos
  para volver y gestionar la atención y la operación de su negocio.
- Consumidores que quieren descubrir nuevos locales y obtener beneficios.

El inicio geográfico que recoge la web actual es Cuenca, Ecuador. La web pública
sirve a ambos públicos. El owner confirma que la home de `checkpass.club` se dirige
a consumidores y que los dueños de comercios tienen una landing comercial separada.

## Product Purpose

Conectar comercios locales y consumidores mediante descubrimiento, beneficios y
fidelización. Para los comercios, CheckPass combina programa de recompensas,
marketing automático y punto de venta. Para los consumidores, permite conocer
locales, encontrar beneficios y mantener sus pases y recompensas.

La web pública debe ayudar a cada público a comprender la propuesta que le
corresponde y acceder a ella. Para comercios, el acceso actual conduce al registro
para la prueba de tres meses. Para consumidores, existe una superficie de
exploración y el acceso a su pase.

La home para consumidores incluirá una explicación breve de la propuesta para
comercios y algunos CTA hacia la landing comercial. Esta landing también será
accesible desde el menú, buscadores y enlaces directos. Debe poder entenderse por
sí sola cuando un dueño de comercio llegue sin haber visitado la home.

## Positioning

La red entre comercios conecta la fidelización de cada negocio con el
descubrimiento de otros locales: Venta cruzada puede ofrecer un beneficio de otro
comercio a una persona que compra en un negocio de la red. Los puntos y sellos
siguen perteneciendo a cada programa; no se transfieren entre negocios.

El owner señala Yelp, Foursquare en la época de los check-ins y FiveStars como
referencias del concepto para consumidores: descubrir lugares y obtener
beneficios. Estas referencias no confirman reseñas, puntuaciones públicas,
check-ins sociales, rankings ni otras funciones de esas plataformas.

## Operating Context

La web pública vive en `apps/public`, con Next.js App Router y React. Se usa desde
el navegador en teléfono, tablet o computadora. El idioma actual es español de
Ecuador (`es-EC`). El comando de desarrollo de esta app es `pnpm dev`, puerto 3003;
el repositorio requiere Node 24 mediante `nvm use`.

Las superficies actuales del código local incluyen:

- `/`: home para consumidores que explica el funcionamiento mediante ejemplos.
- `/negocios`: landing comercial independiente, con el diseño y contenido previos.
- `/programa-de-fidelizacion`, `/marketing-para-comercios` y `/punto-de-venta`:
  explicación de las herramientas para comercios.
- `/explorar` y `/lugares/[slug]`: descubrimiento y fichas ilustrativas para
  consumidores.
- `/es/privacy` y `/es/tos`: documentos legales.

Organización confirmada por el owner para la web:

- Home de `checkpass.club`: orientada a consumidores, descubrimiento de locales y
  beneficios, con una explicación breve para comercios y CTA a su landing.
- Landing comercial independiente: orientada a dueños de comercios, accesible
  desde el menú, buscadores, enlaces directos y CTA de la home.

La landing comercial usa `/negocios`. La organización está aplicada en código
local; su publicación y la QA del owner quedan pendientes. No hay comercios reales
para mostrar todavía: la home y el directorio identifican sus ejemplos.

`src/app/site-config.ts` define el dominio público y los accesos por audiencia:
registro de comercios en `business.checkpass.club` y pase de consumidores en
`my.checkpass.club`. Estos destinos pueden variar por configuración del entorno.

## Capabilities and Constraints

La oferta para comercios comprende fidelización con puntos y sellos, campañas
automáticas, Mostrador y POS, catálogo con ayuda de IA, mesas, órdenes y pedidos.
El negocio elige las recompensas y los beneficios de sus campañas. Puede usar el
programa de fidelización sin gestionar pedidos ni mesas.

La experiencia descrita para consumidores incluye descubrir locales y beneficios,
inscribirse mediante QR y consultar su pase desde el navegador o guardarlo en
Apple Wallet o Google Wallet. Cada comercio conserva su propio programa y saldo.

La prueba comercial es de tres meses con todo incluido; después hay planes pagos
Conecta e Impulso. El ADR 0134 establece una prueba de 90 días y conservación de
datos al bloquear el acceso por fin de prueba sin suscripción. El cashback está
anunciado como «Próximamente» en el código actual; no debe presentarse como una
función disponible.

Decisiones y verificaciones pendientes:

- Precisar si el concepto de check-in tendrá una función propia; por ahora es
  una referencia del owner, no un requisito funcional.
- Verificar disponibilidad real y condiciones antes de publicar nuevas promesas
  comerciales. El código local no acredita disponibilidad en producción.
- Resolver precios y condiciones definitivos con su fuente comercial: la landing
  contiene precios referenciales y hay diferencias con documentos de billing.
  Este archivo no establece una tarifa nueva ni sustituye el contrato de cobro.

## Brand Commitments

Nombre existente: CheckPass Club; el owner también lo denomina CheckPass.club.
Conservar la marca y sus activos actuales. El copy se dirige al usuario con tuteo,
sin voseo, y explica acciones y beneficios con lenguaje concreto.

No inventar testimonios, clientes, cifras de adopción, resultados garantizados ni
funciones disponibles. Distinguir claramente las demostraciones de los hechos y
las ofertas vigentes.

## Evidence on Hand

- Marca: `src/app/brand-mark.tsx`, `src/app/icon.svg` y
  `public/checkpass-icon-192-v2.png`.
- Fotografías: `public/images/`; los créditos existentes aparecen en las páginas.
  Una fotografía de ambiente no demuestra participación de un comercio.
- Explicaciones e ilustraciones: landing y páginas de producto dentro de
  `src/app/`. Son representaciones del funcionamiento, no capturas acreditadas de
  operaciones reales.
- Directorio: `src/app/explore/mock-businesses.ts`. `/explorar` avisa que nombres,
  fotos, horarios y beneficios son ejemplos, sin comercios participantes ni
  ofertas vigentes acreditados por esas fichas.
- Decisiones de producto y cobro: `../../docs/adr/0134-planes-pagos-con-prueba-de-90-dias.md`.
- La confirmación de las dos audiencias, las referencias para consumidores y la
  organización de home y landing comercial procede del owner en esta sesión de
  inicialización.

No se han aportado casos de éxito, testimonios ni métricas reales para esta
inicialización.

## Product Principles

1. Orientar la home a consumidores y dar a los comercios una landing independiente
   y accesible, con una propuesta comprensible para cada público.
2. Conectar descubrimiento y beneficios con la relación sostenida entre cada
   comercio y sus clientes.
3. Mantener la autonomía de cada negocio sobre sus recompensas y programas.
4. Explicar las herramientas con situaciones concretas y separar ejemplos,
   funciones disponibles y funciones futuras.
5. Preservar la verdad del producto antes de añadir promesas comerciales.
