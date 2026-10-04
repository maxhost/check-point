# Tests de integracion rapidos con Postgres (monorepo TS, drizzle + Neon)

Contexto del encargo (no verificado aca, dado por el coordinador): vitest contra una rama "CI" de Neon por internet, ~8 s por test (decenas de queries secuenciales), ~3000 tests en ~6,5 min, `drizzle-kit migrate` en cada invocacion; los tests ejercitan roles/GRANT (rol restringido) y `SELECT ... FOR UPDATE`. Prod usa `drizzle-orm/neon-http` + `neon-serverless` (Pool/WebSocket) para transacciones. Sin Docker en la Mac hoy.

## 1. PGlite (Postgres WASM en proceso) con drizzle: velocidad, limites y como cambiar el driver solo en tests

### Takeaway
PGlite es el camino mas rapido y sin Docker (latencia por query sub-milisegundo en memoria, y drizzle mismo lo usa en sus tests), pero es **una sola conexion**: no puede reproducir contencion real de `FOR UPDATE` entre dos transacciones concurrentes ni el modelo multi-conexion de un Pool, y la compatibilidad de roles es parcial (`SET ROLE` funciona, conexiones como otro usuario no). Sirve para la mayoria de tests de logica SQL; los de locks/concurrencia y login con rol restringido necesitan un Postgres real.

