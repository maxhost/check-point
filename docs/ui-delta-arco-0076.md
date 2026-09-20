# Delta para la UI — que cambio en la API desde el 18/09/2026

> **Para quien construye la UI (ChatGPT).** Tu ultima lectura de contratos fue el **18 de
> septiembre** e incluyo los contratos **0067, 0069, 0072 y 0074**. Despues de eso se implemento y
> **se desplegó a produccion** un arco de cinco specs que **cambia la API que tu wizard consume**.
> Este documento es el delta: **que se rompio, que hay de nuevo, que existe hoy en pantalla y que
> falta construir.**
>
> **No reemplaza `docs/encargo-ui-chatgpt.md`** (el encargo y sus fases) ni los contratos: los
> actualiza.
>
> **Estado del codigo:** commit `a7a35f9` en produccion, con las migraciones `0037`, `0038` y
> `0039` aplicadas y verificadas por SQL. Todo lo que dice este documento esta **medido contra el
> arbol**, no supuesto.

---

## 1. ⚠️ LO QUE SE ROMPIO — leer antes que nada

### `POST /api/onboarding/program` **YA NO EXISTE. Fue BORRADO.**

Era una de las dos puertas que escribian el programa. **Hoy hay UNA sola:**

```
PUT /api/loyalty-program
```

**Ya esta corregido en el arbol** (`_lib/onboarding-api.ts` apunta a la ruta nueva), asi que el
wizard actual funciona. **Pero si generas codigo nuevo contra la ruta vieja, da 404.**

**Por que se hizo (spec 0079, decision textual del owner: «una sola ruta de api si hacen lo
mismo»):** dos puertas sobre el mismo writer fue lo que produjo un bypass de seguridad reproducido
—la misma sesion sin email verificado reescribia el programa por una puerta y comia 403 por la
otra—. Contrato completo: **`docs/specs/0079-contratos-de-api.md`**.

### El gate de email **cambio de lugar** (spec 0077)

Antes, la puerta HTTP exigia email verificado para **todo**. Ahora:

| Accion | Sin email verificado |
|---|---|
| **CREAR** el primer programa (durante el alta) | **PERMITIDO** → 201 |
| **EDITAR** un programa existente | **RECHAZADO** → `403 email_not_verified` |

Lo habilita un **permiso de alta** que el servidor escribe en la fila de la sesion. **La UI no lo
maneja ni lo ve: no viaja en ningun request.**

**⚠️ DATO QUE AFECTA A LA UI: el permiso VENCE** — 60 minutos desde que se creo la cuenta, o 5
minutos desde que se completo el alta, lo que pase primero. **Si el usuario deja el wizard a medias
y vuelve mas tarde, va a recibir `403 email_not_verified` al crear.** Ese estado **necesita un
mensaje propio** («verificá tu email para continuar»), no un error generico.

---

## 2. LO QUE HAY DE NUEVO Y TODAVIA NO TIENE PANTALLA

**Esto es lo que hay que construir.** La API existe, esta desplegada y probada; la UI no.

### 2.1 · La ruta unica acepta `kind`: **Sellos Y Puntos**

El dominio soporta las dos modalidades y **la API ya no las niega**. Hoy el wizard manda
`kind: "stamps"` hardcodeado.

| Campo | Sellos | Puntos |
|---|---|---|
| `kind` | **obligatorio** | **obligatorio** |
| `configuration.target` | **obligatorio**, entero 2..50 | no aplica |
| `configuration.unitName`/`unitPlural` | opcional → «sello»/«sellos» | no aplica |
| `configuration.unitSingular`/`unitPlural` | no aplica | **obligatorios** |
| `rewards` | **obligatorio**, exactamente 1 | **obligatorio**, 1..N, cada uno con `pointsCost` > 0 |
| `accrual` | opcional → «un sello por compra» | **OBLIGATORIO** (ver 2.2) |
| `clauses` | opcional → semillas del pais | idem |

**El principio del contrato:** todo lo que el servidor puede completar con seguridad es
**opcional**; lo que no puede —el dinero— es **obligatorio**.

**`cashback` y `tiers` dan 422 a proposito.** No estan habilitadas.

### 2.2 · «Un sello cada $X» — **pedido explicito del owner**

Decision textual del owner (19/09/2026): *«el API en la pantalla 3 puede pasar el valor para que lo
uses en el TOS y ademas queda guardado»*.

```json
{ "kind": "stamps", "configuration": { "target": 10 },
  "rewards": [{ "type": "custom", "label": "Café gratis" }],
  "accrual": { "mode": "per_amount", "grant": 1, "blockAmount": "5.00" } }
```

- **Omitir `accrual`** → «un sello por compra» (lo que hace el wizard hoy). **Sigue siendo valido:
  la pantalla puede no preguntar nada y nada se rompe.**
- `blockAmount`: `numeric(12,2)`, string o numero, **> 0**, maximo `9999999999.99`.
- `grant`: entero **> 0**.
- **La moneda NO viaja en el cuerpo**: sale de `business.currency_code`.
- **Efecto visible:** el texto legal del programa cambia solo, a «Se otorgan 1 sellos por cada 5.00
  USD…». Con `per_purchase` usa el texto de siempre.

