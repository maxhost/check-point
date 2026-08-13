---
fecha: 2026-08-12
resumen: Un programa de fidelización es una configuración mutable por ciclo; se cierra con fechas de acumulación y canje, sin versionarlo internamente.
estado: aceptada
supersede: ADR 0026
---

# ADR 0027 — Programa mutable con cierre fechado

## Contexto

La primera propuesta convirtió cada cambio de configuración en una versión inmutable y
modeló transiciones entre versiones. Eso añade una carga operativa que el Owner no necesita
en esta fase: para cambiar las reglas de fondo, cerrará el programa actual y abrirá otro
cuando termine. Los términos son informativos y pueden actualizarse sin crear un programa
nuevo.

## Decisión

- Un ciclo de fidelización es una fila `loyalty_program`. Un negocio puede tener historia de
  programas cerrados, pero a lo sumo uno operativo (`active` o `closing`) mediante un índice
  parcial por `business_id`.
- El programa contiene directamente `kind`, `schema_version`, `configuration`, términos
  actuales renderizados, su hash y sus fechas operativas. No existen
  `loyalty_program_version`, `loyalty_program_transition`, `loyalty_terms_version` ni
  `loyalty_terms_clause`.
- Estados:

  | Estado | Significado |
  |---|---|
  | `active` | Acumula y canjea según su configuración. |
  | `closing` | No acepta cambios de configuración; acumula hasta `earning_ends_at` y permite canje hasta `redemption_ends_at`. |
  | `inactive` | El cierre de canje terminó; conserva sólo historia operativa. |

- El Owner puede modificar Puntos/Sellos y los TOS mientras el programa está `active`.
  Esas modificaciones actualizan la misma fila; no reescriben actividad futura porque la
  emisión/canje aún no existe en esta etapa. Antes de activar saldos se decidirá el ledger y
  qué snapshots consumen sus eventos.
- Al cerrar, el Owner define fecha final de acumulación y fecha final de canje, ambas
  interpretadas en la zona horaria IANA del negocio. `closing` informa la vigencia a la
  wallet futura. Luego de la fecha final se marca `inactive` mediante tarea idempotente; las
  decisiones de elegibilidad siempre consultan las fechas, no sólo el scheduler.
- Para cambiar de modalidad o crear un ciclo con reglas nuevas, el Owner cierra el programa
  actual y crea otro sólo después de que esté `inactive`. No se convierten puntos ni sellos
  automáticamente.
- `core.business.timezone` es obligatorio y contiene un identificador IANA. No se infiere
  por país: onboarding lo solicita y las migraciones de datos existentes requieren un valor
  explícito por negocio.
- Las plantillas de términos siguen siendo ayuda editorial. El contrato HTTP valida su forma
  para devolver `422` ante payload inválido; esto no convierte el texto en restricciones de
  negocio ni asesoría legal.

## Consecuencias

- Se elimina la complejidad de versionado, transiciones y punteros de versión activa.
- La UI muestra el programa actual, su estado y sus fechas de cierre; no muestra un historial
  de versiones internas.
- Un futuro ledger deberá referenciar el `loyalty_program_id` del ciclo que emitió el valor,
  no una versión de configuración.
- La migración preserva la configuración y los términos activos actualmente existentes, y
  elimina las tablas de versionado antes de habilitar datos de saldo reales.

## Relación

Supersede ADR 0026. Ajusta ADR 0020 sin cambiar su decisión principal: modalidad única por
negocio operativo, con Puntos/Sellos habilitados y Niveles/Cashback reservados.
