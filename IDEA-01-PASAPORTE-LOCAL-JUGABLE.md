# Idea 01 — Mi Pasaporte: wallet de fidelización gamificada para comercios físicos

## Tesis

**Mi Pasaporte** es una web app/PWA de fidelización y activación comercial para bares y, después, otros comercios físicos de Cuenca. El consumidor tiene una sola cuenta/wallet donde ve sus sellos, puntos, cupones y oportunidades de juego. Los negocios usan una consola móvil para validar compras, otorgar oportunidades, configurar premios y medir resultados.

La propuesta no es vender códigos QR, una ruleta ni cupones aislados. Es ayudar a un comercio a convertir:

```text
visita -> compra verificable -> experiencia/premio relevante -> mayor consumo o retorno
```

La capa de "ruta" hace que el wallet sea útil en más de un local desde el inicio. Dos bares aliados bastan para iniciar una primera Ruta de Bares, pero cada beneficio conserva siempre su presupuesto, reglas y lugar de canje.

## Problema

- Los bares y comercios ya pueden publicar promociones, pero no saben con precisión qué cliente las usó, si aumentaron consumo, ni si lograron una segunda visita.
- En horas valle, una promoción publicada en redes no alcanza necesariamente a clientes que podrían volver en ese momento.
- Dentro del local, existe oportunidad de aumentar ticket y venta de productos de mayor margen, pero el personal no cuenta con una herramienta rápida para activar incentivos personalizados.
- Los clientes acumulan tarjetas, cupones o programas separados; instalar una app por comercio es una fricción innecesaria.

## Propuesta de valor

### Para el consumidor

- Una cuenta web única, sin descarga obligatoria, accesible desde QR o NFC.
- Un wallet que conserva sellos, oportunidades de juego, cupones y beneficios de todos los locales adheridos.
- Descubrimiento de una ruta local de bares, eventos y beneficios disponibles.
- Premios y juegos vinculados a visitas y compras reales, no publicidad genérica.

### Para el comercio

- Convertir visitas y compras en oportunidades de venta adicional, retorno y fidelización.
- Validar compras y canjes desde el teléfono del bartender/cajero.
- Configurar premios, límites, vigencias, horarios, productos objetivo y presupuesto promocional.
- Medir check-ins, compras acreditadas, juegos, cupones emitidos/canjeados, retorno y resultados por campaña.
- Captar una audiencia propia con consentimiento para campañas posteriores.

### Para marcas y eventos (etapa posterior)

- Activar una marca o evento en varios locales con una campaña distribuida y métricas consolidadas.
- Patrocinar retos, premios o rutas sin que los comercios pierdan control de sus propios descuentos y márgenes.

## Principio de wallet único y beneficios aislados

El usuario ve un único Pasaporte, pero los activos están siempre asociados a su emisor.

| Activo | Quién lo emite | Dónde puede canjearse |
|---|---|---|
| Oportunidad de juego | Bar A | Solo en experiencias del Bar A, según sus reglas |
| Cupón/premio | Bar A | Solo en Bar A, dentro de su vigencia y condiciones |
| Sellos de fidelización | Bar A | Solo para recompensas del Bar A |
| Punto/ruta común | Mi Pasaporte o campaña patrocinada | Solo en recompensas que declaren aceptar puntos de ruta |

Un cliente nunca puede usar una oportunidad o cupón financiado por el Bar A en el Bar B. Así se preserva el margen, el presupuesto y la lógica comercial de cada negocio. La ruta conecta descubrimiento y cuenta; no transfiere obligaciones económicas entre locales.

## Experiencia base

```text
Cliente escanea QR/NFC en Bar A
-> inicia sesión o se registra en Mi Pasaporte
-> se registra un check-in en el Bar A y recibe oportunidad inicial si la campaña lo permite
-> compra en el bar
-> bartender escanea el QR personal del cliente y acredita oportunidades/sellos según categoría de compra
-> cliente juega o guarda sus oportunidades, según reglas del Bar A
-> recibe cupón único
-> bartender valida el canje; el cupón queda usado y se registra el resultado
```

