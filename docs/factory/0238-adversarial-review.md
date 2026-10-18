# 0238 — Revisión adversarial documental

Fecha: 2026-10-17. Revisor independiente del autor documental, por encargo explícito del owner. Candidato congelado revisado: `03949d2efaa2d1764e6ebbca9a21ae2ef047c34a`. Fuente de diagnóstico: `005b8235d3178295037efbf5deca29596f69c80a`, según el informe 0237.

Dictamen: **requiere ajustes documentales antes de cerrar la spec**. La arquitectura propuesta permite abordar los hallazgos medidos sin caché de autorización entre peticiones ni nuevos servicios. Hay dos contratos incompletos que conviene resolver antes de repartir implementación. No se certifica PASS de producto ni de rendimiento; aún no existe candidato de producto 0238.

Se leyeron AGENTS.md y los protocolos de paralelo, roles y verificación; spec 0238, ADR 0154, ficha 0238 e informe de medición 0237. Se contrastaron guards RSC/API, reporter de sesión, facturación, selección de membresía, módulos, layout/página, navegación, TrialNotice, checklist y las partes pertinentes del ciclo del Inbox. Revisión estática: sin ejecutar app, pruebas, DB, APIs, red, operaciones PROD ni push. No se modificaron código, estados o índices comunes. Los archivos ajenos no rastreados del checkout no se tocaron.

## Bloqueantes para el cierre documental

### B1 — El JOIN adelantado cambia la precedencia cuando falla la dependencia de facturación

Prioridad: alta. Referencias: `docs/specs/0238-carga-inicial-del-backoffice.md:26`, `:48`, `:52`; `docs/adr/0154-contexto-del-backoffice-por-peticion.md:32` y `:34`.

La propuesta exige conservar precedencia y errores operativos, pero trata el JOIN como si únicamente adelantara la disponibilidad de datos. También adelanta una dependencia que puede fallar.

En la base, `api-permission.ts:210` obtiene membresía, `:224` puede devolver `missing_permission`, `:124` decide email y `:268` estado. Solo después se consulta suscripción (`:276`). `api-owner.ts:99`–`:133` conserva la misma separación. Un staff sin permiso obtiene 403 aunque la lectura de suscripción fuera a fallar. Con una consulta conjunta, un error propio de acceso a subscription impide obtener la membresía y produce un error operativo antes de esa denegación. Un caller sin owner o email verificado presenta variantes del mismo problema. No es un acceso concedido por accidente; es un cambio observable del contrato y una ampliación del alcance de una falla de billing.

Escenario comprobable sin alterar el esquema: hacer que la capa de lectura falle cuando el SQL referencia subscription, dejando operativa la consulta de membresía/negocio. Solicitar una superficie con permiso ausente, email no verificado o negocio suspendido. Comparar la denegación base con la consulta combinada. Probar aparte el caller autorizado que sí necesita billing: su error no puede convertirse en acceso permitido.

Corrección propuesta: especificar una vía excepcional que, si falla la consulta combinada, permita resolver membresía/negocio sin subscription y aplicar las decisiones anteriores al gate de billing. Si el caller llega al gate que requiere billing, propagar la falla; no inventar una suscripción ni interpretar error como fila ausente. Reutilizar lo obtenido excepcionalmente dentro del Request, sin reintentos ilimitados. Los objetivos de tres/cuatro lecturas siguen correspondiendo a operación normal; los fallos ya se reportan aparte según §3.3. Revisar también los callers que deliberadamente omiten billing mediante su opción existente.

La recuperación usa la misma identidad ya autenticada, y conserva modo, filtros, orden y limit; no cambia a otro modo para encontrar un negocio válido. Si las filas cambian durante la recuperación, se decide con su resultado íntegro y no se mezcla una membresía nueva con una suscripción previa. No hay garantía de snapshot histórico tras una consulta fallida; tampoco la base ofrece atomicidad entre sus lecturas separadas. Un segundo fallo sigue siendo operacional. En API-permission el gate de PIN es posterior al de billing (`:278`): no devolver pin_change como denegación anterior a un billing todavía desconocido. En páginas distinguir el guard que omite billing por allowBlocked/suspensión de la presentación que aún puede necesitarlo. Esta recuperación nunca sustituye controles transaccionales del writer.

