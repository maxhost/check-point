# 0235 — Contrato de implementación local

Owner pidió lanzar la implementación de Negocio después de aprobar la spec0235/ADR0150 y sus cuatro respuestas. Piso L2; dos implementadores y QA independiente. Este contrato amplía el encargo documental anterior a código, migración preparada y verificación local/CI protegida. No autoriza push, migración PROD ni deploy. Mantener INDEX/TASKS y estados de Claude sin editar.

## Contrato común

Mandan [0235](../specs/0235-negocio-y-medios-de-pago-core.md) y [0150](../adr/0150-negocio-y-comisiones-core.md). Medios/comisión en core; Negocio no es módulo. Preservar selector POS, Marca branding, Settings, IDs/historia, revisión inmutable y calidad del dato. Ninguna condición de negocio de comisión impide cerrar; error técnico DB revierte la transacción. Neto0 con eventos apagados conserva evidencia core sin pago ficticio. No implementar Gastos/renombre, Analíticas ni Smart Menu.

HTTP común es la tabla de0235: `/api/business/payment-methods`, catálogo, alta/archivo, comisión por medio, regional, fiscal y lectura de comisión por fuente/orden/local. GET POS de medios permanece con metadata operativa sin tasas. GET no siembra. Guards derivan comercio de sesión; owner siempre/business delegado, sin backfill por brand. Regional/Fiscal salen también del DTO/writer de Marca.

Coordinador corrigió únicamente el escape Markdown de separadores `|` de esa tabla al preparar esta ficha; no cambia rutas, payloads ni decisiones. A comunicará a B la forma concreta de DTOs/revisiones antes de que B cierre sus adaptadores.

## Reparto y dependencias

Base inicial de preparación: dev `d60711a3`; la base asignada a workers será el commit local de esta ficha. Checkout principal sigue en dev. No cambiar ramas ni dependencias del principal.

### A — core, API, POS servidor y esquema

Único writer de `packages/db/` (incluida migración/journal), `packages/domain/src/financial/`, `apps/merchant/src/server/`, `apps/merchant/src/app/api/`, `apps/merchant/src/lib/business-contract.ts`, `apps/merchant/src/modules/pos/server/`, `apps/merchant/src/modules/profitability/server/`, aritmética/manifest profitability y framework servidor/eventos/recursos. Tests backend propios en esos ámbitos y fixtures de integración afectados bajo modules. Su handoff: `docs/factory/0235-core.md`. Antes de tocar otro path, comunicar ampliación al coordinador.

Responsable de esquema core, captura/commit y reader, compatibilidad de migración/pendientes, alta de medios al crear comercio, permisos/capacidades, DTO Brand restringido, Regional/Fiscal y revisión optimista, checklist/tour del servidor. **Asignación explícita de migración y contratos de framework limitada a0235**; no kit, guardias ni tooling general. No editar UI ni tests e2e de B. Los cambios de permisos no requieren inventar ALTER del CHECK genérico.

Debe preparar el orden de despliegue/binario puente verificable antes de mover las tablas, sin ejecutar PROD. Conservar triggers/funciones core e identidades opacas heredadas; nunca agregar ramas del core por nombre de módulo. No basta entregar el estado final que solo funciona después de migrar: la transición y recuperación histórica tienen aceptación propia.

### B — Negocio, Marca, navegación y POS UI

Único writer de `apps/merchant/src/app/backoffice/` salvo `settings/` (intacto), `apps/merchant/src/modules/pos/ui/`, `tests/e2e/business-negocio.spec.ts`, `tests/e2e/support/business-negocio-fixture.ts` y fixtures/e2e de Marca/POS/onboarding estrictamente afectados (ampliación nominal antes de editar). Su handoff: `docs/factory/0235-ui.md`.

Implementar tres secciones y administración de medios/comisión con kit existente; mover Regional/Fiscal completos desde Marca y retirar sus anchors/pasos/payloads; conservar identidad y checklist branding, POS selector y guard/permisos de página. No cambiar Settings ni kit/guard para evitar rojo. Copy tuteo, estados loading/empty/error/guardado/conflicto, campos por forma y aviso de configuración parcial. Aplicar impeccable en modo Operate preservando contexto visual y límites del repo; no reescribir diseño global ni añadir assets/marketing.

Puede avanzar con el HTTP cerrado y dobles de API. Coordinar integración con A antes de dar por aprobados tipos/build o smoke real. Paths disjuntos no sustituyen validación de combinación.

### Coordinador y QA

Coordinador es único integrador y writer de esta ficha, spec/ADR al cerrar y estado propio, sin tocar estados de Claude/INDEX/TASKS. QA independiente revisa las entregas congeladas y sus pruebas pertinentes, devuelve fallos concretos; no implementa lo que certifica. Revisión inicial más comprobación de correcciones, sin ciclos de pulido ni mutaciones por defecto. Recursos/worktrees exactos y SHA quedan en factory/handoffs.

## Recursos y comprobaciones

- Node24 antes de comandos; dependencias propias. No copiar/symlink de env PROD a worktrees. De dotenv/Vercel solo claves/metadatos, nunca valores/prefijos.
- A reserva `db:modules-ci`; entorno de pruebas seleccionado `/private/tmp/checkpass-recipes-margin/0234-ci.env`. DB solo `tools/neon-test.sh`, configuración protegida, DDL serial `--no-file-parallelism`, reserva también para teardown. No usar DATABASE_URL PROD ni suites libres. B no usa Neon.
- A: migración con datos similares a PROD y crecimiento/pendientes, ID/FK/triggers/proveedores; cierre con medio core y mixtos, neto0 flagOFF, congelado A→B/retry, ausencia/incompatibilidad permiten commit, fallo DB revierte, tenant/accesos/Brand. Reusar pruebas0233; selección mínima decisiva, sin suites enteras.
- B: pruebas focales de payload/selector, campos por forma, archivo Efectivo, guards owner/business/brand, Brand/tour/checklist, conflictos. Browser390/1280 en una pasada y confirmación de correcciones si aparecen; sin servidor/puertos ajenos. Reservas UI `port:43120` y `port:43121`.
- Tipos/lint/formato/fronteras pertinentes por autor; combinación final con Merchant build una vez sobre candidato congelado y smoke según cambios reales. No verify global antes de un push autorizado ni repetir evidencia con fuentes idénticas.
- Entrega con commit solo propio, factory deliver, SHA/base, comandos/resultados reales (incluidos fallos/skips), límites y procesos. No declarar implementada hasta QA de entrega/combinación.

## Baseline de CI remoto

Chequeo inicial obligatorio `pnpm ci:status` observó main `5b834ca0` rojo en run38971334745: paso Unit + integración Neon, aserción Stock consumo línea637 (`expected10 to be less than10`) y error de teardown en permissions-integration-support.ts86 al borrar comercio. Esto identifica el rojo, no su causa. No esperar ni sondear CI remoto después de publicar. Investigar el cableado afectado al probar esta pieza; no aflojar tests ni atribuir causas sin evidencia. Cualquier publicación futura exige resolver o acordar expresamente este baseline, además de sus gates obligatorios. En esta implementación no hay publicación autorizada.

## Aceptación

Se cumplen los ocho grupos focales de0235 y el despliegue compatible de0150, con conservación de datos y fronteras. El owner debe poder probar Negocio local integrado, POS selector/cobro y Marca sin Regional/Fiscal. La entrega local incluye migración y rollout revisables; **PROD permanece sin modificar durante esta implementación**.
