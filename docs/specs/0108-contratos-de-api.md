# 0108 — Contrato de API: listado de clientes

> Contrato para quien hace la UI (GPT). Implementa la spec 0108 / ADR 0100. Rutas relativas a
> `apps/merchant/src/`. Convenciones y errores: los de `0101-contratos-de-api.md`. **El `code` es el
> contrato; el `error` es copia.** Estado de la entrega: `docs/INDEX.md`.

## `GET /api/customers`

**Guard:** `requireApiPermission(request, "counter")`. Lo usan el **owner** y el **staff con el
permiso «Mostrador»**. Escalera identica a la de `0101` §Guard, con `counter` en el paso 3:

| Paso | Pregunta | `code` | Status |
|---|---|---|---|
| 1 | ¿hay sesion? | `unauthorized` | 401 |
| 2 | ¿membresia ACTIVA del negocio? | `not_member` | 403 |
| 3 | ¿owner, o staff con `counter`? | `missing_permission` | 403 |
| 4 | ¿email verificado? — solo owner | `email_not_verified` | 403 |
| 5 | ¿el negocio OPERA? | `business_suspended` \| `business_closed` | 403 |

**Query** (todo opcional):

| Param | Regla |
|---|---|
| `page` | entero ≥ 1, def. `1` |
| `q` | busqueda por nombre, «contiene», sin distinguir tildes ni mayusculas; **3 a 60** caracteres despues de recortar |
| `phone` | telefono **exacto** en E.164 (`+593987654321`). La UI arma el `+<codigo>` con el pais (def. el del negocio) |

`q` y `phone` son excluyentes. Sin ninguno, lista todo.

- **Con la caja de busqueda vacia, la UI OMITE `q`** (no manda `q=`): `q` vacio o de solo espacios es
  un `400` `fields.q`.
- **El `+` del telefono va codificado** (`encodeURIComponent` → `%2B`): sin codificar, la query lo
  convierte en espacio y la respuesta es `400` `fields.phone`.

**200:**

```ts
{
  items: Array<{
    name: string;               // nombre y apellido, tal cual los cargo el cliente
    enrolledAt: string;         // ISO-8601 — su primera alta en el negocio
    lastVisitAt: string | null; // ISO-8601 — ultima compra o canje en mostrador; null = nunca vino
    balance: { kind: "points" | "stamps"; value: number } | null;
                                // del programa ACTIVO; null si no esta en el o no hay programa activo
  }>;
  page: number;       // la pedida
  pageSize: 25;       // fijo
  total: number;      // clientes que cumplen el filtro
  totalPages: number; // ceil(total / 25); 0 si total = 0
}
```

- **Orden fijo**: `lastVisitAt` descendente; los `null` (nunca vinieron) al final. Estable entre
  paginas.
- Una `page` mayor que `totalPages` devuelve `items: []` con el `total` real: **no** es error. La UI
  puede usarlo para volver a la ultima pagina.
- **No hay id de cliente ni telefono en la respuesta, a proposito** (ADR 0100). Usar el indice de la
  fila como `key` de React.
- Buscar por telefono devuelve 0 o 1 fila. Si el numero no es de un cliente del negocio, la
  respuesta es la misma que si no existiera: `items: []`, `total: 0`. La UI muestra «Sin
  resultados», nunca «ese numero no esta registrado».

**Errores de entrada** (`400`, `code: "validation"`, con `fields`):

| Caso | `fields` |
|---|---|
| `page` no es entero ≥ 1 | `{ page }` |
| `q` con menos de 3 o mas de 60 caracteres | `{ q }` |
| `phone` no es E.164 | `{ phone }` |
| `q` y `phone` juntos | `{ q, phone }` |

Sugerencia de UI (no es contrato): no disparar la busqueda por nombre hasta 3 caracteres, con
*debounce* de ~300 ms; precargar la pagina siguiente para que «siguiente» sea instantaneo.