Alternativa: documentar y aprobar expresamente que la equivalencia de precedencia se limita a denegaciones de dominio con consultas exitosas. Eso modifica la promesa actual. Recomiendo conservarla mediante la vía excepcional, sin ampliar el producto.

Aceptación faltante: test focal de falla exclusiva de billing para permiso/email/estado y caller autorizado, además de las filas ausentes que ya exige la spec. No simular una falla total de DB para este caso: no distingue el problema.

### B2 — Falta cerrar el ciclo del seed en un layout persistente y del reporter cuando pierde el negocio

Prioridad: alta. Referencias: `docs/specs/0238-carga-inicial-del-backoffice.md:67`–`:84`, `:104`–`:107`; `docs/adr/0154-contexto-del-backoffice-por-peticion.md:44`.

La spec exige invalidación y descarte de resultados viejos, pero no define qué ocurre con nuevas props del seed, contexto sin membresía o transiciones de acceso/rol mientras el layout sigue montado. La versión 1 identifica la forma del contrato; no es una revisión temporal del dato.

Evidencia concreta de la base:

- `session-view.ts:137` devuelve `authenticated:true`, con `business:null`, `membership:null` y `billing:null` cuando la membresía dejó de estar activa. Eso no es «sin sesión» ni «identidad distinta», los dos casos de limpieza nombrados expresamente en §4. El reporter no revoca la sesión.
- `backoffice/layout.tsx:18` decide el shell de bloqueo; `:37` decide montar checklist por rol; `:43` decide montar TrialNotice. `backoffice-navigation.tsx:240` recibe nombre, rol y permisos como props. Actualizar solo módulos dentro del nuevo provider no cambia por sí mismo esas decisiones del árbol RSC.
- El layout permite owner sin email verificado. GET módulos aplica `requireApiMember` → `memberLadder` y lo deniega por email (`api-permission.ts:124`). La spec conserva correctamente ese gate, pero restricted necesita una salida cuando cambie email/acceso, aunque userId/businessId sigan iguales.

Escenarios que faltan concretar:

1. Con la página abierta, desactivar la membresía y recuperar foco: el reporter entrega usuario autenticado sin negocio. Debe retirarse el contexto del negocio y seguirse la puerta vigente, sin conservar navegación/tarjetas de la membresía anterior.
2. Revocar un permiso manteniendo usuario y negocio: la revalidación debe actualizar los permisos que realmente usa la navegación. Cambiar el rol también debe reconciliar checklist y otros consumidores que el servidor montó condicionalmente.
3. Pasar de seed restricted por email a email verificado y volver con foco: reevaluar restricción según el nuevo contexto antes de recuperar módulos. No dejar restricted permanente ni hacer bucle de recuperación mientras siga denegado.
4. Un GET/RSC comenzó antes de una mutación local confirmada; llega después con el mismo usuario/negocio. Reemplazar el provider con ese seed reinserta datos viejos si solo se compara la identidad. Inicializar únicamente con useState evita esa sobrescritura, pero entonces necesita otra regla para aceptar datos nuevos de un refresh posterior.

Corrección propuesta: añadir tabla de transiciones y fijar una política concreta de seed y revisiones. Como mínimo: seed inicial por ámbito; generación local que cambia ante invalidación/mutación; invalidación inmediata ante authenticated:false o business/membership ausentes; actualización coherente de nombre/rol/permisos/billing/módulos; tratamiento de restricted por cambios relevantes del mismo ámbito; y una única recuperación/refresh de árbol cuando cambia una decisión estructural del shell. Documentar si una respuesta nueva de RSC inicializa, se descarta o reconcilia, sin presentarla como nueva solo por llegar más tarde. No hace falta agregar una tabla, endpoint ni una revisión persistida en DB.