**Contrato completo: `docs/specs/0081-contratos-de-api.md`.**

### 2.3 · `GET /api/loyalty-terms/templates` ahora sirve para un panel de TOS

Antes devolvia 6 plantillas con titulos repetidos y **sin forma de distinguirlas**. Ahora:

- Devuelve **`jurisdictionScope`** en cada plantilla (`EC` o `default`).
- Filtra por **el pais del negocio de la sesion**: un comercio EC ve `EC` + `default`; otro pais ve
  solo `default`.
- **Las plantillas viejas `global-draft` ya NO se devuelven**: quedaron archivadas.

El owner pidio **TOS personalizado libre en el panel** (no en el wizard). Una clausula puede ir con
`templateId` **o** con `text` libre.

---

## 3. INVENTARIO MEDIDO — que existe hoy

### 3.1 · Pantallas del merchant

| Ruta | Que es | Estado |
|---|---|---|
| `[locale]/(merchant)/business/onboarding` | **El wizard de 3 pasos** (Cuenta · Negocio · Programa) | **VIVO**, construido por vos |
| `backoffice/*` | `brand`, `catalog`, `counter`, `locations`, `loyalty`, `marketing`, `subscription` | **LEGADO** |
| `backoffice/demo/*` | `analytics`, `brand`, `campaigns`, `locations`, `loyalty` | **LEGADO A BORRAR** |

**ADR 0070 §17, decision del owner: «no dejar rastros viejos de lo que ya no usaremos».** La UI
vieja de lo que se refactoriza **se borra**, y **la limpieza de referencias es parte del borrado**:
un `redirect` de un guard apuntando a una ruta borrada convierte un rebote en un **404**.

### 3.2 · El paso 3 del wizard, HOY

Medido en `_components/onboarding-wizard.tsx`:

- Titulo: **«Creá tu programa de sellos»** — sellos hardcodeado.
- `NumberField` **«Sellos para ganar»** → `configuration.target`.
- `TextField` **«Premio»** → `rewards[0].label`.
- Una calculadora de impacto con **«Costo unitario del premio»** y **«Valor promedio por compra»**
  — **campos de dinero que NO se envian**: son solo para el calculo en pantalla.

**Lo que manda hoy:** `{kind:"stamps", configuration:{target}, rewards:[{type:"custom", label}]}`.

**Lo que NO pregunta:** la modalidad (Sellos/Puntos) y el monto por sello.

### 3.3 · Sistema de diseño

`apps/merchant/src/ui/` con `tokens.css`, y los componentes `ApiError`, `Button`, `TextField`,
`SelectField`, `NumberField`, `Alert`, `ProgressIndicator`, `BrandTheme`. Documentado en
`docs/design-system.md`. **Se reutiliza, no se reemplaza.**

---

## 4. QUE FALTA CONSTRUIR — propuesta de orden

**El owner decide el alcance.** Esto es lo que el gap muestra, ordenado por dependencia:

1. **Paso 3 del wizard: elegir modalidad.** Sellos o Puntos, con los campos que cada una exige
   (tabla 2.1). Hoy Puntos **no tiene ninguna forma de crearse desde la UI**.
2. **Paso 3: el monto por sello** (2.2). Es el pedido explicito del owner y **la API ya lo acepta y
   lo guarda**. Ojo: **la calculadora de impacto ya tiene un campo «Valor promedio por compra» que
   NO se envia** — decidir si el monto nuevo es un campo aparte o si se unifican, **preguntandole
   al owner**: son conceptos distintos (uno es estadistico, el otro es la regla del programa).
3. **Estado «email no verificado»** (1.2): mensaje propio para el `403 email_not_verified` cuando
   vence el permiso de alta.
4. **Panel de TOS** (2.3): elegir plantilla por pais o escribir texto libre. **No va en el
   wizard**, va en el panel — decision del owner.
5. **Borrar `/backoffice/demo/*`** y limpiar sus referencias (3.1).

---

## 5. REGLAS QUE NO CAMBIARON

- **La UI no toca la API.** Se consume por HTTP; nada de `server/db`, Drizzle ni guards internos.
- **Ningun id del cliente** en rutas autenticadas: el negocio se resuelve desde la cookie de sesion.
- **Sesion: `GET /api/merchant/session`**, no `GET /api/auth/get-session`.
- **Los contratos son la frontera.** Ahora son **siete**: 0067, 0069, 0072, 0074, **0078**, **0079**
  y **0081** (`docs/specs/00XX-contratos-de-api.md`).
- **No tocar `apps/consumer`.**

## 6. Que leer, en orden

1. **Este documento.**
2. `docs/specs/0079-contratos-de-api.md` — la ruta unica, su cuerpo y sus 8 `code`.
3. `docs/specs/0081-contratos-de-api.md` — el monto por sello y las variables del TOS.
4. `docs/specs/0078-contratos-de-api.md` — el TOS por pais.
5. `docs/encargo-ui-chatgpt.md` y `docs/ui-architecture.md` — el encargo y las fronteras, vigentes.

**Si algo de este documento no coincide con el arbol, gana el arbol y hay que reportarlo.** En este
arco, **seis defectos seguidos estuvieron en las specs y no en el codigo**.
