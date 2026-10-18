# 0238 — Revisión independiente frente a prácticas publicadas de ingeniería

Revisión documental solicitada por el owner. Candidato congelado: `c642af5a0d66a18c2a1ed76807c593cee39776ec`. El revisor no es autor del plan ni el agente adversarial anterior. Los documentos revisados coinciden con ese candidato; contraste estático con código pertinente. Fuentes web consultadas durante esta revisión, 2026-10-18 UTC. Sin ejecución de app, DB, APIs del proyecto, benchmarks, credenciales ni operaciones PROD. Solo se escribe este informe; sin commit, push o modificación de estados/índices.

## Dictamen

**Las mejoras 1 + 2 + 3 están bien alineadas con prácticas publicadas de grandes productos.** Reducir trabajo por pantalla, adelantar datos ya disponibles, compartir lecturas y evitar que datos accesorios bloqueen el contenido principal son medidas apropiadas aquí. No hace falta reproducir la infraestructura de Meta o HubSpot.

No encontré un nuevo fallo bloqueante demostrable de autorización o aislamiento en este borrador. Sigue abierta la decisión explícita sobre `scopeKey`/cabecera/409 que el propio documento ya reconoce. Recomiendo precisar tres aspectos de la receta antes de M0 y agregar evidencia focal sobre el JOIN durante la implementación. Esto no certifica código ni rendimiento; spec sigue borrador y ADR propuesto. No existe una certificación universal «production grade»: debemos demostrar propiedades de seguridad, consistencia, latencia, fallos y mantenibilidad en nuestro entorno.

## Qué significa aprender de esas aplicaciones