Aceptación faltante: browser con navegación interna manteniendo layout, router refresh/respuesta tardía tras mutación, membresía nula en reporter y restricted→ready con mismo user/business. La matriz actual contiene invariantes generales suficientes para detectar el error, pero falta el protocolo común que permitirá a ambos writers implementar la misma solución.

## Mejoras que deben incorporarse al plan o congelarse antes del experimento

### R1 — Añadir un control de deriva temporal al criterio de mediana/p95

Prioridad: media. Referencias: `docs/specs/0238-carga-inicial-del-backoffice.md:112`–`:116`; `docs/factory/0238-plan-carga-backoffice.md:50`–`:67`.

La receta conserva instrumentación, config y muestras fallidas, lo que es correcto. Sin embargo M0 corre antes del trabajo y M1 después: aun con mismo host/red, carga concurrente y temperatura del backend pueden cambiar. Con treinta muestras y la exigencia de mejora estricta/no regresión sin margen, una variación pequeña puede dictar PASS/FAIL sin relación con el cambio. «Si hay ruido» no tiene todavía una regla observable para determinarlo. No propongo SLA ni tolerancia de producto nueva.

Congelar antes de M0 el estimador de p95, definición de Inbox utilizable para vacío y cinco tarjetas, resolución del reloj y cómo se expresa incertidumbre. Conservar M0 y añadir en M1 un control de la base sin optimizar con el mismo harness; comparar bloques predeterminados de base/candidato bajo condiciones equivalentes, sin escoger los favorables. Si no puede ejecutarse ese control, registrar el límite causal y definir qué señal de deriva invalida la comparación. Esto no requiere evaluar ni elegir las mejoras 1/2/3 por separado.

La ficha ya reserva la receta para M0: es mejora de ese gate, no evidencia de que el benchmark actual haya fallado, porque aún no se corrió.

### R2 — Especificar estado temporal y mutaciones de la fixture, además del dataset

Prioridad: media. Referencias: ficha 0238 `:45`, `:57`, `:61`; spec `:108`, `:114`.

El hash del dataset no basta si las corridas usan las mismas filas mutables sin restauración controlada. `analytics/lifecycle/index.ts:159` vence contenido; `:200`–`:217` consume recordatorios y cambia revisión; `:219` calcula peso con shownDays. La lectura tiene además exposición real. Un cruce del día del negocio o vencimiento entre M0/M1 puede convertir ready en preparing o cambiar las cinco tarjetas. La primera entrada con exposición tampoco equivale a una recarga posterior del mismo día.

Congelar un manifiesto de estado por caso: día/zona, vigencia de candidatos, estado de run/policy, shownDays/lastShownDay y recordatorios, ventana de validez de prueba/suscripción y política de renovación de sesión. Declarar snapshot/restauración protegidos entre bloques o datasets aislados equivalentes. Verificar cinco tarjetas y sus versiones/acciones al inicio y final. Mantener exposición dentro del reloj y distinguir primera exposición de recargas; no restablecer datos en mitad del intervalo medido ni fijar un reloj diferente solo en el candidato. Ante cambio de día/caso, conservar la muestra y no mezclarla con el ready solicitado.

### R3 — Hacer ejecutable el aislamiento de fallo y demora del seed de módulos

Prioridad: media. Referencias: spec `:69`; ADR `:72`; ficha `:35`.

Se exige que una lectura opcional no demore sin límite el camino crítico, pero todavía no se elige cómo cumplirlo. `modules/activation.ts:98` usa enabledSet y categoryOf. Extraer categoría del contexto elimina la segunda consulta, pero un await de enabledSet dentro del layout sigue condicionando el shell. Un timeout con Promise.race devuelve antes, pero no cancela automáticamente SQL ni su conexión; dejarlo sin observar puede acumular trabajo.

