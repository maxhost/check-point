# 0242 — Autenticación, carga y protocolo de rendimiento de POS

Lectura por agente map_performance sobre producto `5f9cb2b2af49fa45850c059ef33f8bb69ea15172`. Sin DB, servidores o mediciones nuevas. Las cifras históricas se atribuyen a su candidato/entorno, nunca al POS nuevo.

## Cadena actual observada

1. `apps/merchant/src/proxy.ts`: routing host; excluye APIs; sin DB/auth.
2. `app/backoffice/layout.tsx`: requireBackofficeSession + readBackofficeInitialCore.
3. `server/backoffice-context.ts`: React.cache en RSC; WeakMap<Request> en handlers; promesas de sesión/selección/membership/billing por petición.
4. `backoffice-membership.ts`: JOIN membership→business LEFT JOIN subscription; modos page/active-member/active-owner distintos.
5. `backoffice-initial-context.ts`: seed mínimo autorizado + scopeKey; módulos bajo Suspense independiente.
6. `modules/pos/ui/pos-screen.tsx`: guard que reutiliza contexto + SELECT locales activos.
7. `pos-console.tsx::load`: GET merchant/session, después GET modules/pos/orders. Printing pide ticket al tener contexto. El POS ignora el seed de0238 para su carga propia.

Better Auth usa drizzleAdapter(getDb()); no cookieCache configurada. Firma/expiración/renovación y cookies del staff/owner siguen siendo autoridad del proveedor. No hay evidencia que justifique cambiar duración, dominio, firma o SameSite para este rediseño.

`packages/db/src/client.ts` ya usa HTTP para lecturas simples y Pool WebSocket compartido por connection string para transacciones. No proponer agregar pooling como si faltara ni mover transacciones a HTTP sin contrato.

## Scope de intención

PosCache/payment/printing usan userId:businessId; posRequest llama panelRequest sin options.scopeKey. panelRequest sí soporta esa opción. dispatch valida X-Backoffice-Scope en toggle genérico pero no en rutas POS ordinarias.

Adoptar protocolo ADR0154/spec0238: guard completo vigente → scope autenticado comparado con intención → dominio. DTO/provider no autoriza. Guard no se cachea entre peticiones. Scope original se captura antes del await y se congela junto a UUID/cuerpo de cierre. Un mismatch409 backoffice_context_changed no ejecuta dominio; limpia ámbito y restablece documento, sin reintentar escritura con otra identidad. Respuestas adoptadas private,no-store, incluyendo errores.

Compartir datos de acceso dentro del Request conserva precedencia de email/estado/billing/PIN y selección de membresía. No reutilizar una autorización por traer scopeKey ni habilitar cookieCache como atajo.

## SQL visible del dominio: conteos estructurales

Excluyen internals de Better Auth y no son latencias medidas. Cada handler tiene además guard y módulo.

| Operación | Trabajo visible | Oportunidad focal |
| --- | --- | --- |
| Listado | timezone, abiertas, cerradas/anuladas, líneas:3–4 SELECT secuenciales | Agregar por orden en SQL; reusar timezone del contexto con misma autoridad; ramas independientes; no descargar todas las líneas. |
| Catálogo | local si explícito + productos + categorías + agregado ranking30d:3–4 SELECT | Paralelizar independientes y medir ranking con volumen; no precargar catálogo al listar. |
| Detalle | cabecera + líneas; cerrado identificado agrega sale/consumer | Mantener cache/dedupe; evitar detalle por cada resumen. |
| Guardar | snapshots/nuevas, versión+líneas con UPDATE secuencial por línea, reread canónico | Batch después de baseline, conservando transacción/snapshots/versión. |
| Cierre | locks, pagos, cupón, acreditación, resources, comisión, evento, freeze, reread | Conservar atomicidad; medir commit/aftercommit separados. |
| QR | programa/cuenta/membership, posible alta/last_scan, catálogo/atajos/rewards/cupón | Proyección POS mínima; nunca prefetch por tener efectos de escritura. |
| Preparar cobro | coupon-state → preview → payment-methods si neto>0 | No añadir viajes a total0; no cachear veredicto como autoridad. |

Listado sin paginación y filtro de local hoy en cliente. Mantener contrato inicialmente; un índice/paginación/cambio de predicado de fecha requiere plan y equivalencia de timezone/DST. No agregarlo a ciegas. Ranking por cantidad deja de ser homogéneo con masa; contrato de medidas decide primero semántica, después optimización.

## Caché e invalidación

