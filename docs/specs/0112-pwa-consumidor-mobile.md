# CheckPass: PWA del consumidor en el teléfono

## Objetivo

Al abrir CheckPass, una persona debe reconocer en segundos qué beneficio puede usar, cuánto lleva acumulado en cada comercio y dónde está su pase. La app funciona como un lugar estable para consultar esas cosas; una notificación es solo una invitación para volver a verlas.

## Navegación propuesta

Cuatro destinos fijos en la barra inferior, siempre con icono y nombre:

| Destino | Pregunta que resuelve | Contenido principal |
| --- | --- | --- |
| Beneficios | ¿Qué puedo usar hoy? | Cupones canjeables, luego próximos y vencidos |
| Programas | ¿Cómo voy en cada comercio? | Tarjetas de sellos o saldo, ordenadas por actividad |
| Pase | ¿Qué muestro en caja? | QR grande, nombre y acceso a Wallet |
| Cuenta | ¿Qué datos y preferencias tengo? | Perfil, teléfono, preferencias por comercio y ayuda |

El buzón se abre con un botón en la cabecera. Es una pantalla propia con regreso claro al destino anterior, sin añadir un quinto botón estrecho a la barra. El indicador numérico aparece únicamente si hay elementos sin leer.

### Beneficios, pantalla inicial

- Cabecera corta: «Hola, Ana» y botón de actividad.
- Primer bloque: cantidad de beneficios listos, con una tarjeta principal que muestra comercio, beneficio, vigencia y acción «Ver para canjear».
- Lista vertical de beneficios restantes. Estado y vencimiento se leen sin abrir la tarjeta.
- Si no hay cupones: mensaje breve y acceso a Programas; nunca tarjetas vacías ni promociones simuladas.
- Cada cupón lleva a su detalle, con condiciones y QR para el comercio. El QR general sigue siempre accesible desde Pase.

### Programas

- Una tarjeta por comercio con logo o inicial, nombre y progreso real: sellos obtenidos/meta o puntos disponibles.
- La tarjeta abre detalle con premios, términos y actividad del programa. No mezclar en la tarjeta todas las reglas y ofertas.
- Los programas cerrados pasan al final, con estado explícito. Evitar que parezcan canjeables.

### Pase

- QR visible al abrir, en una superficie blanca amplia y con buen contraste.
- Una frase operativa: «Mostrá este código en el comercio».
- Acción de guardar en Google/Apple Wallet como opción secundaria; se mantiene la invitación del segundo ingreso que ya existe.
- Preparar una versión sin conexión para el pase, con indicación de cuándo se actualizó. Esto requiere almacenamiento local y una estrategia de actualización; instalar la PWA por sí solo no garantiza acceso sin internet.

### Actividad

- Una sola cronología para puntos, sellos, cupones, vencimientos y mensajes de comercios.
- Cada fila muestra icono por tipo, comercio, hecho concreto, fecha y destino útil. «+30 puntos · Café Norte» abre ese programa; «Tenés un 2x1» abre el cupón.
- Estados «Nuevo» y «Leído» ligados a una cuenta en servidor. Filtro simple «Todo / Sin leer» solo cuando haya volumen que lo justifique.
- El push y la actividad persistida se generan desde el mismo evento. Si se bloquean los avisos, el contenido sigue en la app; si llega dos veces el push, no se duplica la fila.
- En la primera versión se puede poblar con hechos transaccionales existentes. Los mensajes libres de comercios quedan para una fase posterior y requieren reglas de frecuencia, permisos y moderación.

### Cuenta y acceso

- Nombre, apellido y teléfono visibles; edición de datos con confirmación del cambio y estados de guardado claros.
- Preferencias de promociones agrupadas por comercio, con explicación breve de qué tipo de avisos controla cada opción.
- Si caduca la sesión, conservar la estructura visual y mostrar una pantalla de acceso con teléfono como primer campo y regreso a la sección que la persona intentaba abrir.
- La ruta de recuperación existente en el repositorio solicita un código después del teléfono. El diseño debe reflejar ese paso real mientras siga vigente.

## Lenguaje visual y comportamiento

- Diseñar primero a 320–430 px; respetar áreas seguras, texto ampliado, teclado y pulgar. Cada destino tiene una cabecera clara y una única acción dominante.
- Sistema sobrio: fondo cálido claro, tarjetas blancas, tinta oscura, verde CheckPass para acciones, color de comercio reservado para su tarjeta. Sombras suaves solo cuando indican profundidad.
- Tipografía de sistema, títulos grandes, cuerpos legibles, números de saldo destacados. Estados y vencimientos no dependen solo de color.
- Navegación estable; sin carruseles de acciones críticas ni iconos sin nombre. Los estados vacíos enseñan el siguiente paso real.
- Animación breve para transiciones y confirmaciones, respetando `prefers-reduced-motion`.

## Orden de construcción

1. Restituir estilos del portal actual y asegurar que el QR y la navegación sean usables en la PWA instalada.
2. Crear la navegación de cuatro destinos y las vistas de Beneficios y Programas con datos existentes.
3. Separar detalle de cupón y detalle de programa; ajustar Pase y Cuenta.
4. Persistir eventos de actividad y lectura en servidor; conectar notificaciones push y pantalla Actividad a esos eventos.
5. Añadir edición de perfil y pase disponible sin conexión, con pruebas de caducidad de sesión y actualización de la PWA.

## Fundamento de diseño

- [Apple: tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars): destinos estables, etiquetas visibles y pocos elementos en la navegación principal.
- [Apple: onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding): pedir solo lo necesario en contexto y posponer configuración secundaria.
- [Apple: notifications](https://developer.apple.com/design/human-interface-guidelines/notifications/): avisos breves y útiles; cuando la app está abierta, insertar la información sin interrumpir.
- [web.dev: PWA updates](https://web.dev/learn/pwa/update/): tratar datos, recursos y versiones de la PWA como capas distintas para evitar interfaces desactualizadas.
