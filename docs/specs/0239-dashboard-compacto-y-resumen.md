---
spec: 0239
fecha: 2026-10-18
estado: cerrada
resumen: Inbox compacto como lista de correo y tres indicadores financieros reales del Dashboard, cargados en paralelo.
disjunta: no; se integra con el contexto compartido de 0238.
---

# 0239 — Dashboard compacto y resumen

El owner pide reemplazar las tarjetas enormes por un Inbox tipo correo y mostrar punto de equilibrio mensual, equilibrio diario y cuánto lleva hoy. Solicita un agente con contexto limpio. Un único implementador; coordinador reserva, revisa e integra. Sin push ni operaciones PROD. No hay migraciones ni cambios al kit.

## Comportamiento cerrado

- Encima del Inbox, tres indicadores compactos: **Punto de equilibrio mensual**, **Equilibrio diario**, **Cuánto vas hoy**. En móvil se adaptan sin scroll horizontal.
- Mensual reutiliza `calculateGoal(input).breakEvenMinor`. Diario es su promedio entre los días calendario del mes local, redondeado hacia arriba en unidades menores mediante aritmética exacta. Explicar el denominador visible. No usar `targetMinor`, que es una meta condicional diferente.
- Cuánto vas hoy es la suma neta de `revenue` del día local del comercio, todos sus locales; no utilidad, facturación mensual ni importes de las tarjetas DEMO.
- Se conservan moneda, unidad menor, disponibilidad y carácter estimado del cálculo existente. Un equilibrio desconocido se muestra pendiente con explicación; nunca como cero. Ventas cero sí es un resultado válido. No inventar equilibrio si faltan gastos cerrados, cobertura/costos exactos o margen positivo.
- Se adopta el promedio calendario como supuesto explícito comunicado por el coordinador; la pregunta opcional sobre meta ajustada no autoriza inferir una respuesta del owner. Si llega una corrección, revisar el contrato antes de implementar la fórmula afectada.
- Inbox: lista con separadores, todos los avisos cerrados al entrar. Fila compacta con remitente, asunto, extracto y período; una abierta a la vez. Abrir conserva cuerpo completo, importe/calidad, enlace y decisiones. Sin truncar información de forma irreversible.
- Button del kit con `aria-expanded`/`aria-controls`; teclado Tab/Enter/Espacio, foco visible, controles táctiles utilizables. Las decisiones no están anidadas en el botón de apertura. Sin interacción sólo por hover ni nuevas primitivas, handlers nativos, CSS o estilos crudos.
- Abrir/cerrar no marca visto ni dispara escrituras. Conservar decisiones, idempotencia, expiración, preparar/error/reintento/vacío, bloqueo de doble acción y diálogo de recordatorio de 0237/0238. Cambiar sólo estado local de expansión, no duplicar payload ni dueño de Inbox.

## Datos y contrato HTTP

Nuevo `GET /api/analytics/summary`, lectura privada independiente. Resuelve permiso `analytics` mediante `requireApiPermissionSinGateDeEmail`, igual que Inbox e histórico de Analíticas, y conserva los demás gates/precedencia existentes; valida `X-Backoffice-Scope` capturado antes de la intención tras guards y antes de leer dominio. No usa la marca para seleccionar negocio. Reutiliza el protocolo 0238, legacy sin header compatible, mismatch409 `backoffice_context_changed`. Todas sus respuestas `Cache-Control: private, no-store`; no cachear permisos entre peticiones.

Respuesta200 mínima version1: `date`, `timezone`, `currencyCode`, `minorUnit`, `readAt`, `monthBreakEvenMinor`, `dailyBreakEvenMinor`, `todayRevenueMinor`, `estimated` y motivo cerrado de indisponibilidad del equilibrio. Los importes son enteros seguros en unidades menores; mensual/diario admiten null. Tipo puro y builder en dominio, sin imports servidor en UI. El servidor obtiene una sola `readInput` para los tres valores, sin llamar a `readHistory`/`readDay` ni devolver métricas/conceptos/filas completas. Lectura fallida devuelve error operativo local, sin falsos ceros.

El GET se inicia al montar el resumen visible y en paralelo con Inbox; **no se agrega ninguna consulta en serie al GET Inbox**, ni se modifica su contrato/lifecycle/POST. Coste previsto: una petición adicional con sus guards por petición y una lectura de input, a verificar por código/pruebas; se acepta para aislar latencia y fallo del resumen.

## Integración y frescura

- Quinto recurso `summary` en el mismo owner y snapshot de 0238, sin store, caché, owner duplicado ni framework nuevo. Tickets de ámbito/época/generación; máximo un activo y un pendiente, respuesta tardía descartada y retiro inmediato de datos privados al perder ámbito.
- Sólo se lee cuando está observado. Remontar obtiene lectura nueva. Foco visible/online se agrupan con mecanismos existentes; un reintento explícito actualiza sólo resumen. Cero GET nuevos de sesión/módulos por montar el indicador; fuera del Dashboard, cero lecturas de resumen.
- Durante relectura puede conservar el último dato con estado de actualización; si falla, identificarlo como lectura anterior. Un error del resumen no oculta ni bloquea Inbox. 401/scope409 retiran el contexto conforme a0238; 402/403 limpian/restringen el recurso sin bucles.
- Las ventas aparecen según las proyecciones reales de Analíticas al leer. Montar/volver desde POS/foco/online/refrescar consultan de nuevo. `readAt` es la hora de lectura, no garantía de que se procesaron todos los eventos. No prometer sincronía con el cobro ni actualización remota push. Sin polling, SSE, websocket, BroadcastChannel o crons nuevos en este encargo.

## Verificación y entrega

Implementador en worktree/ref propios asignados por factory, sin editar índices/estados/spec del coordinador. Handoff propio con SHA, comandos y límites; no subdelegar.

- Unidad builder: cero/null, moneda/unidad, mes de28/29/30/31días, exactitud/redondeo y desbordamiento, fecha local y reglas de disponibilidad.
- HTTP focal: auth/scope/gates antes de input, una lectura, privado/no-store en errores y éxito, fallo de resumen aislado. Sin test DB fuera de `tools/neon-test.sh`; UI y cálculo puro no necesitan otra campaña DB.
- Owner/contexto: constructor sin I/O, dos lectores/StrictMode, montaje/remontaje, foco agrupado, cancelación/retirada y respuestas obsoletas. No relajar conteos antiguos para esconder duplicación.
- Browser: lista cerrada compacta, una apertura, teclado, decisiones y recordatorio preservados; resumen lento/fallido permite usar avisos; ninguna llamada auxiliar de sesión/módulos; scope retirado oculta números. Harness existente adaptado, sin fingir Next real.
- Tipos/lint/guardia UI focales y diff-check. Inspección visual desktop/móvil en una tanda y, si hace falta, una sola confirmación. No repetir M1 de120recargas ni baterías globales por ceremonia; los números previos de0238 pertenecen a su SHA y no certifican el Dashboard ampliado.

Aceptación: requisitos anteriores, evidencia ligada a SHA/entorno, revisión del coordinador independiente del código del agente y demo disponible en dev. Main local después de QA proporcional; publicar sólo con nueva autorización. Preservar QA manual pendiente, CI/guardias históricas, FAIL frío1817.621042ms y todos los diferidos ajenos. Rollback conjunto de esta implementación sin DDL.
