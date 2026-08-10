# TASKS

**Estado actual del proyecto. Este es el punto de retorno.**

Si una sesion se cae, se cierra o se compacta, se vuelve aca — no al chat. Hay un hook
`Stop` que bloquea el fin del turno si se toco codigo y este archivo quedo viejo.

Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido,
cosa vista en pantalla. No "deberia andar". El auto-reporte no es evidencia.

Ultima actualizacion: 2026-08-10.

## Ahora

Que esta pasando ahora mismo y cual es el proximo paso. Si una sesion se cae, la
siguiente arranca leyendo este bloque.

La V1 de Mi Pasaporte está planificada para consumidor, comercio y administrador de
plataforma: wallet/QR, backoffice y wizard, app de operación, ruleta, métricas y
rutas/eventos curados. La propuesta de arquitectura está documentada en
`docs/ARCHITECTURE.md` y ADRs 0011–0017. El lanzamiento del entorno está ordenado en
`docs/SCAFFOLD-PLAN.md`. La Spec 0010 de scaffold está `cerrada` y en implementación con
el protocolo de agentes. Las specs de producto siguen en `borrador` hasta validar la arquitectura, incluyendo
entrega/costo de OTP en Ecuador. La Spec 0003 fue rediseñada alrededor de un Incentive
Engine interno (ADR 0018): reglas tipadas, efectos, presupuestos, versiones y simulación;
no se implementará un DSL libre ni lógica especial por pantalla.

El remoto canónico es `https://github.com/maxhost/check-point.git`, documentado en
`docs/REPOSITORY.md`. La rama de publicación acordada es `main`; la autenticación local de
GitHub debe revalidarse antes del primer push. El commit inicial local `6467628` está listo
para publicar; el intento de conexión no resolvió `github.com` desde este entorno.

Handoff guardado en `docs/HANDOFF.md`. Próxima fase acordada: definir la arquitectura y
stack transversal antes de cerrar specs para implementación.

## Siguiente

| # | Tarea | Spec | Estado | Notas |
|---|---|---|---|---|
| 1 | Validar propuesta de stack y publicar remoto GitHub | ADR 0011–0017 | pendiente | Remoto público `maxhost/check-point` definido; falta reautenticar GitHub antes del primer push a main |
| 2 | Crear y cerrar Spec 0010 de scaffold | 0010 | hecho | Spec cerrada el 2026-08-10; sin comportamiento de producto |
| 3 | Implementar scaffold con protocolo de agentes | 0010 | en curso | Orquestador → implementador → revisor independiente |
| 4 | Cerrar alcance y arquitectura técnica de V1 | 0001–0009 | pendiente | 0003 rediseñada; resolver abiertos y cambiar specs a `cerrada` antes de código |

## Hecho

| Fecha | Que | Verificado con |
|---|---|---|
| 2026-08-08 | Documentacion de Idea 01: Pasaporte local jugable (web) | Revision del archivo en raiz |
| 2026-08-08 | Refinamiento de Idea 01: Mi Pasaporte, wallet de fidelizacion gamificada | Revision del archivo en raiz |
| 2026-08-08 | Documentacion de Idea 02: Humbly, planes por actividad | Revision del archivo en raiz |
| 2026-08-08 | Documentacion de Idea 03: servicios confiables para el hogar en Cuenca | Revision del archivo en raiz |
| 2026-08-08 | Comparacion de tres ideas y recomendacion provisional | Revision del analisis y formulas de ingreso |
| 2026-08-08 | Investigacion de referentes y patrones de Mi Pasaporte | Revision de fuentes oficiales, casos y hoja de ruta |
| 2026-08-09 | Investigación de competencia local/nacional de fidelización, QR y promociones | Revisión de sitios y precios públicos de competidores |
| 2026-08-09 | Plan V1, roadmap, ADRs y nueve specs de producto en borrador | Revisión de documentos en `docs/` |
| 2026-08-09 | Protocolo de trabajo con agentes y plantilla de spec reforzada | Revisión de `AGENT-WORKFLOW.md` y plantilla |
| 2026-08-10 | Separación de arquitectura transversal y specs de feature | Revisión de `ARCHITECTURE.md` y spec 0004 |
| 2026-08-10 | Ciclo de vigencia de activos y retención guest definido | Revisión de ADR 0005 y DoD de spec 0004 |
| 2026-08-10 | Alcance de programas, campañas y eventos por negocio definido | Revisión de ADR 0006 y specs 0002/0003 |
| 2026-08-10 | Alcances de permiso y auditoría con snapshots definidos | Revisión de ADR 0007 y spec 0001 |
| 2026-08-10 | Owner definido como único administrador de merchant staff | Revisión de ADR 0008 y spec 0001 |
| 2026-08-10 | Cierre de local y validación de beneficios definidos | Revisión de ADR 0009 y specs 0002/0003/0006 |
| 2026-08-10 | Dominios de acceso de consumidor, plataforma y comercio separados | Revisión de ADR 0010 y spec 0001 |
| 2026-08-10 | Modelo de campañas compuesto mediante Incentive Engine definido | Revisión de ADR 0018 y Spec 0003 rediseñada |
| 2026-08-10 | Handoff para fase de arquitectura | Revisión de `docs/HANDOFF.md` |
| 2026-08-10 | Repositorio remoto canónico documentado y commit inicial local creado | `git log --oneline -1` muestra `6467628` |

## Descartado (y por que)

Los caminos descartados importan: sin registro, se reintentan.

| Que | Por que no |
|---|---|
