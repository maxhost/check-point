# Investigación de producto — Mi Pasaporte

Fecha: 2026-08-08  
Objetivo: identificar precedentes, patrones comerciales y métricas para diseñar el piloto de Mi Pasaporte en bares de Cuenca.

## Resumen ejecutivo

Mi Pasaporte no debe competir como una herramienta de QR, una ruleta o una tarjeta de sellos. Esas capacidades ya son un producto básico: QRSpin, Rollgain y otras herramientas permiten publicar juegos, premios y QR configurables con poco esfuerzo. [QRSpin](https://qrspin.io/gamification) [Rollgain](https://rollgain.com/)

La oportunidad es combinar cinco capacidades en un flujo que funcione para comercios pequeños:

1. **Cuenta/wallet única para el consumidor**, sin descarga obligatoria.
2. **Identidad y compra verificable** dentro de cada local.
3. **Motor de incentivos por comportamiento**, no descuentos masivos.
4. **Reactivación y campañas por horario**, con consentimiento.
5. **Ruta compartida para descubrir locales**, sin transferir el coste de los premios entre comercios.

La lección dominante del mercado es: el comerciante paga cuando la plataforma prueba frecuencia, venta incremental y margen protegido; no cuando solo reporta registros, escaneos o cupones entregados. Las cifras de proveedores citadas en este documento sirven como inspiración, pero no como expectativas para Cuenca: casi todas provienen de cadenas mucho más grandes y de sus propios materiales comerciales.

## Mapa de precedentes

| Referente | Qué aporta | Qué no copiar literalmente | Lección para Mi Pasaporte |
|---|---|---|---|
| Welcome World Rewards + Fabric | Pasaporte geolocalizado, check-ins, puntos, premios, activación de una región | Es temporal, centraliza premios y no demuestra compras atribuidas por comercio | La ruta atrae exploración; la venta del bar exige compra/canje verificable y ROI propio |
| Foursquare Swarm | Check-ins, colecciones, rachas, alcaldías, límites antifraude | La visita declarada no equivale a consumo ni a valor comercial | Usar juego ligero para hábito, pero no vender check-ins como ingreso |
| Niantic Sponsored Locations | Lugar físico como nodo de juego; campañas por horario; métricas agregadas | Depende de una audiencia global existente y no entrega datos individuales al negocio | La ubicación puede ser inventario promocional; controlar horarios y cercanía es útil |
| Thanx / Punchh | Fidelización conectada a compra, segmentación, campañas y medición de margen | Complejidad enterprise/POS y precios de cadena | El producto es inteligencia del cliente, no puntos; primero medir una conducta rentable |
| QRSpin / Rollgain | Juego por QR, premio, límites y branding sencillo | Son fácilmente replicables y no forman una relación comercial profunda | Juegos deben ser módulo, no propuesta central |
| Apple/Google Wallet passes | Sin app, QR personal, actualización y relevancia por ubicación/fecha | No reemplaza el CRM ni garantiza permisos de localización/notificaciones | Ofrecer "Agregar a Wallet" como capa de reenganche opcional tras crear valor |

## 1. Welcome World Rewards y Fabric

### Qué hizo

Welcome World Rewards fue el programa del comité anfitrión NYNJ para el Mundial FIFA 2026. Se accedía desde QR/enlace móvil, se hacía check-in dentro de una geocerca y se acumulaban puntos para premios. La plataforma fue construida y gestionada por Fabric Global PBC. Cada ubicación tenía 1–15 puntos por check-in, y las reglas prohibían GPS falso, VPNs, bots y cuentas múltiples. [Reglas oficiales](https://nynjfwc26.com/destination/)

Fabric se presenta como una plataforma sin código para experiencias de participación: pasaportes digitales, búsquedas, juegos, lealtad, premios y contenido ligado al lugar. También muestra experiencias de raspaditas, trivia y premios en recintos deportivos. [Fabric](https://fabric.space/) [Descripción de uso NBA](https://www.sportsbusinessjournal.com/Daily/Issues/2022/10/05/Technology/fabric-nba-web3-augmented-reality-sports-venues/)

### Qué hizo bien

- Unificó múltiples negocios y eventos bajo una experiencia reconocible.
- Bajó la fricción de entrada mediante QR y web móvil.
- Convirtió la exploración de barrios en progreso visible y recompensas.
- Definió reglas explícitas de ubicación, edad, puntos, canje y fraude.
- Dio al usuario una razón para visitar más de un local.

### Límites observables

- El programa dependía de un evento excepcional, una marca mundial y premios de alto valor centralizados.
- La acción principal era el check-in, no la compra; por eso no se puede inferir venta incremental por negocio desde sus reglas públicas.
- La investigación no encontró resultados públicos independientes de participantes, canjes, ventas atribuidas o retorno posterior al torneo. No se debe asumir que tuvo ROI probado para cada comercio.
- El programa terminó el 19 de julio de 2026; es un modelo de campaña temporal, no evidencia de retención anual.

### Aplicación

Copiar la **ruta + wallet + reglas antifraude**. No copiar un sistema basado solamente en geocerca y puntos comunes. Mi Pasaporte necesita que cada local vea una relación completa: check-in -> compra acreditada -> incentivo -> canje -> regreso.

## 2. Foursquare / Swarm

Swarm sigue usando check-ins, monedas, rachas, coleccionables y alcaldías. La alcaldía se basa en frecuencia de los últimos 30 días y limita los check-ins que cuentan; la plataforma también usa controles contra check-ins demasiado rápidos o implausibles. [Mecánicas de Swarm](https://support.foursquare.com/hc/en-us/articles/21163361393948-Fun-with-Swarm-Coins-Mayorship-Collectibles-and-Stickers) [Controles de check-in](https://support.foursquare.com/hc/en-us/articles/14884420779804-Checkin-Issues)

### Lo que funciona

- Progreso visual, colección y estatus transforman una acción banal en hábito.
- Las rachas y objetivos de categoría fomentan repetición y exploración.
- Los límites de frecuencia y plausibilidad son necesarios incluso antes de tener premios costosos.
- La privacidad importa: Swarm permite check-ins privados y controla visibilidad social. [Privacidad de check-ins](https://support.foursquare.com/hc/en-us/articles/21181809706012-Swarm-check-ins)

### Lo que falta para Mi Pasaporte

Un check-in no es transacción. Mi Pasaporte debe evitar pagar premios relevantes por simple presencia repetible. El check-in sirve para abrir una sesión/visita; las oportunidades de valor deben proceder de una compra validada por bartender, recibo/token o POS.

## 3. Niantic y lugares patrocinados

Niantic vende lugares patrocinados como nodos de juego: negocios aparecen en el mapa, muestran promociones, programan actividad/juegos en determinados horarios y reciben métricas agregadas. La página actual explica que los jugadores pueden ver el lugar aproximadamente dentro de 500 metros, mientras que la interacción y la visita "engaged" se cuentan a 40–50 metros. [Niantic Sponsored Locations](https://nianticlabs.com/en/sponsoredlocations)

### Lo que funciona

- El lugar deja de ser una dirección y se convierte en un destino con mecánica propia.
- Programar actividad para una franja horaria concreta es una respuesta directa a las horas valle.
- El negocio puede actualizar promociones y medir interacción por ubicación.
- Una audiencia ya existente permite que el mapa sea un canal de adquisición, no solo una herramienta de retención.

### Límites y aprendizaje

- El programa depende del juego, mapa y audiencia global de Niantic; Mi Pasaporte no tiene esa audiencia en su lanzamiento.
- Niantic entrega métricas agregadas, no perfiles individuales, por privacidad. Mi Pasaporte puede ofrecer al bar el historial de usuarios que consintieron y participaron en **ese** bar, pero nunca datos detallados de clientes de otros locales.
- Las reglas de Niantic excluyen lugares cuyo negocio central es alcohol; eso no aplica automáticamente a Mi Pasaporte, pero recuerda que ubicaciones, edad, seguridad y promociones requieren reglas por categoría. [Política de ubicaciones](https://nianticlabs.com/guidelines/sponsorship/)

## 4. Plataformas que realmente venden a restaurantes: Thanx y Punchh

Estas plataformas no venden puntos como fin. Venden identidad del cliente, datos de compra, segmentación, campañas y medición de resultados conectados al POS.

### Patrones validados comercialmente

- **Menos descuento indiscriminado:** Sonny's BBQ reportó bajar su descuento efectivo de aproximadamente 10% a menos de 1%, a la vez que creció 42% la base de clientes habituales y se multiplicó por cuatro el canje. Es una afirmación de proveedor/caso de cliente, no un benchmark transferible, pero muestra el objetivo correcto: incentivos precisos y coste controlado. [Caso Thanx](https://www.thanx.com/case-studies/sonnys-bbq)
- **El juego puede elevar ticket:** Punchh reporta que Cheba Hut obtuvo 36% de aumento interanual en ventas de fidelización y 5% en cheque promedio al integrar un juego con recompensas. Es evidencia comercial del proveedor, no causalidad independiente. [Caso Punchh](https://punchh.com/blog/2022/09/14/pump-up-your-loyalty-program-with-gamification/)
- **La adopción debe no afectar la caja:** Mo'Bettahs atribuye su mejora de registro a fidelización ligada a tarjeta/pago y a quitar problemas de hardware en el mostrador. [Caso Thanx](https://www.thanx.com/case-studies/mobettahs)
- **Se venden outcomes, no dashboards:** Thanx recomienda medir frecuencia, margen, fraude, ventas por hora/producto, activación y retorno; critica usar registros totales como métrica de vanidad. [Marco de reporting](https://www.thanx.com/restaurant-reporting-software)

### Aplicación

Para Mi Pasaporte, la primera campaña debe tener un solo objetivo económico: por ejemplo, aumentar el porcentaje de compras de comida entre clientes que acreditaron cerveza. La ruleta será el formato de entrega; el producto que se evalúa es el cambio de conducta y el margen.

## 5. QR/NFC y gamificación: producto básico, no foso

QRSpin permite elegir ruleta, raspadita o sorteo, definir premios/límites y publicar el QR en mesas, recibos o mostrador. Rollgain añade juegos, sellos y dashboard bajo una lógica similar. [QRSpin](https://qrspin.io/gamification) [Rollgain](https://rollgain.com/)

### Conclusión

La capacidad de crear juegos no es diferenciadora. Mi Pasaporte debe ganar por:

- Flujo de compra/canje más rápido para el personal.
- Reglas de incentivo por producto, horario, visita y retorno.
- Wallet que el usuario conserva entre locales.
- Métricas que conectan campaña con conducta y margen.
- Operación local: onboarding, soporte, diseño de campañas y casos de uso de bares de Cuenca.

NFC mejora comodidad/estética, pero QR debe ser la vía universal y el MVP. No usar Bluetooth beacons al inicio: añaden hardware y las plataformas móviles imponen restricciones de privacidad/seguridad; no resuelven mejor la validación de una compra. [Caso sobre restricciones de Bluetooth](https://www.netsolutions.com/casestudy-beakn/)

## 6. Wallet nativo y PWA

La hipótesis de evitar una app nativa está respaldada por el modelo de passes: Apple permite distribuir pases desde la web, actualizarlos y mostrarlos en pantalla bloqueada cuando son relevantes por lugar/fecha. [Apple Wallet](https://developer.apple.com/wallet/get-started/) Google Wallet también permite notificaciones de cercanía, pero requieren que el usuario habilite notificaciones y permiso de ubicación precisa y permanente para la app Wallet. [Google Wallet](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/trigger-push-notifications)

### Recomendación de arquitectura de experiencia

```text
Fuente de verdad: cuenta Mi Pasaporte en PWA
Acceso en local: QR/NFC -> PWA
Identificador del cliente: QR dinámico de cuenta
Reenganche opcional: “Agregar Mi Pasaporte a Apple/Google Wallet”
```

No hacer que Wallet sea requisito del piloto. Ofrecerlo después del primer premio/sello aumenta la utilidad sin sumar fricción inicial. Una PWA propia permite un wallet único multi-local, reglas por comercio, juegos y auditoría de canje; un pass nativo puede servir como atajo, recordatorio o identificador.

## 7. Métricas que Mi Pasaporte debe medir

### Embudo consumidor

| Métrica | Fórmula / pregunta |
|---|---|
| Escaneo -> cuenta | ¿Cuántos escaneos terminan en una cuenta utilizable? |
| Cuenta -> check-in | ¿El QR físico inicia una visita real? |
| Check-in -> compra acreditada | ¿El personal logra conectar la compra al usuario? |
| Oportunidad acreditada -> juego | ¿El juego es deseable y entendible? |
| Premio emitido -> canje | ¿El premio llega a la caja y se usa dentro de la vigencia? |
| Retorno 7/30 días | ¿La persona vuelve al local después de la experiencia? |
| Segundo local visitado | ¿La ruta aporta exploración sin sustituir los beneficios propios? |

### Métricas de negocio por campaña

| Objetivo | Métrica de resultado |
|---|---|
| Vender comida a cliente de cerveza | Proporción cerveza -> comida frente a línea base/control |
| Subir ticket | Ticket o categoría acreditada por visita elegible |
| Llenar hora valle | Compras acreditadas y canjes en franja objetivo frente a la línea base |
| Reactivar | Clientes inactivos que vuelven y compran |
| Controlar margen | Coste de premio / margen incremental estimado |
| Probar adopción | Tiempo de operación del bartender, errores y tasa de abandono |

### Métricas que no deben dirigir decisiones

- QR impresos.
- Escaneos sin cuenta o sin compra acreditada.
- Premios entregados.
- Seguidores o registros sin retorno.

Son diagnósticos útiles, pero no prueba de valor para el bar.

## 8. Antifraude y reglas mínimas

- El QR del local identifica el sitio; no acredita compras por sí mismo.
- Cada premio/cupón debe tener identificador único, estado del servidor y validación atómica: disponible -> canjeado. Una captura no puede reutilizarse.
- Registrar hora, local, campaña, usuario, miembro del personal/terminal y resultado del canje para auditoría.
- Limitar oportunidades por compra, cuenta, día y campaña.
- Usar QR de cuenta dinámico o de corta duración para el cliente; no un código estático reutilizable.
- Los tokens de compra deben expirar y estar vinculados a un local/campaña.
- Aplicar controles de frecuencia y trayecto inspirados en Swarm para check-ins de ruta.
- Mostrar reglas de premio, inventario/límite, vigencia y local de canje antes de jugar.

## 9. Qué probar en dos bares antes de construir una plataforma amplia

### Hipótesis 1 — Operación

El bartender puede escanear el QR personal y acreditar una categoría de compra en menos de cinco segundos, sin afectar el servicio.

### Hipótesis 2 — Conducta rentable

Una oportunidad posterior a una cerveza, cuyos premios favorecen comida o segunda bebida, incrementa esa acción frente a una línea base o grupo comparable.

### Hipótesis 3 — Retorno

Un premio válido en una visita futura logra más retorno a 7/30 días que un descuento inmediato indiscriminado.

### Hipótesis 4 — Precio

Si se demuestra una de las hipótesis anteriores, el bar paga $20/mes y renueva. Si no renueva, la plataforma no tiene product-market fit aunque los clientes jueguen.

### Diseño de piloto

1. Dos bares, una campaña por bar y un objetivo distinto por campaña.
2. Registro semanal de línea base: ventas/categorías objetivo, por hora si el bar puede compartirlas.
3. QR de check-in, cuenta PWA y QR de cliente.
4. Consola de bartender: escanear -> elegir preset (`cerveza`, `comida`, `combo`) -> acreditar oportunidad.
5. Un juego y cupones únicos, con canje desde la misma consola.
6. Revisión semanal con dueño y personal: fricción, fraude, coste de premios y resultados.
7. Al terminar, decisión explícita de renovación pagada.

## 10. Decisiones de producto recomendadas

### Construir primero

- Cuenta PWA, QR de usuario y QR/NFC por local.
- Saldos separados por local dentro de un wallet único.
- Oportunidades, juego configurable sencillo y cupón único.
- Consola móvil de personal optimizada para un flujo de dos toques.
- Reglas de campaña: elegibilidad, premio, vigencia, cupos, producto objetivo y franja horaria.
- Tablero de embudo y retorno por local/campaña.
- Consentimiento diferenciado para marketing y reglas públicas de premios.

### Diferir

- Integración POS; primero validar que el personal usa presets.
- Bluetooth beacons, pantalla/tablet y dispensador físico.
- IA/personalización predictiva; primero implementar reglas explícitas y juntar datos.
- Mercado de premios compartidos pagados por otros comercios.
- Campañas de marcas nacionales; se necesitan locales activos y métricas de calidad antes de vender alcance.
- Rutas con muchos locales; dos bares bastan para probar la experiencia de ruta.

## Fuentes y calidad de evidencia

- **Alta:** reglas y documentación de Welcome World, Foursquare, Niantic, Apple y Google; describen capacidades y políticas reales.
- **Media:** casos de Thanx/Punchh/Fabric; son proveedores que reportan métricas de clientes y por tanto sirven como señal, no como causalidad independiente.
- **Baja/media:** herramientas QR/wallet pequeñas y sus casos; útiles para identificar funcionalidades, no para proyectar resultados de Cuenca.

## 11. Competencia en Ecuador: el espacio real de Mi Pasaporte

La investigación local descarta una premisa peligrosa: QR, wallet, sellos y cupones sin app ya no son una novedad en Ecuador. La oportunidad no está en inventar una tarjeta digital, sino en resolver la decisión comercial que ocurre después de cada compra.

| Actor | Qué ofrece públicamente | Consecuencia para Mi Pasaporte |
|---|---|---|
| [YAPI](https://yapi.ec/) | Cartilla de sellos en navegador/Google Wallet, QR del local, QR del cliente, emisión por personal, canje verificado, recordatorios y analítica. Publica planes desde $19/mes + IVA. | Competidor directo de la capa básica y referencia de precio. No prometer "sin app" ni "wallet" como diferenciador. |
| [Ganafy](https://www.ganafy.com/) | Sellos y puntos por QR, Apple/Google Wallet, dashboard y automatización; plan gratuito limitado y plan de USD 57/mes. | Confirma que wallet + QR es una categoría competida; abre espacio entre producto básico y suite costosa. |
| [Upoints](https://upoints.ec/) | Fidelización QR, campañas personalizadas, analítica y una propuesta de "IA Autopilot"; no publica precio. | Vigilarlo, pero la IA declarativa no sustituye un wizard que haga explícito margen, coste y objetivo de una campaña. |
| [Grisbon](https://grisbon.com/) | Marketplace de ofertas: catálogo, ubicación, cupón QR, horario/cupo y reseñas verificadas. | Es competencia por descubrimiento y tráfico, pero no por la relación posterior a una compra ni por el motor de incentivos del local. |
| POS y menú QR locales — [GastroEc](https://gastro-ec.com/), [ClearPath](https://www.clearpath-ec.com/), [PLuttus](https://pluttus.app/restaurantes), [BistroPay](https://www.bistro-pay.com/) | Pedido, menú QR, caja, facturación e inventario. | Son sustitutos parciales y futuros canales de integración. No intentar reemplazar POS en el MVP. |

No encontré evidencia pública suficiente de que alguno opere en Cuenca una red equivalente de bares con campañas jugables por compra y un wallet de ruta compartida. Eso no prueba que no exista; sí indica que la búsqueda orgánica no revela un líder local claro en ese posicionamiento.

### Posicionamiento que sí puede defenderse

**Mi Pasaporte no es un programa de puntos. Es un motor de campañas rentables para locales físicos.** El local configura por sí mismo una campaña con cuatro decisiones: objetivo de consumo, productos/categorías elegibles, coste y precio de venta, y premios/reglas. El wizard calcula margen y coste máximo de la promoción, bloquea configuraciones a pérdida y recomienda una mecánica según el objetivo:

- vender una segunda bebida;
- mover comida después de una primera cerveza;
- elevar el ticket con un combo;
- dar una razón para volver en una franja u otro día;
- liquidar un producto permitido y con inventario disponible.

La ruleta no es el producto: es la primera interfaz de entrega de un incentivo cuya economía el negocio entiende antes de activarlo. El wallet único conserva la experiencia del consumidor, pero oportunidades, sellos y cupones quedan aislados por local; la ruta solo comparte beneficios que cada comercio haya aceptado explícitamente.

### Implicación para el precio de USD 20

USD 20/mes es viable como precio de entrada, pero queda casi al nivel del plan básico publicado por YAPI (USD 19/mes + IVA). Por ello no debe venderse como alternativa más barata ni como un QR con ruleta. La prueba de renovación debe responder una pregunta concreta: **¿el wizard ayudó al bar a lanzar y medir una campaña que dejó más margen incremental que USD 20?**

Para el MVP, basta una sola plantilla: `compra acreditada -> oportunidad -> ruleta -> cupón único`, más el guardrail económico. Si el wizard no puede evitar un premio a pérdida y mostrar el coste de los canjes, todavía no hay un producto vendible frente a estas alternativas.

## Conclusión

Mi Pasaporte debe tomar de Foursquare el hábito, de Niantic el lugar como destino, de Welcome World la ruta y el wallet, de Fabric la experiencia contextual, y de Thanx/Punchh la obsesión por compra, margen, retorno y medición.

La síntesis no es una app de juegos. Es un **sistema de fidelización y activación de consumo local, app-less, verificable por compra y orientado a comportamiento rentable**.
