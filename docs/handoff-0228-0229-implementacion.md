# Handoff — piezas 1.1 y 1.2: implementación de specs 0228 y 0229

## Retoma y autorización

El owner pidió preparar un clear para lanzar un implementador de la pieza 1.1, otro de la 1.2, coordinación y QA independiente. Las decisiones funcionales están respondidas. Retomar con este flujo sin reabrirlas ni pedir confirmaciones rutinarias de trabajo local. No hay implementación de estas piezas todavía: este cierre incorpora documentos y prepara la retoma.

Trabajar automáticamente hasta QA de entrega y combinación completo y pasado. Con el candidato concreto listo, pedir la autorización final para merge a **main local**. Ningún push ni operación de producción está autorizado; cada caso requiere autorización propia. No confundir el costo de compra con un precio neto de impuestos.

Leer `AGENTS.md`, `CLAUDE.md`, `docs/TRABAJO-EN-PARALELO.md`, `docs/AGENT-WORKFLOW.md`, `docs/VERIFICACION.md`, `docs/MODULOS.md` y el bloque vigente de `docs/estado/gpt.md`. Para estas dos piezas, este handoff complementa el estado anterior, que aún describe el cierre de 0227.

## Documentos y refs comprobados

- [Spec 0228](specs/0228-costo-promedio-ponderado-por-insumo-y-local.md), pieza 1.1, cerrada; [ADR 0146](adr/0146-costo-promedio-ponderado-por-local.md), diseño aceptado. Entrega documental `59225f9b76ea2a2d420e027067455ad624d84982`.
- [Spec 0229](specs/0229-datos-fiscales-del-comercio-en-marca.md), pieza 1.2, cerrada. Entrega documental `4041eb7415e3f33dec9568a4b8439d4105190897`.
- Ambas entregas incorporadas preservando sus commits en `dev`: merge documental `d6bce435732f26e99c4aba60e093fcb6956e58e4`, previo a este handoff. Usar el HEAD real de `dev` tras el handoff como base, no arrancar sobre la entrega aislada de una sola spec.
- `main` local permanece `39d00edfca6347773c03a015a2ffcd1a1d38b0dd`: contiene 0227 implementada y QA PASS, no 0228/0229. Esta preparación no avanzó main ni publicó.
- Sólo se verificaron las entregas documentales: lectura de decisiones/contratos, diff, Prettier con `--ignore-path /dev/null` y `tools/check-numbers.ts`. No existe QA funcional de 0228/0229 todavía.

Los encargos originales prohibían INDEX/TASKS/estados y código: se respetaron. Los tres documentos están en dev; este handoff es el único archivo adicional del cierre. Al comenzar código, el coordinador reserva las filas de INDEX mediante commit local conforme al flujo vigente; no hace push de reserva. Las dos filas futuras de TASKS permanecen propuestas dentro de 0229 para que el owner las agregue.

## Decisiones cerradas: 0228

Costo promedio ponderado móvil por comercio/insumo/local, separado del último costo y preparado como futura fuente de cálculo. Persistir promedio nullable a seis decimales en `stock.item_location`, con marcador de inicialización única desde el último costo **de ese mismo local**. No replay histórico ni fallback a costo global. Null desconocido y cero conocido son distintos.

- Orden efectivo de registro bajo lock; `occurred_at` informativo para el promedio, sin recálculo hacia atrás.
- Compra con precio y saldo anterior positivo/costo conocido: ponderar. Saldo anterior <= 0: precio nuevo aunque el saldo final siga negativo. Costo desconocido con saldo positivo: primera compra con precio inicializa también ese saldo como estimación aceptada.
- Compra sin precio conserva costo/null; consumo y conteo no cambian el costo, tampoco al llegar a cero.
- Enteros escalados: cantidad3, importe2, costo6; `roundDiv` existente, mitades lejos de cero. Fórmula sobre importe exacto, sin redondear el precio unitario antes de ponderar. Ejemplos y límites en spec/ADR.
- Antes de la compra o entrada completa, un intento acotado de aplicar pendientes de su comercio/local, fuera de su transacción y sin locks POS. Si falla o quedan pendientes, **la compra válida se registra igual**, calculando sobre el saldo aplicado que se lee en ese momento. No rechazo `consumption_pending`/`count_changed`, no corte obligatorio de conteo y no recálculo del promedio por consumo tardío. Conserva validaciones normales, permisos y durabilidad del commit propio.
- Precio de compra = lo pagado por el comerciante, **IVA incluido**. No desglosar/restar IVA ni leer ningún dato fiscal del comercio.
- Movimiento, lectura del saldo anterior y actualización de promedio pertenecen al mismo commit. Entrada multi-línea todo o nada; repeticiones se procesan en orden. Mantener orden compatible de locks insumo→par con consumo/conteo.
- Agregar `weightedAverageUnitCost` al DTO Stock, conservando `lastUnitCost`. Fuera conexión nueva del costo de producto en Recetas, UI nueva del costo, costo congelado en venta, IVA y correcciones históricas.

