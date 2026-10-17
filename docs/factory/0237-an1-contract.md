# 0237 — Contrato de implementación AN-1

Encargo explícito del owner: implementar exclusivamente AN-1 de spec0237, ADR0152/0153; candidato local en dev con QA independiente y handoffs. Base dev `76ccf0f93a32e8e60426d79ebe0aa7cd99392953`. No INDEX, TASKS ni estado de Claude. No push, deploy, lectura ni migración PROD; main local tampoco se avanza sin autorización, conforme al cierre específico de la spec. La migración nueva se prepara y solo se aplica por el wrapper de pruebas a CI aislada.

Coordinador único: reservas, integración serial en dev y evidencia. Dos implementadores sin subdelegación y QA fresco; hasta tres worktrees operativos. Dependencias propias desde dev, Node24, hooks vigentes. Configuración de pruebas seleccionada, sin copiar env productivos. DB exclusivamente `tools/neon-test.sh`, recurso serial `db:neon-ci`; medir en rama efímera si hay credenciales de control disponibles. Sin verify global ni mutaciones.

## A — analytics-an1-events

Writer exclusivo de `packages/db` (analytics, core.location.city_id, UNA migración nueva y metadatos), `packages/domain/src/analytics/metrics.ts`, `server/module-events`, contratos/registros de módulos, productores/traductores POS/Recetas/Gastos, corte Stock, retirada de flag y preflight/soportes pertinentes. Servidor propio en `server/analytics/ingestion` y `server/analytics/context`. Permiso core analytics en catálogo. Contexto externo y cableado de ciudad al crear/editar locales; script de locales existentes bajo `tools/analytics`. Ruta interna context propia. Handoff `0237-an1-events.md`.

Primera entrega técnica: acordar tipos puros MetricTranslator/MetricRow con B y comunicar exports de esquema. Traductor sin tx/DB/reloj; fila con instante del hecho o día local explícito, dinero entero y cantidades exactas. Aplicador calcula día en timezone del comercio, mantiene cursor de revisión incluso cuando un borrado deja cero aportes y separa sourceKey por evento. Suscriptor core registrado sin depender de switches; no backfill de deliveries preexistentes. Eventos v1–v3 compatibles; comisión y consumo atómicos con sus orígenes. Toda ampliación de paths vuelve al coordinador.

Segunda entrega: contexto aislado del merchant, proveedor simulado y adaptador real sin clave impresa. Ciudad nullable sin intervención del dueño. Calendario Ecuador con reglas/traslados y fuentes oficiales versionadas. Prueba real Visual Crossing pendiente si falta clave, autorizada expresamente como no bloqueante.

## B — analytics-an1-product

Dominio `packages/domain/src/analytics` salvo metrics.ts de A: pesos, tarjetas 1/2/3/4/6/7/13, meta y períodos. Servidor propio en `server/analytics/{evaluation,queries,actions,http}`; rutas no internas analytics y evaluate interno. Dashboard/inbox, histórico/día, navegación core y tests focales browser. Handoff `0237-an1-product.md`. Kit existente sin modificar kit/guardias/CSS; copy tuteo, permisos analytics para owner/staff autorizado. Skill impeccable limitada a consistencia con la UI actual, sin decisiones nuevas de producto.

HTTP manda §3.5 de la spec. Guard deriva comercio de sesión/membresía activa; local/id ajeno 404, cron sin Bearer 401. Lecturas solo resúmenes, nunca tablas de origen. Evaluación diaria persistida con claim/locks/presupuesto y fallback 3s + after(); top5, acciones por contrato/módulo habilitado y permiso. Contexto externo no entra en las respuestas ni cálculos.

## QA — analytics-an1-qa

Solo documentación propia `0237-an1-qa.md` y artefactos focales independientes si hacen falta. Leer spec/ADR/diff y verificar entregas y combinación SHA congelada; no implementar producto certificado. Reutilizar evidencia compatible, reproducir señales decisivas. Criterios: §Pruebas pertinentes 1–11 acotados a AN-1 (API real exceptuada por clave), atomicidad/idempotencia/revisión tardía, tenant/permisos, conteo, pesos/meta, histórico, contexto persistido invisible y browser. Medición fría ≤1s o parar e informar, sin atribuir PASS a skips/retries. Fallos se devuelven a sus implementadores.

## Entrega y preservación

Cada worker commitea solo scope y documenta base/SHA, comandos/resultados reales, fallos, límites y migración preparada. `factory deliver` sobre checkout limpio; coordinador acepta solo con QA reproducible. Integración local conserva commits. Worktrees aceptados se conservan mientras no sean ancestros de main local; no forzar cleanup ni descartar archivos ajenos. Hallazgos que contradigan spec se informan al owner antes de resolver.
