---
adr: 0131
fecha: 2026-10-08
estado: aceptada
resumen: Las mesas son una entidad propia del local (`core.dining_table`: nombre unico entre las activas del local, plazas opcionales, orden, `active | archived`, nunca se borran); las administra el permiso `locations`. El POS las usa con texto libre de respaldo (`pos_order.dining_table_id` opcional, el nombre queda como foto en `table_label`) y la base impide dos ordenes abiertas en la misma mesa. Las reservas futuras van en tablas aparte que apuntan a la mesa; hoy no se construye nada de reservas.
---

# 0131 — Mesas del local

## Contexto

El owner, 2026-10-08: «los locales ahora puedan tener mesas. las mesas las vamos a usar en el POS. las mesas son
unidades simples, tienen un nombre y podemos poner tambien cantidad de plazas por ejemplo Mesa 1 = 4 asientos. solo
para tener esto preparado por ejemplo para restaurantes». Y sobre reservas: «No se que necesitariamos si quisieramos
usarlo en el futuro para un sistema de reservas. Por ejemplo … la mesa 3 = 3 comenzales hora 11am. pero ya me
interesa pensarlo».

Hoy el POS guarda la mesa como texto libre (`core.pos_order.table_label`, spec 0169, que dejo afuera «gestion de
mesas»). Un texto no sirve para saber que mesa esta ocupada ni para que una reserva apunte a una mesa.

## Decisiones del owner (2026-10-08, por pregunta cerrada)

1. El POS usa las mesas **ya, con texto libre de respaldo**: si el local tiene mesas se ofrecen; el texto libre
   sigue valiendo siempre (la opcion «obligatorio» fue rechazada).
2. Las administra el **permiso `locations`** (el owner siempre; el staff con ese permiso).
3. Campos: **nombre + plazas + orden**, nada mas por ahora (zona, minimo de comensales y «reservable» rechazados).
4. **Una orden abierta por mesa**: la base lo impide.
5. Plazas **opcionales** (una «Barra» sin plazas).

## Decision

1. **Tabla propia `core.dining_table`**, hija del local: `name` (1..60, unico sin mayusculas entre las ACTIVAS del
   mismo local), `seats` (null o 1..99), `sort_order`, `status` `active | archived`. **Nunca se borra**: se archiva,
   como el local (spec 0061). Asi ninguna orden ni reserva futura queda apuntando a algo que no existe.
2. **El POS enlaza por id y fotografia el nombre**: `pos_order.dining_table_id` opcional; con mesa, el servidor
   escribe `table_label` = nombre de la mesa (lo impreso y el historial no cambian si despues se renombra). Sin mesa,
   el texto libre de hoy.
3. **Ocupacion en la base**: indice unico parcial sobre `pos_order (dining_table_id) WHERE status = 'open'`. La
   carrera de dos mozos abriendo la misma mesa la resuelve Postgres (`23505` → 409 `table_occupied`).
4. **Archivar una mesa con orden abierta** → 409 `table_has_open_order`. Reactivar una mesa cuyo nombre ya usa otra
   activa → 409 `table_name_taken`.

## Reservas (pensado, NO construido)

Lo que una reserva necesita y como encajaria, para que el modelo de hoy no lo bloquee:

- `core.reservation`: `business_id`, `location_id`, `starts_at` (timestamptz), `duration_minutes` (o `ends_at`),
  `party_size`, nombre y telefono del cliente (o `consumer_id` si tiene pase), `status`
  (`pending | confirmed | seated | completed | cancelled | no_show`), `note`, quien la tomo.
- `core.reservation_table (reservation_id, dining_table_id)`: muchas a muchas, porque un grupo grande junta mesas.
- **Doble reserva imposible en la base**: una restriccion `EXCLUDE USING gist (dining_table_id WITH =,
  tstzrange(starts_at, ends_at) WITH &&) WHERE status in (…activos)` (extension `btree_gist`), sobre la tabla de
  union con el rango copiado.
- «Sentar» una reserva = abrir la orden del POS en esa mesa (`pos_order` podria ganar `reservation_id`).
- Datos que se agregarian a la mesa cuando hagan falta, sin romper nada: `min_seats`, `reservable`, zona. El horario
  del local ya existe (`location_hours`, spec 0113) para validar que la reserva cae en horario.

Lo unico que la mesa necesita HOY para eso es: id estable, plazas y archivar en vez de borrar. Esta decision lo da.

## Consecuencias

- Una migracion (`0067`): tabla nueva + columna e indice en `pos_order`.
- Renombrar una mesa no cambia el `table_label` de sus ordenes ya guardadas; una orden abierta lo refresca en su
  proximo `PUT`.
- La pantalla para administrar mesas y elegirlas en el POS es de GPT (ADR 0114); el contrato es la spec 0182.