## Decisiones cerradas: 0229

Tres datos **por comercio**, en `core.business`: `chargesVat` boolean false, `saleVatRate` porcentaje decimal nullable y `recoversPurchaseVat` boolean false. Defaults iguales para existentes/nuevos; ninguna inferencia desde `country_code` ni elección de país/tasa.

- Tasa obligatoria si cobra IVA; rango 0–100 inclusive, máximo dos decimales exactos. Cero es válido y distinto de null. Desactivar conserva la tasa guardada y deshabilita el campo; null permitido mientras no cobra IVA.
- Sección «Datos fiscales» después de Configuración regional y antes de Guardar marca. Labels y ayuda literal aprobados en spec; aclarar que hoy no cambia precios, cobros ni costos.
- GET/PUT `/api/brand` existentes; DTO privado, tasa string decimal/null, booleanos estrictos. Omitir campos nuevos en cliente antiguo conserva valores; validar el estado resultante completo. Mismo permiso `brand`, id exclusivamente del guard y revisión optimista/409 actual; no nueva puerta owner-only ni destino elegido por body.
- No campos fiscales en respuestas públicas ni consumidores de Stock/catálogo/POS. No importar módulos a core para reutilizar decimal. Guardar datos no activa ninguna función fiscal.
- Filas futuras propuestas, no implementadas ni añadidas a TASKS: venta con IVA facturado en POS; estimación de IVA recuperable de compras usando futuras tasas por categoría del organismo correspondiente. Sus reglas fiscales siguen a decidir en encargos separados.

## Reparto de implementación y recursos

Coordinador + **dos implementadores que también corrigen + QA independiente**. Sin subdelegación ni reviewers adicionales por defecto. Máximo tres worktrees operativos. Confirmar refs reales, árbol, procesos y `.factory/registry.json` antes de empezar; no editar ese registro a mano.

Actualmente hay dos worktrees documentales limpios, sin procesos propios, con tareas entregadas:

| Tarea registrada      | Worktree                                                  | Rama                          | SHA entregado |
| --------------------- | --------------------------------------------------------- | ----------------------------- | ------------- |
| `cost-spec-0228`      | `/private/tmp/checkpass-0228/factory-0228-cost-spec`      | `factory-0228-cost-spec`      | `59225f9b`    |
| `brand-tax-spec-0229` | `/private/tmp/checkpass-0229/factory-0229-brand-tax-spec` | `factory-0229-brand-tax-spec` | `4041eb74`    |

**No crear tres árboles adicionales ni retirar esos árboles por force.** Sus entregas aún no son ancestros de main. Preparar continuidad de las reservas y reutilizar los dos árboles para A/B, conservando SHAs y refs documentales; el tercero queda para QA. El harness actual no ofrece una operación de continuidad desde entrega documental a implementación: `extend` sólo funciona en `reserved`. No simular un FAIL de QA con `reject` ni retirar tareas no integradas para sortearlo.

Asignación explícita al coordinador, si se necesita para ese relevo local: `tools/factory.ts` y sus pruebas focales `tools/factory.test.ts` / `tools/factory-lifecycle.test.ts`, dentro del harness del piloto0225. Preparar una transición validada y registrada que preserve la entrega anterior, compruebe checkout limpio, pertenencia/ancestro de la nueva base, scope/recursos y ausencia de procesos; continúe la misma reserva sin falsear integración/retiro. Verificar proporcionalmente esa transición antes de usarla. No debilitar los checks de entrega ni de cleanup. No se implementó esa transición en este cierre documental.