La consola del bartender debe requerir menos de 3–5 segundos por interacción. No se debe buscar al cliente por nombre ni registrar información detallada innecesaria en hora pico.

## Compras verificadas y datos disponibles

Un QR fijo solo prueba interacción/check-in. Para atribuir consumo se necesita una señal de compra confirmada por el comercio.

### MVP

El bartender escanea el QR personal del cliente y selecciona un preset simple, por ejemplo: `cerveza`, `comida`, `combo` o `ticket mayor a $X`. El preset acredita automáticamente oportunidades o sellos.

### Evolución

- Token/QR único impreso en el recibo.
- Integración con POS.
- Captura de categoría, monto y hora exactos de la compra cuando el sistema fuente lo permita.

Las métricas deben comunicarse con precisión:

| Métrica | Se puede medir desde el MVP |
|---|---|
| Check-ins e interacción | Sí |
| Juegos iniciados y premios emitidos | Sí |
| Cupones canjeados | Sí |
| Compras acreditadas por categoría | Sí, mediante acción del personal |
| Retorno de usuarios | Sí, por check-in/canje posterior |
| Ticket exacto o venta total | Solo con POS, recibo/token o ingreso explícito del comercio |

## Motor de campañas y ofertas

El producto inicial debe usar reglas configurables; la "inteligencia" basada en datos llega después de acumular suficiente historial.

| Señal | Acción posible |
|---|---|
| Primer check-in, sin compra | Pequeño incentivo para activar el primer pedido |
| Compra de cerveza | Oportunidad con premios orientados a comida, cocktail o segunda bebida |
| Compra de comida y bebida | Sello/premio para una próxima visita |
| Cliente frecuente | Experiencia especial, beneficio de evento o recompensa de mayor valor |
| Cliente inactivo | Oferta de retorno en su wallet, si aceptó comunicaciones |
| Hora valle | Premios u ofertas válidos solo dentro de esa franja |

La regla central es no regalar margen donde ya existe demanda. Cada incentivo debe perseguir una acción medible: aumentar ticket, vender una categoría objetivo, llenar una hora valle, conseguir retorno o activar un evento.

## Módulos de producto

1. **Activación en local:** QR/NFC, check-in, oportunidades, juegos, cupones únicos y validación.
2. **Fidelización propia:** sellos, puntos/beneficios del local y wallet del cliente.
3. **CRM y reactivación:** segmentos consentidos de clientes, campañas por horario, recurrencia e inactividad.
4. **Ruta local:** descubrimiento de los locales adheridos, eventos y retos entre negocios; no mezcla los saldos o premios privados de cada comercio.
5. **Campañas de marcas:** activaciones de terceros distribuidas en varios locales, cuando exista una red y audiencia suficientes.

El piloto necesita los módulos 1 y una versión mínima de 2; la ruta con dos bares puede estar visible desde el inicio. Los módulos 3–5 se añaden conforme exista suficiente uso y datos.

## Modelo de monetización

### Comercios

Hipótesis inicial: **$20 USD por local al mes** para bares participantes. Es un precio de entrada deliberadamente bajo, aproximadamente el valor de unas pocas cervezas, para reducir fricción comercial.

Incluye soporte QR/NFC, perfil dentro de la ruta, una o más campañas básicas, consola de validación, wallet de marca y métricas esenciales.

Este precio debe validarse: el objetivo no es que sea difícil decir que no, sino que el bar pueda renovar porque ve valor en consumo adicional, retorno o datos útiles. A $20/mes, alcanzar $1.000 MRR requiere 50 locales activos; por tanto, la retención, la venta local y el soporte operativo deben ser muy eficientes.

### Escalamiento

| Producto | Cliente | Modelo |
|---|---|---|
| Plan base | Bar/comercio pequeño | $20/mes por local, sujeto a validación |
| Plan Pro futuro | Locales con más campañas, segmentación y soporte | Precio mayor según valor y uso |
| Instalación/personalización | Comercio | Fee único por soporte, NFC y diseño de marca |
| Campaña de marca/evento | Marca nacional, organizador o municipio | Fee por campaña en varios locales + reporte |