### Cited Findings
- Benchmarks oficiales, round-trip CRUD en memoria: insert de fila chica 0,058 ms, select 0,088 ms, update 0,073 ms (PGlite memory). Postgres nativo es mas rapido en cargas grandes: 25.000 INSERTs en una transaccion 0,114 s (Postgres) vs 0,292 s (PGlite memory); 25.000 UPDATEs con indice 0,307 s vs 0,547 s. — [PGlite benchmarks](https://pglite.dev/benchmarks)
- Un miembro del equipo de PGlite: los tests de integracion de Drizzle corren en ~1/4 del tiempo con PGlite en memoria que con un Postgres completo. — [HN, comentario de dev de PGlite](https://news.ycombinator.com/item?id=40086681) (via resumen de busqueda; no se abrio el hilo completo)
- Caso reportado: 100 archivos / 1.300 tests en ~25 s en una MacBook Pro 2023, con una base PGlite en memoria por archivo de test, migracion SQL generada una vez en globalSetup y TRUNCATE entre tests; pool `threads` de vitest. (Stack Prisma, no drizzle.) — [Dennis O'Keeffe, 2025](https://www.dennisokeeffe.com/blog/2025-06-09-isolating-postgresql-tests-with-pglite)
- «PGlite is single user/connection»; corre en el modo single-user de Postgres porque Emscripten no puede hacer fork de procesos. — [README de PGlite](https://github.com/electric-sql/pglite)
- Con un solo cliente a la vez; un segundo cliente da «too many clients». `pglite-socket` permite varias conexiones mediante un multiplexor sobre la unica conexion, y advierte que «no todos los casos estan cubiertos». — [PGlite Socket docs](https://pglite.dev/docs/pglite-socket) (via resumen de busqueda)
- Junio 2026: el equipo dice que el soporte multi-conexion es «the next big piece we want to land»; hoy sigue siendo single-user mode. Confirma que Drizzle, Supabase y Prisma usan PGlite para tests. — [Electric blog, 2026-06-25](https://electric.ax/blog/2026/06/25/pglite-reaches-10-million-weekly-downloads)
- Usuario en HN: su app depende de multiples conexiones para evitar deadlocks en transacciones basicas, y por eso PGlite no le sirve. — [HN](https://news.ycombinator.com/item?id=46146933)
- Roles: un proyecto prueba RLS en PGlite emitiendo `SET ROLE` para asumir un rol no-superusuario (antes todo corria como superusuario y RLS no aplicaba). — [PR investment-pal #244](https://github.com/majabri/investment-pal/pull/244); hay un issue historico de RLS que «no funcionaba» en PGlite — [pglite issue #274](https://github.com/electric-sql/pglite/issues/274) (no abierto; estado no verificado)
- Swap de driver en tests: tutorial en el repo de drizzle usa `vi.mock("src/db", ...)` para sustituir la instancia por PGlite en memoria y aplica el esquema con `pushSchema` de `drizzle-kit/api` (API no documentada; el autor pide a los mantenedores que no la quiten). — [drizzle-orm issue #4205](https://github.com/drizzle-team/drizzle-orm/issues/4205)

### Inferences
- Para este repo: los tests de `FOR UPDATE` (que prueban que una segunda transaccion espera/bloquea) **no se pueden** reproducir con una sola conexion; con PGlite el `FOR UPDATE` se ejecuta pero nunca hay contencion, asi que el test pasaria sin medir nada (riesgo de oraculo falso).
- Los tests de GRANT que se conectan con el usuario restringido (otra connection string) no encajan; los que usan `SET ROLE` dentro de la sesion si podrian. Hay que auditar cuales son cuales.
- El codigo de prod mezcla dos drivers (`neon-http` y `neon-serverless` Pool); en tests ambos tendrian que apuntar a la misma instancia PGlite (`drizzle-orm/pglite`). Las transacciones interactivas del Pool pasan a ser transacciones sobre la unica conexion: funcionan en serie pero ocultan diferencias.
- Usar `pushSchema` en lugar de las migraciones reales deja de probar las migraciones (incluidas las que crean roles/GRANTs). Mejor aplicar las migraciones SQL reales con `drizzle-orm/pglite/migrator` una vez y clonar (p. ej. `dumpDataDir`/`loadDataDir`) — no verificado en esta investigacion.

### Gaps
- No encontre numeros de PGlite con drizzle sobre una suite del tamaño (~3000 tests) ni medicion de su arranque por archivo (carga del WASM) con migraciones grandes.
- No verifique el comportamiento exacto de `CREATE ROLE`/`GRANT`/`SET ROLE` en la ultima version de PGlite ni si la conexion como otro usuario es posible.
- No verifique soporte de extensiones especificas que use el repo.

## 2. Postgres local (Docker/OrbStack/Postgres.app) + proxy local de Neon, o testcontainers

### Takeaway
Un Postgres real local elimina la latencia de red (el factor dominante: decenas de queries secuenciales x RTT) y conserva roles, GRANTs y locks reales. Hay dos formas de conectarlo: (a) dejar el driver de Neon y poner delante `local-neon-http-proxy` (HTTP `/sql` + WebSocket, via Docker Compose), o (b) en tests cambiar a `drizzle-orm/node-postgres` (API de queries identica). testcontainers agrega 4–15 s de arranque, mitigable con `withReuse()`.

### Cited Findings
- Guia oficial de Neon: Postgres local + `ghcr.io/timowilhelm/local-neon-http-proxy:main` con Docker Compose (postgres:17 en 5432, proxy en 4444), y configurar `neonConfig.fetchEndpoint` (http://db.localtest.me:4444/sql), `neonConfig.wsProxy` (`${host}:4444/v2`) y `neonConfig.useSecureWebSocket = false` para el host local. Neon lo describe como «zero latency» y offline. — [Neon: local development](https://neon.com/guides/local-development-with-neon)
- El serverless driver no habla TCP directo: para Postgres local hace falta «a local instance of Neon's proxy». HTTP es mas rapido para queries sueltas/batch no interactivo; WebSocket para sesiones/transacciones interactivas. — [Neon: serverless driver](https://neon.com/docs/serverless/serverless-driver)
- `local-neon-http-proxy` soporta HTTP (`/sql`) y WebSocket (Pool), toma `PG_CONNECTION_STRING`; requiere Docker; offline exige mapear `db.localtest.me` a 127.0.0.1 en hosts. — [GitHub TimoWilhelm/local-neon-http-proxy](https://github.com/TimoWilhelm/local-neon-http-proxy)
- Alternativa: mantener `neon-http` en prod y usar `drizzle-orm/node-postgres` con `pg.Pool` contra Postgres local; esquema, tipos y API de queries son identicos entre drivers, solo cambia el archivo que construye `db`. — [Neon guide: Drizzle con Postgres local y serverless](https://neon.com/guides/drizzle-local-vercel) (via resumen de busqueda; no abierta)
- Neon Local (Docker de Neon) NO corre Postgres local: proxifica a una rama en la nube (puede crear ramas efimeras con `PARENT_BRANCH_ID`, borradas al parar el contenedor); con el serverless driver solo HTTP, no WebSocket. No reduce latencia. — [Neon Local docs](https://neon.com/docs/local/neon-local)
- testcontainers: Postgres arranca en ~5–15 s en frio, ~4 s caliente con la imagen cacheada; `.withReuse()` + `TESTCONTAINERS_REUSE_ENABLE` deja el contenedor vivo entre corridas y baja el arranque a <1 s. Fuente de calidad media (sitio de contenido SEO). — [qaskills.sh: withReuse](https://qaskills.sh/blog/testcontainers-withreuse-node-typescript-guide)
- Vitest + testcontainers: subir hookTimeout (p. ej. 600000 ms) porque el default de 10 s no alcanza para el arranque. — [zenn.dev/onozaty](https://zenn.dev/onozaty/articles/vitest-testcontainer-prisma?locale=en)
- Ajustes de Postgres para tests (doc oficial «Non-Durable Settings»): datos en RAM disk, `fsync=off`, `synchronous_commit=off`, `full_page_writes=off`, subir `max_wal_size`/`checkpoint_timeout`, tablas unlogged. — [PostgreSQL docs](https://www.postgresql.org/docs/current/non-durability.html)

### Inferences
- Opcion (a) conserva el camino de codigo de prod (mismo driver, misma semantica HTTP de `neon-http`), a costa de Docker. Opcion (b) no necesita proxy y sirve con Postgres.app/Homebrew sin Docker, pero los tests ya no ejercitan `@neondatabase/serverless` (diferencias de tipos devueltos o del `transaction()` no interactivo de neon-http podrian esconderse). Un hibrido: la mayoria con node-postgres y un pequeño set de humo contra la rama Neon.
- Postgres.app o `brew install postgresql@17` no requieren Docker y alcanzan para la opcion (b); para la (a) el proxy es una imagen Docker (OrbStack es una alternativa liviana a Docker Desktop en Mac — no verificado con fuente aca).

### Gaps
- No encontre un benchmark publicado del overhead del proxy local de Neon vs conexion TCP directa.
- No verifique si `local-neon-http-proxy` sigue mantenido a 2026 ni su compatibilidad con la ultima version de `@neondatabase/serverless`.

## 3. Patrones: template databases, rollback por test, migraciones una sola vez, workers paralelos con esquema/base propia

### Takeaway
El patron mas compatible con este stack es: migrar una vez a una base template en globalSetup, y por worker de vitest `CREATE DATABASE test_<id> TEMPLATE ...` (decenas de ms en tmpfs). El rollback por test da los mayores saltos reportados (~98%), pero choca con este codigo: `neon-http` no puede unirse a una transaccion externa y los tests de locks necesitan conexiones separadas.

### Cited Findings
- Crear una base desde template: ~2.000 ms en disco vs ~87 ms con el data dir en tmpfs (`docker run --tmpfs /var/lib/pg/data -e PGDATA=/var/lib/pg/data postgres:14`), ~23x. Ejemplo del autor: 1000 tests con 2 s de overhead cada uno = 33 min extra. — [Gajus, «Setting up PostgreSQL for running integration tests»](https://gajus.com/blog/setting-up-postgre-sql-for-running-integration-tests)
- Patron vitest: globalSetup corre `CREATE DATABASE x_test_${VITEST_WORKER_ID} TEMPLATE x_template` por worker (con drop-if-exists previo para autocurarse si una corrida crasheo); otra medicion reporta ~40 ms por base desde template. Restriccion: no puede haber otras sesiones conectadas al template durante la copia. — resumen de busqueda que cita [Sorrel-and-Salt issue #243](https://github.com/Aurora-Arctic/Sorrel-and-Salt/issues/243), [rotvalli.dev](https://rotvalli.dev/articles/testing-with-postgres-template-and-vitest) (no se pudo abrir: DNS) y [integresql](https://github.com/allaboutapps/integresql)
- IntegreSQL: servicio que gestiona pools de bases pre-clonadas desde templates para tests de integracion. — [GitHub allaboutapps/integresql](https://github.com/allaboutapps/integresql)
- Vitest expone `VITEST_POOL_ID` para identificar el worker y asignarle su propia base/connection string. — [zenn.dev/onozaty](https://zenn.dev/onozaty/articles/vitest-testcontainer-prisma?locale=en)
- Rollback por test (Prisma): seed una vez, cada test dentro de una transaccion que se revierte, transacciones anidadas convertidas en savepoints. 1.401 tests: de 10.153 s (~2,8 h, reseed de ~7 s por test) a 159,5 s (~2,6 min). — [codepunkt.de](https://codepunkt.de/writing/blazing-fast-prisma-and-postgres-tests-in-vitest/)

### Inferences
- En el caso de codepunkt, la ganancia viene sobre todo de no re-seedear, no del rollback en si; no es transferible 1:1.
- Rollback por test exige que TODO el codigo bajo prueba use la misma conexion/transaccion inyectada; con `neon-http` cada query es un request HTTP independiente, asi que no se puede envolver. Ademas rompe los tests de `FOR UPDATE` (dos sesiones). Por eso template-por-worker (o por archivo) es el encaje natural.
- «Correr migraciones una vez»: hoy `drizzle-kit migrate` corre en cada invocacion; con template se migra solo cuando cambia el hash de la carpeta de migraciones (inferencia de diseño, no fuente).

### Gaps
- No se pudo abrir rotvalli.dev (DNS) para confirmar el detalle del patron con vitest.

## 4. Especifico de Neon: reducir latencia (region, pooled vs directo), rama por corrida

### Takeaway
Con la base remota, cada query secuencial paga un RTT completo; la palanca es reducir round-trips (batch/`transaction()`/JOINs), conexiones persistentes por WebSocket en tests, y elegir la region de Neon mas cercana a donde corren los tests. Ninguna de estas acerca los numeros a los de una base local.

### Cited Findings
- Caso citado por Neon: 200 queries secuenciales ~500 ms en local vs ~4 s contra Neon remoto (~8x). Batching dio 45% menos de tiempo de respuesta; reutilizar conexiones, 8–9x menos en un test con Django. Recomienda colocar backend y base en la misma region y agrupar con `sql.transaction([...])`. — [Neon blog: How to minimise the impact of database latency](https://neon.com/blog/how-to-minimise-the-impact-of-database-latency)
- Neon publica un dashboard de latencias regionales (Vercel → regiones AWS de Neon, HTTP y WebSocket, frio y caliente, cada 15 min). — [neondatabase/latency-benchmarks](https://github.com/neondatabase/latency-benchmarks)
- HTTP por query desde la misma region: 25–40 ms; WebSocket con pool, caliente: 5–15 ms. Fuente secundaria de calidad incierta. — [goldlapel.com](https://goldlapel.com/grounds/nodejs-edge/neon-serverless-http-vs-websocket)
- Ramas: «complete copy of your database» en segundos; storage de la rama hija solo factura lo que cambia. Neon Local puede crear una rama efimera por corrida (`PARENT_BRANCH_ID`) y borrarla al parar. — [Neon: local development](https://neon.com/guides/local-development-with-neon); [Neon Local docs](https://neon.com/docs/local/neon-local)

### Inferences
- Numeros del encargo: ~8 s por test con «decenas» de queries implica ~100–300 ms por query, coherente con RTT intercontinental (p. ej. desde Argentina a us-east) mas TLS/HTTP por query de `neon-http`. Mover la rama de CI a una region mas cercana o usar Pool/WebSocket en tests reduciria, pero el piso sigue siendo el RTT.
- La rama por corrida da aislamiento, no velocidad; util para correr la suite en paralelo sin pisarse, no para bajar el tiempo por test.

### Gaps
- No encontre mediciones oficiales de Neon pooled (pgbouncer) vs directo en latencia por query; el pooler afecta numero de conexiones, no el RTT.
- No medi el RTT real desde la Mac del owner a la region de la rama CI (se mide con un `select 1` cronometrado).

## 5. Speedups tipicos reportados (nube remota vs local) y ranking por esfuerzo

### Takeaway
Los numeros publicados van de ~4x (Postgres completo → PGlite en tests de drizzle) a ~8x (remoto Neon → local en queries secuenciales) y hasta ~60x cuando ademas se elimina el seeding por test. Para este repo, el salto grande es pasar de remoto a local; el resto (template, tmpfs, fsync=off) suma encima.

### Cited Findings
- Remoto Neon → local: 200 queries secuenciales ~4 s → ~500 ms (~8x). — [Neon blog](https://neon.com/blog/how-to-minimise-the-impact-of-database-latency)
- Postgres completo → PGlite en memoria: ~4x (tests de drizzle). — [HN](https://news.ycombinator.com/item?id=40086681)
- Template en disco → tmpfs: ~2.000 ms → ~87 ms por base (~23x). — [Gajus](https://gajus.com/blog/setting-up-postgre-sql-for-running-integration-tests)
- Reseed por test → seed una vez + rollback: 10.153 s → 159,5 s (~64x). — [codepunkt.de](https://codepunkt.de/writing/blazing-fast-prisma-and-postgres-tests-in-vitest/)
- 1.300 tests con PGlite en ~25 s. — [Dennis O'Keeffe](https://www.dennisokeeffe.com/blog/2025-06-09-isolating-postgresql-tests-with-pglite)

### Inferences (ranking por esfuerzo, de menor a mayor; elaboracion propia sobre las fuentes)
1. **Esfuerzo minimo, sin cambiar infraestructura:** no correr `drizzle-kit migrate` si el hash de migraciones no cambio; correr solo las suites afectadas; subir paralelismo de workers contra la rama Neon (si los tests ya aislan datos). Ganancia acotada; el RTT por query sigue.
2. **Bajo:** acercar la region de la rama CI o usar Pool/WebSocket persistente en tests en vez de HTTP por query; agrupar queries en el codigo (beneficia tambien a prod). Ganancia probable 2–3x (inferencia a partir de 25–40 ms HTTP vs 5–15 ms WS; no medido aca).
3. **Medio (recomendado):** Postgres local (Postgres.app/Homebrew sin Docker, o Docker/OrbStack con tmpfs y `fsync=off`) + migrar una vez a template + `CREATE DATABASE ... TEMPLATE` por worker con `VITEST_POOL_ID`. Conserva roles/GRANT y `FOR UPDATE` reales. Driver: node-postgres en tests (sin Docker) o el driver de Neon via `local-neon-http-proxy` (con Docker). Ganancia esperada del orden de ~8x o mas segun la fuente de Neon.
4. **Medio-alto:** PGlite por archivo para la mayoria de suites (sin Docker, lo mas rapido), dejando en Postgres real las suites de locks/concurrencia y de conexion con rol restringido. Riesgo: tests que pasan sin medir (locks sin contencion) y doble mantenimiento.
5. **Alto:** rollback por transaccion por test: requiere inyectar una conexion unica en todo el codigo bajo prueba; incompatible con `neon-http` y con los tests de locks.

### Gaps
- Ninguna fuente publica un antes/despues exacto para el par «Neon remoto vs Postgres local» con drizzle + vitest a escala de miles de tests; el ~8x de Neon es de un caso de 200 queries.
- Las ganancias de los puntos 1–2 del ranking son estimaciones, no mediciones.
