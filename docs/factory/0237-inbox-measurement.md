# Medición de entrada al Inbox — Joyas local

2026-10-17/18 UTC. Encargo acotado por el owner: **solo medir el paso 1**, sin implementar caché, paralelización, optimización SQL, índices ni nuevos números del Dashboard.

## Entorno y método

- Fuente: `005b8235d3178295037efbf5deca29596f69c80a`, Node24.20.0 y dependencias del lockfile. Worktree propio `inbox-measurement-20261018`, `/private/tmp/checkpass-inbox-measurement/inbox-measurement-20261018`, reservado por factory. No se cambió el servidor habitual.
- Servidor separado `localhost:43151`, Next16.3.0 **desarrollo con Webpack y Strict Mode**, Chromium headless1280×900. Webpack con polling por incompatibilidad del watcher en este entorno. No equivale a un build de entrega ni a PROD.
- Configuración seleccionada: únicamente DB local comprobada por hostname, secreto de auth local, URL propia, correo console y proveedores fake. No copia de env productivo ni uso de DB remota. Owner indicó `joyas@local.com`; login/verify reales200. Cuenta ficticia Café usada antes únicamente para validar login, sin navegación al Dashboard.
- Cada corrida identificada por cabecera y requestID. Navegador captura navegación, pintura, recursos y estado HTTP/ready del Inbox. Listo significa que el DOM muestra tarjetas o el mensaje vacío, sin estado de preparación. No hubo simulación de respuestas.
- Preloader local registra SQL normalizado y HMAC efímero de SQL+parámetros para reconocer repeticiones exactas sin escribir parámetros ni resultados. Driver WebSocket instrumentado solo en este worktree. No cambia consultas, transacciones, locks ni política. Su costo no está descontado.
- HTTP se mide desde la llamada de transporte hasta cabeceras; WebSocket hasta resultado del driver. **No son tiempos de ejecución interna de PostgreSQL**. Los primeros dos casos no tienen cierre de tiempos HTTP para algunas consultas de Server Components por el envoltorio de Response de Next; sus conteos e identidad sí están registrados. Se corrigió el límite del reloj HTTP y se hicieron otras dos capturas, conservando todas.
- Antes de las capturas, el primer arranque Turbopack falló con EMFILE y reinicios; aumentar límite de archivos no bastó. Webpack/polling resolvió el arranque. Dos intentos de login tuvieron socket cerrado durante ese setup, sin medición de Dashboard. Primer lanzamiento Chromium bloqueado por sandbox; la ejecución escalada del mismo script local funcionó. No se presentan esos fallos como resultados de producto ni como PASS.

## Las cuatro observaciones

| Corrida | Condición | TTFB página | Primera pintura con contenido | Inbox listo desde navegación |
| --- | --- | --- | --- | --- |
| `inbox-joyas-first` | Primera ruta compilada bajo demanda | 19166,9 ms | 19256 ms | 26739 ms |
| `inbox-joyas-reload` | Recarga, servidor/rutas ya usados | 1357,7 ms | 1392 ms | 4185 ms |
| `inbox-joyas-profile` | Reinicio para corregir reloj HTTP; vuelve a compilar | 11510,8 ms | 11556 ms | 17752 ms |
| `inbox-joyas-profile-reload` | Recarga con instrumentación corregida | 1351,6 ms | 1384 ms | 4624 ms |

No son cuatro muestras de una misma condición, ni una distribución representativa ni una selección del mejor intento. Las entradas con compilación muestran el costo de desarrollo; no se atribuyen a consultas. Las dos recargas dejan el Inbox utilizable a4,19s y4,62s en este entorno.

En todas: InboxHTTP200, `ready`, **0 tarjetas**, preparedAt `2026-10-17T18:22:04.158Z`. No se ejecutó el fallback de evaluación diaria de3s. No se borraron/resetearon candidatas, runs, ventas ni métricas para fabricar otra condición. Estas capturas no miden el costo de renderizar/expirar/exponer tarjetas ni preparar una evaluación faltante.

## Qué pide realmente el navegador

En cada navegación se observaron estos inicios de petición al servidor:

| Ruta | Peticiones por entrada | Origen en código |
| --- | --- | --- |
| `/backoffice` | 1 | Página y layout |
| `/api/analytics/inbox` | 2 | Efecto de `useAnalyticsInbox` |
| `/api/modules` | 4 | **Dos efectos distintos** de `BackofficeNavigation` llaman `readModules` al montar |
| `/api/merchant/session` | 4 | Navegación y `TrialNotice` la piden por separado |
| `/api/onboarding/checklist` | 2 | Efecto de `OnboardingChecklist` |

Strict Mode en desarrollo repite el ciclo de efectos y amplifica los montajes. No trasladar estos conteos directamente a PROD. La duplicación por **dos efectos de módulos y dos consumidores de sesión existe en el código independientemente de esa amplificación**. Algunas peticiones de sesión/checklist se abortan al limpiar efectos; el servidor llegó a emitir consultas incluso en esos casos. No equiparar request abortado con consulta evitada. No hubo cambio de política de Strict Mode para favorecer el resultado.

## Lecturas repetidas dentro de la página

En `/backoffice` se registraron **9 consultas HTTP de datos**:

| Lectura | Cantidad |
| --- | --- |
| Sesión de Better Auth, mismo SQL y parámetros | 2 |
| Usuario de Better Auth, mismo SQL y parámetros | 2 |
| Membresía + negocio del guard, mismo SQL y parámetros | 2 |
| Suscripción para resolver acceso, mismo SQL y parámetros | 2 |
| Suscripción para mostrar plan/status | 1 |