Conservar dedupe de promesas, epochs/generaciones, detalle monotónico por versión, catálogo por local y escritura que alimenta caché sin GET. Nuevo aislamiento incluye scopeKey. No storage/localStorage/TTL/global permission cache. 401/403, pérdida de ámbito y logout retiran datos; conflicto conserva borrador sin sobrescribir;404 retira orden. Cierre/anulación actualiza abiertas y refresca límites de día en segundo plano.

POS actual no tiene sondeo periódico de4s; sí lo tiene counter-console. No introducir polling al migrar ni describir como vigente lo que solo dice spec0172 histórica.

## Antecedente0238 y límites

`docs/factory/0238-m1.md`: control005b823… vs candidato660677…, build/start local+NeonCI protegida y DB preparada.144 entradas:120 reloads más primeras entradas. Documento9→4SELECT; GET sesión2→0; módulos2→0; SQL total49→18 incluyendo BEGIN/COMMIT. Inbox ready mediana~2,0s→~1,6s; primera entrada con assets nuevos~3,1s. No se redujo JS; no es medición POS ni hosting PROD/DB fría. Los límites de observación RSC/EOF siguen documentados.

0239 modifica resumen/UI, no reemplaza esa campaña. FAIL frío1817.621042ms de0237 sigue siendo evidencia de otro trayecto; SQL caliente~40ms no certifica arranque frío.

## M0 antes de implementación

Congelar en worktree/artefacto propio: SHA control, lockfile, Node24/Next/pnpm, buildID, esquema/migraciones, fixtures tenant/local/roles, geografía/topología, transporte HTTP/WS y estado DB. Usar build/start de entrega, no Nextdev.

Casos: 0 abiertas; normal24órdenes×8líneas,120productos/8categorías/2locales; volumen200órdenes×30líneas y2000productos. Declarar que son fixtures sintéticas, además de una muestra representativa si existe. QR con/sin cupón, cupón total0, peso, sesión owner y staff. No mezclar poblaciones.

Separar navegación completa, transición interna con layout persistente, retorno, abrir catálogo/detalle, guardar, resolver QR, preparar cobro y cerrar. Definir marcadores listUsable/catalogInteractive/closeConfirmed: datos reales visibles y acciones autorizadas, no skeleton ni montaje. Medir TTFB, intervalos de navegador, waterfalls, bytes codificados/decodificados/RSC/JS/CSS, long tasks, SQL por request, guard/DB/tx/commit y trabajo aftercommit.

Frío tiene dimensiones distintas: navegador/assets nuevos, proceso/pool nuevo, DB suspendida. No llamar DB fría a una DB que el wrapper ya despertó. No poner secrets/cookies/QR/scopeKey en informes versionados; HAR trazas privados saneados.

## Gates fijados antes de M1

Estructurales obligatorios:
- 0 GET sesión adicional al entrar con seed autorizado listo.
- 0 GET módulos extra iniciado por POS; compartir owner/seed0238.
- Un GET listado por entrada/refresco intencional, sin cascada reporter propia.
- 0 GET al alternar Catálogo/Orden y al calcular peso;0 GET de detalle/catálogo ya válido salvo invalidación explícita.
- POST/PUT exitoso publica DTO a caché;0 GET automático de detalle/historial por crear/editar. Cierre/anulación pueden refrescar historial de forma coordinada para límites de día.
- Un intento de cierre por confirmación; reintento ambiguo explícito con misma UUID/cuerpo/scope; no refetch de catálogo al cerrar.
- Seguridad y equivalencia de efectos no admiten degradación por latencia.

Temporal: M1 A/B contemporáneo AB/BA, al menos30pares para caso normal del listado, control y candidato misma receta/fixture. Objetivo: mejora demostrada de la mediana listUsable (intervalo95% del delta candidato−control por debajo de0). Gate no regresión de mediana y p95 de rutas críticas: límite superior del delta ≤max(5% del control,50ms), reportando delta absoluto/relativo y el intervalo. Fijar estimador/semilla/bootstrap y muestra antes de recoger datos. Si la muestra no resuelve p95, resultado inconcluso, no PASS; ampliar campaña por esa duda concreta y documentar la receta antes de ampliar.

Primera entrada assets nuevos al menos10por fuente y volumen como diagnósticos separados; no atribuirles precisión estadística que no tienen. Un alcance backend-only con overhead nuevo debe medirse en cierre/commit, no esconderse detrás de mejora de entrada. No prometer SLA absoluto sin M0 POS; el presupuesto15s de timeout existente no es objetivo UX.

QA independiente revisa todos los intentos, errores, datos compatibles, conteos y equivalencia. No retries/skips como PASS, no sumar medianas para fabricar un trayecto, no eliminar fallos de entorno sin declararlos. Instrumentación nueva solo en su ficha explícita y entorno protegido; no endpoint público diagnóstico.