Los millones de líneas pertenecen al producto completo. Para abrir una pantalla importan los bytes que efectivamente se descargan, analizan y ejecutan, junto con los datos y dependencias del camino crítico. El tamaño del repositorio por sí solo no determina eso. Facebook publicó carga por niveles, división de código y preparación temprana de datos; también explica que cargar código y recién entonces descubrir qué datos necesita crea una cascada. Son decisiones documentadas de su reconstrucción de 2020, no una descripción garantizada de su arquitectura actual. [Meta, 2020-05-08](https://engineering.fb.com/2020/05/08/web/facebook-redesign/).

Análogamente, una DB enorme puede responder una lectura acotada sin recorrerla completa. Importan selección, filas y páginas realmente examinadas, índices, viajes, locks y conexión. El tamaño total tampoco garantiza que una consulta sea rápida. `EXPLAIN` permite inspeccionar el plan; `ANALYZE` ejecuta y sus tiempos no incluyen el transporte de la respuesta. Un plan sobre datos pequeños no prueba comportamiento en gran volumen. [PostgreSQL, documentación vigente consultada](https://www.postgresql.org/docs/current/using-explain.html).

Las empresas grandes también tienen regresiones y experiencias lentas. HubSpot documentó un programa para corregirlas con métricas de experiencia, observación de usuarios, agregación de datos y reducción de JavaScript; esa publicación no permite asumir que toda su app sea rápida hoy. [HubSpot, 2020-01-22](https://product.hubspot.com/blog/treating-frontend-performance-as-a-feature).

## Práctica, evidencia y aplicación

| Práctica | Evidencia primaria y límite | Aplicación a 0238 |
| --- | --- | --- |
| Obtener temprano solo lo necesario | Meta2020 describe preload, división de código y respuestas por partes; no prescribe nuestro framework | Seed mínimo del servidor y módulos con Suspense independiente. Mantener Inbox fuera de SSR por sus efectos, límite que ADR0154:60–62 explicita |
| Un propietario del dato compartido | Salesforce LDS comparte registros, deduplica y actualiza consumidores respetando acceso; no es una receta para cachear nuestras sesiones | Provider común y proyección autorizada; APIs continúan validando. [Documentación LDS vigente](https://developer.salesforce.com/docs/platform/lwc/guide/data-ui-api) |
| Deduplicar no equivale a cachear respuestas antiguas | HubSpot2022 colapsa lecturas de HBase en un servicio backend para evitar hotspots; «client-side» allí es cliente de DB | Compartir promesas vigentes es una idea válida. No copiar su ventana100ms, servicio adicional ni atribuirle un provider React. [HubSpot, 2022-06-01](https://product.hubspot.com/blog/preventing-hotspotting-with-deduplication) |
| Medir éxito visible, fallos y peso de recursos | HubSpot2020 usa marcadores de pantalla y comparación de assets; advierte límites de onload/DOMContentLoaded | Inbox utilizable en DOM es mejor señal que respuesta200 o skeleton. Añadir desglose de recursos/CPU sin otra plataforma. [HubSpot, 2020-03-09](https://product.hubspot.com/blog/making-hundreds-of-apps-fast) |
| Investigar viajes y localización | El equipo de Instagram/Threads encontró escrituras que viajaban entre regiones; corrigió un camino crítico específico | Separar transporte, ejecución y espera. No inferir que los160–200ms locales de una consulta son PostgreSQL lento ni proponer índices por ese tiempo. [Meta, 2021-03-22](https://engineering.fb.com/2021/03/22/networking-traffic/cutting-threads-send-latency-in-half/) |
| Memoizar con alcance explícito | React limita cache a RSC, reinicia por petición y conserva errores de la llamada memoizada | Es correcta la separación RSC/Request explícito en ADR0154:22. Crear la función memoizada una vez y usar argumentos estables. [React, documentación vigente](https://react.dev/reference/react/cache) |
| Reducir JavaScript cliente y dividir fronteras | Next explica que una frontera use client incluye su grafo de imports; Server Components permiten mantener lógica en servidor | Revisar el grafo/build entregado del nuevo provider. El hecho de pasar children servidor a un provider cliente no convierte por sí solo toda la aplicación en JS cliente. [Next, documentación vigente](https://nextjs.org/docs/app/getting-started/server-and-client-components) |

No todas las tácticas grandes son necesarias: TAO documentó caché distribuida y partición para un grafo social de escala enorme. Eso demuestra especialización por carga, no que este Dashboard necesite otro almacén. [Meta, 2013-06-25](https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/). Materializar métricas o actualizarlas por eventos puede servir al Dashboard futuro; no es dependencia ni autorización escondida de0238.

## Hallazgos y mejoras priorizadas

### I1 — Precisar bytes y CPU del arranque, sin ampliar el producto

**Prioridad alta para la receta M0; no demuestra un defecto del código candidato, que todavía no existe.** Spec0238:170 y plan:67 piden tamaño/bytes, pero no separan JS de HTML/RSC/DTO ni establecen cómo atribuir el intervalo hasta el primer GETInbox. La medición0237:93–96 deja explícitamente sin descomponer ese intervalo. El hook actual inicia el GET al montar (`analytics/inbox-state.ts:48–52`).

Escenario: el provider evita varias APIs, pero incorpora más JS o trabajo síncrono al arranque; caen los SELECT y aun así el primer GET empieza tarde. Un total de bytes y TTFB no permite distinguirlo.

Propuesta: congelar captura de JS/CSS transferidos y tamaño decodificado por recurso hasta Inbox utilizable, más bytes de documento/RSC/seed por separado. Registrar marcas de montaje/inicio del GET y una traza focal del hilo principal para análisis/ejecución, tareas largas y render. Marcar caché de recursos en la captura y no equiparar transferencia0 con ausencia de CPU. Usar el mismo método en A/B; si la traza pesada altera tiempos, separarla de la campaña temporal y declararlo. No imponer un númeroKB universal ni iniciar un refactor de bundles sin evidencia.

`backoffice-navigation.tsx:24` importa el registro de módulos; eso no demuestra que todas sus consolas lleguen a esta ruta. La conclusión exige grafo de dependencias/chunks y Network de un build real, no conteo de imports o líneas fuente.

### I2 — La condición térmica debe distinguir navegador, servidor y DB

**Prioridad alta antes de M0.** Plan:54–65 congela entorno, primera entrada y servidor/rutas calientes; conviene hacer explícitos perfil/contexto de navegador, cachéHTTP activada/desactivada, conservación de assets entre recargas y tratamiento del prefetch. Servidor caliente no significa navegador caliente.

Escenario: A reutiliza JS y B usa un contexto nuevo; una diferencia de arranque se atribuye erróneamente al JOIN. También una campaña con proxy local puede medir correctamente la reducción de operaciones y equivocarse al prometer el ahorro de un deploy remoto.

Código: `packages/db/src/local.ts:43–50` enruta HTTP/WS al proxy local y cambia TLS/pipeline; `client.ts:7–12` usa HTTP para lecturas y `client.ts:26–50` ya reutiliza poolsWS para transacciones. Registrar esa topología y distinguirla de Neon/hosting reales. No diagnosticar falta de pooling por ver un constructor drizzle por llamada; ya existe pooling en la rutaWS. La receta local sirve para comparación local; no certifica geografía, cold starts ni p95PROD. Una futura prueba equivalente en CI protegida requerirá sus recursos y scope, sin acceder a PROD ahora.

### I3 — Medir una transición habitual con layout persistente

**Prioridad media antes de cerrar la receta.** Spec:162 cubre funcionalmente navegación interna y plan:65/77 cuantifica principalmente recargas. Spec:94–111 añade reporter/refresh ante seeds y cambios, con protección razonable frente a respuestas viejas, pero tiene costo que no aparecería en la medición inicial.

Escenario: primera entrada mejora; Dashboard→otra página→Dashboard o una mutación que provoca router.refresh generan revalidación extra, reentrada en módulos o una cadena reporter→refresh→reporter. Las pruebas funcionales pueden demostrar que termina, sin mostrar cuánto trabajo añade.

Propuesta: añadir un recorrido diagnóstico A/B fijo de navegación interna con layout persistente y uno de cambio permitido del mismo ámbito, registrando waterfall, solicitudes y estado final. No exige treinta repeticiones por cada ruta ni cambiar el gate temporal de los dos casosready. Debe demostrar ausencia de bucle/fan-out y que el costo no se oculta fuera de «entrada». Conservar formularios autorizados como ya pide U2.

### I4 — Validar que el JOIN reduce costo, además del número de viajes

**Prioridad media durante A2/QA, antes de afirmar beneficio de SQL.** Spec:44/56/62–70 conserva selección, cardinalidad y fallos; esa parte está bien especificada. Falta concretar qué evidencia se adjunta para comprobar que el nuevo plan no amplifica filas o lecturas al crecer los datos.

Escenario: un viaje menos trae una proyección innecesariamente amplia o un plan distinto; el conteo mejora mientras crece el trabajo de DB. Verificar SQL/proyección y plan del SELECT combinado con varias membresías, suscripción ausente y tamaños sintéticos declarados. EXPLAIN y, si hace falta ejecutar, ANALYZE/BUFFERS solo mediante wrapper y DB protegida reservada; no ejecutado en esta revisión. Reutilizar la comprobación DB focal de A2, sin otra campaña global ni DDL. Un plan pequeño no certifica todos los volúmenes; no exigir «siempre IndexScan», pues un secuencial pequeño puede ser correcto.

Registrar también en el manifiesto cuántas candidatas/controles tiene el negocio, además de las cinco tarjetas esperadas: `server/analytics/lifecycle/index.ts:139–148` lee por negocio y la selección final se limita después, en `:253–255`. Cinco tarjetas visibles no equivalen a cinco filas leídas. Diferenciar volumen total de DB, volumen del negocio y filas tocadas. No es un hallazgo de fuga entre negocios ni una petición de optimizar ese lifecycle, reabrir0237 o reproducir el dataset histórico; precisa el alcance de lo que una fixture pequeña demuestra.

## Complejidad: qué mantendría y qué limitaría

**scopeKey HMAC:** responde a un escenario real de cookies compartidas entre pestañas, no a un estándar de velocidad. Una marca opaca comparada después de autenticar evita interpretar una intención deA como operación deB; los tickets locales no detectan por sí solos el cambio de cookie. El costo de complejidad está en adopción de transportes,409, recuperación y pruebas, no en una nueva consulta. No hay motivo demostrado para añadir almacén, claves persistidas ni infraestructura.

Mantendría el diseño acotado si se acepta expresamente: marca no credencial, sesión/negocio elegidos por servidor, formato canónico, rechazo antes de dominio, compatibilidad y sin reintento automático de escritura. No lo presentaría como requisito de Meta/Salesforce ni protección general para APIs no adoptadas. HMAC tampoco sustituye controlesCSRF o reglas transaccionales existentes. Antes de A1 basta concretar el inventario adoptado y usar utilidades criptográficas del runtime; no diseñar un protocolo genérico de sesiones. Si no se acepta, retirar la garantía y registrar la limitación, como ya indica §4.3.

**Fallback del JOIN:** es una recuperación excepcional para preservar denegaciones anteriores a billing, no una técnica habitual para hacer más rápido el camino feliz. La complejidad está justificada por los contratos locales de precedencia (`api-permission.ts:28–42`); la alternativa de fallar todo inmediatamente cambiaría esos contratos. Lo mantendría en un helper único, limitado a un intento porRequest, sin datos parciales, sin retries automáticos y sin fail-open. Registrar separadamente su ocurrencia/costo y conservar el error original; una caída completa no debe generar más intentos por consumidor. No extenderlo como patrón a todas las consultas.

## Observabilidad y límites del dictamen

La campañaA/B, fixtures temporales y conteos por operación son más sólidos que comparar dev con release. Treinta muestras dan un p95 de esa campaña con mucha sensibilidad a pocas observaciones; remuestrear seis bloques no equivale a observar miles de usuarios. No afirmar p99 poblacional, capacidad a alta concurrencia o SLOPROD a partir de eso. Incertidumbre que no sostiene el gate significa «no demostrado», como ya dice el plan; no inflar muestras hasta aprobar.

A futuro, medir usuarios reales por ruta, versión, tipo de navegación, red/dispositivo y resultado permitirá fijar presupuestos propios de experiencia y detectar regresiones. Incluir tasa de fallo/timeout y correlación cliente→API→DB sin datos privados. Eso es trabajo posterior explícito: no instalar APM/RUM, hacer tráficoPROD o agregar una plataforma como condición escondida para0238. El actual criterio relativo demuestra una mejora acotada, no que el tiempo final ya satisface toda expectativa del owner.

No necesitamos ahora microservicios, HBase, sharding, GraphQL, Redis, caché de permisos entre peticiones, CDN de datos privados, realtime o tablas materializadas para resolver estas repeticiones. Sí necesitamos ejecutar 1 + 2 + 3 con contratos cerrados y medir trabajo y experiencia del conjunto. Diferidos, QA manual y FAIL histórico continúan vigentes;102 migraciones es el registro previo, no una comprobación nueva.

## Explicación breve para el owner

Estas aplicaciones pueden ser rápidas porque cada pantalla intenta hacer poco trabajo: cargar el código necesario, pedir datos pequeños temprano, compartir lo que varios componentes necesitan y mostrar lo principal sin esperar todo lo accesorio. Detrás hay sistemas especializados para su escala, pero las ideas que nos sirven ya son las de0238. Primero eliminamos las lecturas y viajes repetidos que vimos y comprobamos también cuánto JavaScript ejecutamos; después los resultados decidirán si hace falta otra optimización.
