---
fecha: 2026-08-12
resumen: Los programas de fidelización se publican como versiones inmutables con transición explícita y términos comerciales renderizados, auditables y aceptados por versión.
estado: aceptada
---

# ADR 0026 — Versiones, transiciones y términos de programas

## Contexto

Cambiar una configuración de fidelización puede afectar saldos, progresos y expectativas ya
adquiridas. Un cambio de “10 sellos” a “12 sellos”, o de Puntos a Sellos, no puede
reescribir la regla bajo la que una persona acumuló valor. Además, cada programa necesita
términos comerciales claros sin obligar a cada negocio a redactarlos desde cero.

## Decisión

- Un negocio posee como máximo un programa activo, conforme al ADR 0020. Cada publicación
  crea una `loyalty_program_version` inmutable de modalidad `points`, `stamps`, `tiers` o
  `cashback`.
- La UI inicial habilita sólo Puntos y Sellos. Las cuatro modalidades forman parte del
  contrato tipado y del almacenamiento desde el inicio; Niveles y Cashback no reciben UI,
  emisión ni canje hasta tener sus decisiones económicas completas.
- La configuración se guarda como JSON versionado por modalidad y se valida en servidor con
  un esquema estricto por `kind` y `schema_version`. No se acepta JSON libre.
- Una versión tiene dos límites distintos:

  | Campo | Efecto |
  |---|---|
  | `earning_ends_at` | Después de esa fecha ya no recibe nueva acumulación. |
  | `redemption_ends_at` | Hasta esa fecha se puede consultar/canjear lo ya emitido. |

- Al publicar V2, V1 debe recibir ambas fechas. La nueva acumulación se asignará a V2 desde
  su `effective_from`; V1 se conserva para consulta, canje y futuras notificaciones hasta
  su cierre. Nunca se borra ni se convierte automáticamente actividad previa.
- Todo programa publicado incluye una versión inmutable de términos comerciales. Se compone
  de cláusulas de biblioteca, cláusulas custom y variables permitidas resueltas con el
  contexto del negocio/programa. Editar una cláusula nunca modifica la plantilla base.
- Las plantillas están versionadas, localizadas y tienen un alcance de jurisdicción. Son
  ayuda de redacción; no representan asesoría legal ni garantizan cumplimiento en una
  jurisdicción sin revisión jurídica aprobada.
- La futura wallet registra aceptación afirmativa contra el hash y la versión exacta de los
  términos publicados. Los términos de programa son distintos de la política de privacidad
  de Mi Pasaporte y de los términos de la plataforma.

## Consecuencias

- Wallet, canje, campañas y analíticas deben referenciar `loyalty_program_version_id`, no
  sólo el negocio o el programa actual.
- Cambiar de modalidad con actividad pendiente se convierte en una transición explícita y
  comunicable, no en una edición silenciosa.
- La biblioteca reduce carga para el owner y conserva procedencia de cada cláusula, pero
  exige un proceso editorial y revisión legal antes de publicar contenido para una nueva
  jurisdicción.

## Relación

Complementa ADR 0020 (programa único y modalidades excluyentes), ADR 0005 (vigencia de
activos), ADR 0018 (efectos tipados) y ADR 0024 (secretos/configuración).
