---
spec: 0024
fecha: 2026-08-12
estado: en curso
resumen: Owner administra un ciclo de fidelización mutable de Puntos o Sellos y lo cierra con fechas expresadas en la zona horaria del negocio.
disjunta: no
archivos: apps/merchant, migraciones Drizzle, Neon, pruebas y docs
---

# 0024 — Programa de fidelización real y términos

## Problema

El programa demo vive en `sessionStorage`. El Owner necesita un único programa operativo
para su negocio, configurable sin crear versiones artificiales, y una forma clara de cerrarlo
para informar hasta cuándo se puede acumular y canjear.

## Alcance

**Entra:**

- Puntos o Sellos, nunca ambos dentro del mismo programa; `tiers` y `cashback` quedan como
  modalidades reservadas y no operables.
- Un programa mutable por ciclo y a lo sumo uno operativo por negocio.
- Edición de configuración y términos informativos mientras está activo.
- Cierre con fecha de fin de acumulación y fecha final de canje; creación de un ciclo nuevo
  sólo después del cierre completo.
- `business.timezone` IANA obligatorio: onboarding, API, persistencia UTC y presentación
  local consistente.
- Biblioteca de cláusulas editoriales, copia editable y texto adicional. Las cláusulas sólo
  se guardan al guardar el programa, no al seleccionarlas.
- Autorización owner, contrato HTTP estricto, responsive, accesibilidad, toasts y skeleton.

**No entra:**

- Ledger, saldo, canje, campañas conectadas, wallet consumer, notificaciones y aceptación
  afirmativa de TOS.
- Convertir TOS textuales en reglas bloqueantes; eso pertenece al motor de campañas y sus
  restricciones.
- Carga de imagen de sello: `stampImageObjectKey` queda reservado hasta configurar R2.
- Operación de Niveles/Cashback.

## Modelo de datos

```text
business
  timezone IANA NOT NULL

loyalty_program
  id, business_id,
  kind(points|stamps|tiers|cashback), schema_version, configuration_json,
  status(active|closing|inactive),
  activated_at, earning_ends_at?, redemption_ends_at?,
  terms_markdown, terms_hash, terms_updated_at,
  created_by, created_at, updated_at

terms_template
  biblioteca editorial publicada; no es estado del programa
```

Invariantes:

- Puede haber múltiples ciclos históricos, pero un único programa `active` o `closing` por
  negocio mediante índice parcial.
- `closing` exige ambas fechas, convertidas desde la timezone IANA del negocio, con
  `earning_ends_at < redemption_ends_at`.
- El programa acumula si es `active`, o si es `closing` y aún no llegó `earning_ends_at`;
  puede canjear si es `active`, o si es `closing` y no superó `redemption_ends_at`.
- `inactive` sólo se alcanza después del final de canje. La tarea programada es idempotente;
  la elegibilidad usa fechas como defensa ante retrasos.
- Puntos exige unidad singular/plural. Sellos exige unidad, objetivo entero 2–50 y admite
  `stampImageObjectKey` no vacío cuando exista R2.
- Términos son texto informativo con hash. El payload se valida como datos de API, no como
  reglas ejecutables de negocio.

## Rutas

- `GET /api/loyalty-program`: programa operativo y términos para el owner de sesión.
- `PUT /api/loyalty-program`: crea el programa activo o actualiza configuración/TOS del
  programa activo. Rechaza una modalidad distinta: requiere cerrar e iniciar nuevo ciclo.
- `DELETE /api/loyalty-program`: inicia el cierre con ambas fechas.
- `GET /api/loyalty-terms/templates`: biblioteca `published` para owners autenticados.

## UI

```text
sin programa → elegir Puntos/Sellos → configurar → TOS → activar
activo → editar configuración/TOS | iniciar cierre
closing → fechas de vigencia y aviso; no permite editar ni crear otro
inactivo → crear nuevo programa
```

La UI utiliza la zona horaria del negocio en etiquetas y campos de fecha. No muestra
versiones ni transiciones, porque no existen en el modelo.

## Plan production-grade

1. **Contrato y datos.** Definir validadores de payload discriminados por modalidad y zona
   horaria IANA; añadir `business.timezone` nullable, completar explícitamente cada negocio
   existente y sólo entonces convertirla en `NOT NULL`.
2. **Migración sin pérdida del programa actual.** Copiar a `loyalty_program` la configuración,
   modalidad y términos de la versión activa actual; reemplazar el índice único histórico por
   un índice parcial de programa operativo; eliminar puntero, tablas e índices de versiones y
   transiciones. Se valida conteo y hash antes y después en Neon.
3. **Servicio y API.** Reemplazar publicación/versionado por crear, editar y cerrar. La
   operación de cierre se protege con condición de estado y constraint; requests malformados
   reciben `422`, nunca un falso `503`.
4. **Timezone.** Convertir `datetime-local` en UTC con la timezone IANA del negocio y mostrar
   las fechas desde UTC usando esa misma timezone. Cubrir zonas sin DST y con DST.
5. **UI.** Quitar creación de V2 y tabla de versiones; conservar confirmación de cierre,
   términos editables y skeleton; bloquear edición mientras el programa está `closing`.
6. **Pruebas reales.** Unitarias de payload/zonas/ventanas; integración contra la rama Neon
   persistente de desarrollo autorizada; E2E login → crear → editar TOS → cerrar → verificar
   bloqueo/fechas con un owner de prueba nuevo. Se habilita explícitamente con
   `E2E_LOYALTY_MUTATION_TEST=true`; no toca owners de uso manual.
7. **Entrega.** Ejecutar format, lint, typecheck, test, E2E y build; verificar migración y
   datos en Neon antes del despliegue.

## Definition of Done

- [ ] Un owner crea, consulta y edita un único programa operativo Puntos o Sellos.
- [ ] La API valida su payload completo y devuelve `422` ante estructura inválida.
- [ ] Un programa se cierra con ambas fechas en la timezone IANA del negocio; deja de
  acumular y canjear según esas fechas.
- [ ] Sólo después de estar `inactive` se puede crear un nuevo ciclo para el negocio.
- [ ] Los TOS se guardan sólo al guardar, son editables e informativos; no crean versiones.
- [ ] No quedan tablas, índices, rutas, UI ni documentación de versiones/transiciones.
- [ ] Migración aplicada y verificada en Neon; unitarias, integración, E2E y build pasan.

## Abierto

R2, ledger/saldos, wallet y aceptación de TOS se abordan en sus specs propias antes de
exponerlos a consumidores. El scheduler idempotente de cierre queda disponible como cron
protegido por `CRON_SECRET`.