### A — pieza 1.1 y único writer de esquema/migraciones

Stock: `numbers.ts`, `movements.ts`, `entries.ts`, `items.ts`, `local.ts` y pruebas focales, revisando compatibilidad con consumo/conteo. Responsabilidad explícita y exclusiva de `packages/db/src/schema/modules/stock.ts`, **también las tres columnas fiscales de `packages/db/src/schema/business.ts`** según contrato0229, exports necesarios y migraciones/journal/snapshots.

Generar esquema/SQL serialmente para ambas piezas; nunca dos journals en paralelo ni merge textual de snapshots. Entregar un fundamento común revisable con columnas/defaults/constraints y mecanismo de inicialización local antes de integración DB de B. No editar UI/dominio de Marca ni cambiar cálculos de Recetas/POS. Concretar rollout/corte de writers y rollback conforme0228; nada PROD.

### B — pieza 1.2: Marca, dominio/HTTP y UI

`packages/domain/src/server/brand.ts` y `brand/`, `apps/merchant/src/app/api/brand/route.ts`, `apps/merchant/src/app/backoffice/brand/` y pruebas focales correspondientes. Puede preparar dominio/UI contra el contrato cerrado mientras A prepara esquema. B no edita esquema, journal/snapshots ni promedio Stock: pide el cambio a A/coordinador. UI con kit y copy existentes; no modificar kit/guardias para evitar un rojo.

Antes de escribir, fichas con taskID, base exacta, paths explícitos, contratos, checks, artefactos/puertos y recursos. A/B documentan su entrega propia en `docs/factory/`; coordinador es único writer de índices/estado. Cuando B necesite el fundamento de A, incorporar su commit congelado y refrescar base sólo sobre árbol limpio y sin trabajo pendiente, preservando scope real de la entrega.

## QA y cierre

Node24 antes de comandos. DB tests **sólo `tools/neon-test.sh`** con configuración CI/desarrollo protegida, sin copiar env productivos. Reservar DB también durante teardown; pruebas DDL aisladas, sin suites concurrentes. Base 0227 incluye expand0082/0083 y herramientas contract no aplicadas permanentemente; comprobar el estado real de CI antes de nuevas migraciones, no asumir DB dev/PROD migrada. Conservar flag de consumo existente y sus límites, sin activar o publicar por inferencia.

A: fórmula/precisión y ejemplos, saldo anterior, null/cero/negativo, compra retroactiva, entrada repetida y rollback, compra/consumo concurrentes, pendiente que falla sin bloquear compra y recuperación que no repondera, inicialización única y aislamiento local/comercio.

B: defaults/migración, validación y payload legacy, tasa retenida/null/cero, guardado/revisión409, permisos y aislamiento reales, flujo Marca y ausencia de cambios en precios/cobros/costos o DTO públicos. Browser de componentes prueba interacción; no sustituye API/DB real ni QA visual.

QA independiente valida entrega y después combinación en SHA exacto: A/B comparten DB y journal pero **no dependencia fiscal de cálculo**. Reutiliza evidencia compatible y reproduce señales decisivas. Fallos vuelven al implementador de scope; repetir checks afectados, sin PASS por retries/skips ni cambios de pruebas para ocultar fallos. Tipos/lint/formato/guardias/build pertinentes al candidato, sin verify global por ceremonia.

Congelar candidato, obtener QA PASS completo, presentar resumen y única pregunta de merge con main local. No push, deploy ni migraciones PROD. Tras autorización/merge, `factory integrate` y `cleanup` sólo con entrega aceptada ancestro de main, checkout limpio y sin procesos propios. Preservar trabajo ajeno y evidencia.

## Prompt para retomar tras clear

«Lee `docs/handoff-0228-0229-implementacion.md` y continúa la implementación autorizada de 0228 y 0229 con dos implementadores, coordinación y QA independiente. Trabaja automáticamente en worktrees aislados hasta QA completo y pasado; entonces pregunta si podemos hacer el merge con main local. Sin push ni operaciones PROD y sin reabrir decisiones respondidas.»