Las primeras cuatro parejas tienen HMAC coincidente dentro de cada captura: no es solo coincidencia de tabla. Layout y página invocan el guard por separado; layout permite acceso bloqueado y página aplica el gate. Sus decisiones no son intercambiables aunque compartan datos. La última consulta usa otra proyección de la misma suscripción.

**Ya se ejecutan en paralelo.** En la última recarga, relativo al comienzo servidor de `/backoffice`:

| Pareja/consulta | Intervalos observados |
| --- | --- |
| Sesión | 326–494 ms y329–498 ms |
| Usuario | 497–689 ms y500–709 ms |
| Membresía + negocio | 713–903 ms y706–920 ms |
| Suscripción/acceso | 927–1114 ms y915–1127 ms |
| Plan/status adicional | 1140–1325 ms |

Las dos cadenas se solapan; dentro de cada cadena las lecturas dependen del resultado anterior. Por eso sumar1727ms de transporte de las9consultas no equivale al tiempo servidor de página1351ms. El hallazgo es trabajo repetido concurrente, no que todas las cargas estén serializadas.

## Recorrido del Inbox medido

Cada GET emitió **11 operaciones**:8lecturas de datos,1SELECT de advisory try-lock yBEGIN/COMMIT. No son11lecturas de negocio.

1. HTTP: sesión → usuario → membresía/negocio → suscripción/acceso.
2. WebSocket: BEGIN → try-lock → zona horaria → evaluation_run → candidatas/controles.
3. HTTP: módulos habilitados para resolver acciones.
4. WebSocket: COMMIT.

En la última recarga, dos GET del Inbox:

| Tramo | GET1 | GET2 |
| --- | --- | --- |
| Petición completa en servidor | 1586 ms | 889 ms |
| Primeras4lecturas HTTP de autenticación/acceso, suma secuencial | 977,6 ms | 658,4 ms |
| Lectura de candidatas/controles WebSocket | 4,3 ms | 30,9 ms |
| Lectura HTTP de módulos habilitados | 184,1 ms | 136,3 ms |
| Todas las operaciones instrumentadas, suma | ≈1201 ms | ≈853 ms |

Hay tiempo adicional de framework, adquisición de conexión, aplicación y otros espacios no aislados por esos relojes. En el GET1 la diferencia es≈385ms; no se le asigna causalidad SQL sin instrumentar más. La primera consulta de candidatas no fue el componente dominante en esta muestra **vacía**. No demuestra que índices o consultas sean adecuados para todos los volúmenes.

## Qué corre en paralelo y qué queda después

Última recarga, reloj servidor relativo a `/backoffice`:

- Página termina≈1351ms; el navegador pinta contenido a1384ms.
- Primeros módulos/sesión/checklist empiezan≈2359–2367ms; Inbox≈2375ms. Sus cargas se solapan: el Inbox no espera a que termine módulos para empezar.
- Una segunda petición de Inbox llega≈3724ms y termina≈4613ms; el navegador observa el estado listo a4624ms. No sumar las dos duraciones completas: se solapan parcialmente. No atribuir todo el retraso a la DB.
- El hueco después de página hasta primer GETInbox incluye descarga/ejecución/hidratación y montaje en este modo de desarrollo. La traza no separa CPU del navegador dentro de ese hueco.

Por entrada se registraron89inicios de operación SQL en el conjunto de página/APIs anteriores, incluidosBEGIN/COMMIT/lock y consultas de peticiones abortadas. Es el conteo observado en desarrollo, no una cifra de consultas necesarias ni un conteo extrapolable a producción.

## Evidencia y cierre

Artefactos locales en `/private/tmp/checkpass-inbox-measurement/artifacts/`:

- `browser-results.json`: primeras dos capturas, completas y conservadas.
- `browser-profile.json`: tercera captura.
- `inbox-joyas-profile-reload.json`: cuarta captura.
- `server-trace.jsonl`: eventos por corrida/requestID, formas SQL saneadas y tiempos.
- `preload.mjs`, `browser.cjs`, `start.mjs`: receta de instrumentación, navegación y arranque con configuración seleccionada. Log de arranque contiene correo console privado y no es un artefacto público de entrega.

Typecheck DB del harness finalEXIT0; una primera incompatibilidad del tipo de evento `connect` se corrigió antes de las capturas. Sin testDB, EXPLAIN, DDL, benchmark frío antiguo ni QA automatizado global. Esta medición usa la app real contra DB local, no una suite que opere directamente la DB. QA manual pendiente, FAIL1817,621042ms y diferidos anteriores conservados. No se afirma QA independiente ni aceptación de rendimiento.

Resultado de este paso: tiempos observados, repeticiones identificadas y concurrencia actual documentada. **No se implementó ninguna optimización.** Antes de cuantificar el ahorro posible hay que distinguir transporte de ejecución SQL, caso vacío de caso con tarjetas y desarrollo de build de entrega; esta captura no contesta esas preguntas todavía.

Cierre operativo: sign-out200 de la sesión Joyas creada por la medición y archivo privado de cookie eliminado. Servidor propio43151 detenido y sin listener; reserva de recursos factory vacía. Worktree/harness propios conservados con cambios locales y artefactos, sin integración ni retiro forzado. El checkout principal solo recibe documentación. Owner preguntó por las4lecturas: no son4logins, sino sesión, usuario, membresía/negocio y suscripción; validar una petición no exige resolver ese contexto con4consultas independientes. No se decidió ni implementó caché de autorización.