Los clientes no pagan por usar el Pasaporte. El negocio paga por la herramienta comercial; las campañas de marcas se vuelven una segunda fuente de ingreso cuando la ruta tenga distribución comprobable.

## Medición de resultado e incrementalidad

No usar como métrica principal el número de cupones entregados. Una promoción puede subsidiar una compra que habría ocurrido de todas formas.

Por campaña se debe definir un objetivo: venta de comida, segunda bebida, ticket promedio, retorno o asistencia en hora valle. Luego se compara contra una línea base o un grupo de clientes similar que no recibió la misma mecánica.

Métricas clave:

- Check-ins -> compra acreditada.
- Compra acreditada -> oportunidad utilizada.
- Premio emitido -> cupón canjeado.
- Tasa de cerveza -> comida, cuando sea objetivo de la campaña.
- Ticket/categoría acreditada antes y después, cuando haya señal disponible.
- Retorno a 7, 30 y 60 días.
- Coste de los premios frente a margen incremental estimado.
- Renovación mensual del comercio.

## Privacidad, promociones y fraude

- Solicitar consentimiento claro y separado para WhatsApp/email promocional; no condicionar el juego o cupón a aceptar marketing futuro.
- Mostrar reglas de cada campaña: vigencia, local de canje, inventario, restricciones y condiciones del premio.
- Tratar las dinámicas de azar, sorteos o premios de alto valor con revisión legal local antes de lanzarlas; no prometer mecánicas que no puedan operar conforme a la regulación aplicable.
- Usar cupones únicos y validación de estado para impedir capturas reutilizadas.
- Limitar oportunidades por compra, cuenta, día y campaña; detectar cuentas/canjes anómalos.
- Minimizar datos personales y no compartir el detalle de clientes de un comercio con otro.

## Riesgos e incógnitas

- **Uso del personal:** si validar una compra es lento o confuso, el bartender deja de hacerlo.
- **Prueba de valor:** sin evidencia de venta adicional o retorno, $20 seguirá siendo un gasto prescindible.
- **Economía del precio:** 50 locales activos son necesarios para $1.000 MRR solo con el plan base; soporte y adquisición deben escalar.
- **Ofertas mal diseñadas:** descuentos indiscriminados pueden destruir margen en vez de aumentar consumo incremental.
- **Adopción de clientes:** el flujo de registro debe ser casi inmediato y ofrecer valor visible en el primer escaneo.
- **Fraude/regulación:** los juegos y premios requieren controles técnicos, términos claros y revisión jurídica cuando aplique.
- **Efecto red:** la ruta agrega valor, pero no debe ser requisito para que cada bar obtenga beneficio individual.

## MVP sugerido

Piloto en dos bares aliados de Cuenca:

1. Landing/PWA con cuenta de Mi Pasaporte y QR personal del usuario.
2. Un QR/NFC de check-in por bar y una Ruta de Bares visible.
3. Consola móvil de bartender para escanear cliente y acreditar preset de compra.
4. Una experiencia de juego por bar, con oportunidades, premio/cupón único y validación.
5. Sello o recompensa simple específica de cada bar.
6. Dashboard interno de check-ins, compras acreditadas, juegos, cupones y canjes.
7. Operación manual y revisión semanal de campañas, premios y fricción del personal.

Objetivo de validación: probar que el flujo se usa durante un servicio real, que al menos una campaña aumenta una acción concreta y que ambos bares aceptan pagar/renovar $20 mensuales tras el piloto.

## Criterio de comparación con las otras ideas

Evaluar frente a las demás opciones en: claridad del pagador, ingreso por cliente, número de clientes necesarios para $1.000 MRR, coste/canal de adquisición, velocidad de validación, dependencia de efectos de red, necesidad de operación humana, retención, complejidad técnica/regulatoria, margen y potencial de expansión a marcas/eventos.
