---
adr: 0101
fecha: 2026-09-28
estado: aceptada
resumen: Enmienda de rendimiento al ADR 0100, antes de ir a prod (pedido del owner). (1) El total sin filtro sale de un contador por negocio `core.business_customer_count` mantenido por TRIGGER sobre la proyeccion (49 ms → 0,02 ms); (2) la busqueda por nombre calcula pagina y total como dos subconsultas independientes en vez de materializar todas las coincidencias (17–45 ms → 9–18 ms); (3) la lectura baja de 7 a 4 viajes a la base (rol y negocio en un `set_config`; programa operativo, pagina y total en una sola sentencia).
---

# 0101 — El listado de clientes no cuenta en cada pedido

## Contexto

La spec 0108 quedo implementada con PASS y el benchmark en umbral (ADR 0100), sin aplicar a prod. El
owner pidio, antes de ir a prod, mejorar los numeros. Medido en la rama `bench-clientes-comercio` (3M
filas, un negocio de 200.000, la `0053` real, como `customer_reader` con RLS, 2a corrida):

- El **total** sin filtro es un `count(*)` de todo el negocio en cada pedido: **44–49 ms**, y domina la
  pagina 1 (0,4 ms). Un indice mas angosto solo por `business_id` **no** ayuda (49 → 44 ms): contar
  200.000 entradas cuesta eso con cualquier indice.
- La **busqueda** materializa todas las coincidencias en un CTE, las cuenta y las ordena antes de
  paginar. Separando pagina y total, cada una con su plan:

  | Termino (coincidencias) | Hoy | Pagina + total separados |
  |---|---|---|
  | `maria` (10.000) | 18,6 ms | 0,33 + 8,98 = 9,3 ms |
  | `nez` (20.906) | 32,5 ms | 0,15 + 13,35 = 13,5 ms |
  | `ia ` (30.000) | 44,6 ms | 0,15 + 17,61 = 17,8 ms |
  | `villacis` (8.000) | 17,0 ms | 0,38 + 9,30 = 9,7 ms |
  | `xqzw` (0) | 0,13 ms | 0,05 + 0,04 = 0,09 ms |

- La lectura hace **7 viajes**: `BEGIN`, programa operativo, `SET LOCAL ROLE`, `set_config`, pagina,
  total, `COMMIT`. La funcion corre en Vercel `iad1` y la base en `aws-us-east-2` (header
  `x-vercel-id` y `list_branch_computes`, 2026-09-28): cada viaje cruza de region. **La latencia de ese
  tramo no esta medida.**
- `set_config('role', 'customer_reader', true)` equivale a `SET LOCAL ROLE`: medido en la rama, en UNA
  sentencia junto con `app.business_id`, `current_user` = `customer_reader`, 0 filas ajenas, 200.000
  propias, y `permission denied` sobre `consumer.consumer_account`.

## Decision

1. **Contador por negocio**, `core.business_customer_count (business_id PK FK core.business on delete
   cascade, customers int not null check >= 0)`, mantenido por un **trigger `AFTER INSERT OR DELETE`
   sobre `core.business_customer`** que suma o resta. Trigger y no codigo en cada escritura: la
   proyeccion tambien pierde filas por `on delete cascade` (cuenta o negocio borrados), y un trigger lo
   ve venga de donde venga. Un upsert que termina en `DO UPDATE` no dispara el `INSERT`, asi que una
   compra no toca el contador: **solo lo mueve un cliente nuevo o uno borrado**. Medido: 0,02 ms la
   lectura. `customer_reader` lo lee con la misma RLS por `app.business_id`.
2. **La busqueda calcula pagina y total por separado** dentro de la misma funcion `SECURITY DEFINER`:
   la pagina es `… ORDER BY last_visit_at DESC NULLS LAST, consumer_id LIMIT/OFFSET` directo sobre la
   tabla (el planner elige recorrer el indice de orden o el de trigramas), el total es su propio
   `count(*)`. Misma firma y misma forma de salida (siempre la fila del total), asi que el contrato no
   cambia.
3. **4 viajes en vez de 7**: `BEGIN`; UNA sentencia con los dos `set_config` (rol y negocio); UNA
   sentencia que resuelve el programa operativo, la pagina, el saldo y el total; `COMMIT`. Para que el
   programa operativo entre en esa sentencia, `customer_reader` gana `SELECT (id, business_id, kind,
   status)` sobre `core.loyalty_program`, con RLS por `app.business_id` (dueño con `BYPASSRLS`: el resto
   de la app no cambia, mismo argumento que `program_membership` en el ADR 0100).

## Consecuencias

- Pagina 1 del negocio de 200.000: de ~50 ms de base a < 1 ms. Ultima pagina: ~61 ms (el costo propio
  de un `OFFSET` de 200.000; las paginas que se usan de verdad, las primeras, quedan en ~1 ms).
- El total de una **busqueda** sigue creciendo con las coincidencias (es un `count`); el de la lista
  sin filtro ya no crece con nada.
- **Contencion aceptada:** dos altas simultaneas de clientes NUEVOS del mismo negocio se serializan en
  la fila del contador hasta el commit. Las altas son sentencias cortas; una compra no la toca.
- Se agrega una migracion `0054` aditiva; la `0053` no se reescribe (ya esta aplicada en
  `ci-integration`). Las dos van a prod juntas, antes del deploy.
- **Fuera de este ADR, decision del owner:** mover las funciones de Vercel a `cle1` (junto a la base)
  y subir el minimo del computo de prod (hoy 0,25 CU). Afectan a toda la app y tienen costo.

## Enmienda (2026-09-28) — la busqueda va en `plpgsql` con `EXECUTE`

La decision 2 se implemento como `LANGUAGE sql` y en el benchmark **empeoro** (31–79 ms contra 19–49 de
la 0108): esa funcion se planifica sin el termino y el planner no puede elegir indice. Medido en la rama
con la misma consulta en `plpgsql` + `RETURN QUERY EXECUTE format(… %L …)`: 9–15,5 ms. La busqueda se
arma por llamada con el termino como literal citado (`%L`) y los enteros tipados: sin inyeccion posible.
La tabla de «9–18 ms» del Contexto se midio con el termino LITERAL, no dentro de la funcion.