Antes de A1 elegir composición/streaming o límite de espera y fallback unavailable, señalando qué ocurre con la consulta pendiente y su rechazo. El valor debe derivarse del entorno/método acordado, sin inventarlo en esta revisión. Incluir smoke con lectura de módulos lenta/rechazada que conserve Inbox/core y una sola recuperación coordinada. Reservar explícitamente `modules/activation.ts` o el helper extraído, porque reutilizar el constructor puro con categoría precargada es parte necesaria para el objetivo de cuatro lecturas; los paths principales de la ficha no lo nombran.

### R4 — Precisar la propiedad y caducidad de promesas compartidas del Inbox/checklist

Prioridad: media. Referencias: spec `:80`, `:82`, `:98`; ficha `:73`.

La spec acierta al deduplicar solo solicitudes simultáneas. Debe añadir el caso decisivo que diferencia esa solución de un caché accidental: una promesa iniciada antes de una decisión no puede ser reutilizada como el refresco posterior a esa decisión. `inbox-state.ts:125`–`:128` invalida una revisión local al actuar; `:179`–`:182` ejecuta el refresco pendiente. Un deduplicador compartido que solo usa URL/ámbito puede volver a entregar la promesa vieja después de esa invalidación, incluso si el hook descarta su primer resultado.

Definir generación de invalidación como parte del recurso y borrar la entrada al resolver/rechazar. Una mutación o cambio de ámbito invalida el valor observable anterior y garantiza una lectura posterior nueva cuando corresponda, con como máximo una pendiente. Probar GET lento→decisión confirmada→montaje/remount/foco→resultado viejo; y fallo→reintento real. Para checklist, el AbortController de un consumidor que se desmonta (`onboarding-checklist.tsx:76`–`:89`) no debe abortar la petición compartida que todavía usa otro consumidor/segundo efecto de Strict Mode. No se necesita un caché persistente ni una nueva biblioteca.

## Aspectos revisados sin hallazgo bloqueante adicional

- Los modos de membresía de §3.1 corresponden al código leído. Página/reporter no filtran membresía activa; guards API sí, owner también filtra rol. Conservar la selección es esencial y ya está explícito. No recomendar desempates ni normalización global en este encargo.
- La relación de suscripción 0..1 y LEFT JOIN propuesto conservan fila ausente como blocked, sin obligar a una migración. No hay evidencia que justifique índices nuevos en esta revisión.
- RSC con funciones estables/argumentos primitivos y contexto explícito por Request para APIs son ámbitos correctos para el objetivo. No se promete deduplicar solicitudes HTTP distintas en servidor.
- El seed de módulos debe seguir el gate completo de su endpoint, incluido email de owner y PIN; el contrato ya dice conservarlo. No sustituirlo por la autorización más permisiva del layout.
- Mantener readInbox fuera de render/SSR/prefetch evita adelantar exposición y evaluación. El recorrido de cliente seguirá existiendo; no se debe prometer que estas tres mejoras lo eliminan.
- Los objetivos normales de conteo son razonables como objetivos comprobables, siempre que categoría/constructores de módulos se compartan efectivamente. No fueron ejecutados ni demostrados aquí.
- Se mantienen fuera de alcance Dashboard numérico/realtime, caché entre peticiones, DDL, rendimiento frío anterior y QA manual pendiente. No se solicitó decisión nueva de producto: B1 puede resolverse conservando el contrato y B2 concretando el ciclo técnico ya prometido. Si se elige degradar deliberadamente la precedencia de B1, debe explicitarse para aprobación.

Salida de la revisión: cerrar B1/B2 en spec/ADR/ficha, incorporar R1–R4 donde corresponda y revisar el delta documental. Después puede cerrarse el contrato y prepararse M0. La aceptación de implementación y la QA de combinación seguirán requiriendo evidencia sobre sus SHAs futuros.
