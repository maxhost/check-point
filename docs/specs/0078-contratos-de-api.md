---
spec: 0078
fecha: 2026-09-18
estado: anexo
resumen: Contrato normativo de los TERMINOS del programa despues de la spec 0078 — como se ELIGEN (por `business.countryCode`, con caida al scope `default` y por scope COMPLETO, nunca mezclando clausulas de dos scopes), las 5 variables que interpola el renderizador con su allowlist por plantilla, la forma de una clausula (`templateId` **o** `text`) y el limite medido de que el TEXTO LIBRE no admite ninguna `{{variable}}`. Es el insumo de quien construye la UI del panel: el arco entrega API, no pantallas.
---

# 0078 — Contrato de API: los términos del programa

> **Este documento es un entregable, no documentacion opcional** (ADR 0070 §16). El arco
> del alta entrega API y endpoints, **no interfaz**: la UI del panel la construye el owner
> por fuera y este archivo es su insumo. La spec 0078 **no toca un solo `.tsx`**.
>
> Todo lo que dice esta **medido contra el codigo y contra la rama Neon de integracion el
> 2026-09-18**, no inferido. Donde un comportamiento sea un limite de hoy y no una
> decision, se dice.

## Convenciones

Las mismas de `0072-contratos-de-api.md` y `0074-contratos-de-api.md`: base
`https://www.checkpass.club` (el apex hace **308**), `content-type: application/json`,
cookie de sesion de better-auth, **ningun identificador de negocio viaja en el cuerpo**
(ADR 0070 §15.3), y todo fallo responde `{ "error": "<español>", "code": "<estable>" }`
donde **el `code` es el contrato** y el `error` es copia.

---

## 1. Como se ELIGE el TOS: el scope por pais

Las plantillas viven en `core.terms_template`, agrupadas por `jurisdiction_scope`. El
wizard (`POST /api/onboarding/program`) resuelve **dos** claves: `earning` y `redemption`,
en ese orden, y ese orden es el del markdown final.

**El scope sale de `business.countryCode`, que se resuelve de la SESION** — nunca de un
campo del cuerpo. El orden de preferencia es:

| `business.countryCode` | Candidatos, en orden |
|---|---|
| `EC` (o `ec`, con espacios) | `["EC", "default"]` |
| `MX`, `ES`, cualquier ISO-2 sin semillas propias | `["MX", "default"]` → resuelve `default` |
| `null`, `""`, `"ECU"`, `"E"` (no son 2 letras) | `["default"]` |

**LA CAIDA ES POR SCOPE COMPLETO, NO POR CLAVE.** Si a `EC` le faltara `redemption`, el
resultado son **las dos** de `default`, nunca `earning` de EC + `redemption` de `default`:
un TOS mezclado es un documento legal que nadie escribio. Es la propiedad central de la
spec y esta pinneada con una mutacion (M2).

Scopes sembrados hoy (`drizzle/0038_terms_por_pais.sql`, verificado por SQL):

| `jurisdiction_scope` | `locale` | claves | `status` | ids |
|---|---|---|---|---|
| `default` | `es` | `earning`, `redemption` | `published` | `0078a1b2-…-000000000001` / `…002` |
| `EC` | `es` | `earning`, `redemption` | `published` | `0078ec00-…-000000000001` / `…002` |
| `global-draft` | `es` | `earning`, `redemption` | `published` | `9d4a3a05-…cf101` / `…cf102` |
| `global-draft` | `es` | `transition` | `archived` (migracion `0011`) | `9d4a3a05-…cf103` |

**`global-draft` ya no lo elige nadie, y NO se borra ni se archiva a proposito:** sigue
`published` para que cualquier programa que todavia lo referencie por `templateId` siga
renderizando.

**Si ningun candidato tiene las dos claves publicadas**, la ruta del wizard responde
**503** `{"code":"program_unavailable"}` con el mensaje «Las plantillas de términos no
están disponibles.» y **no escribe ningun programa**: la lectura de plantillas ocurre
antes de `saveProgram`. Con las semillas de la `0038` aplicadas, ese 503 solo es
alcanzable en una base sin semillas.

**Agregar un pais nuevo es una MIGRACION de semillas**, no configuracion: no existe —ni se
pidio— un ABM de plantillas para el operador de la plataforma.

## 2. Las 5 variables y su allowlist

`renderedTerms` (`server/loyalty-program/terms.ts`) interpola `{{variable}}` sobre el
markdown de cada clausula. El mapa completo:

| Variable | Valor | Nota |
|---|---|---|
| `business_legal_name` | `business.name` | |
| `program_name` | Puntos: `configuration.unitPlural` · Sellos: `configuration.unitName` (**singular**) | **se conserva tal cual**: es la que usan las plantillas de `global-draft` |
| `program_unit_plural` | Puntos: `configuration.unitPlural` · Sellos: `configuration.unitPlural ?? configuration.unitName` | **nueva en la 0078** — es lo que arregla el «Los sello se acumulan…» |
| `program_kind` | `"points"` \| `"stamps"` | |
| `country_code` | `business.countryCode` | ya se pasaba; **lo nuevo es que el allowlist lo permita** |

**El allowlist es POR PLANTILLA** (`terms_template.variables_allowlist`), no global. Una
variable usada en el texto pero ausente del allowlist de **esa** plantilla tira **422**
(`validation.ts:246-248`), y lo mismo si el valor viene vacio. Las cuatro semillas de la
`0038` declaran las cuatro:
`["business_legal_name", "program_name", "program_unit_plural", "country_code"]`. Las dos
de `global-draft` conservan su par historico (`business_legal_name`, `program_name`).

**El plural de Sellos es OPCIONAL en el API** (`configuration.unitPlural`, string no
vacio; para Puntos sigue siendo **obligatorio**). El wizard manda
`{ unitName: "sello", unitPlural: "sellos", target }`. Si no viene, el renderizado cae al
singular en vez de fallar — que es lo que hace que los programas viejos sigan andando.

## 3. La forma de una clausula: `templateId` **o** `text`

En el cuerpo de `PUT /api/loyalty-program`, `clauses` es una lista de **1 a 12** objetos y
cada uno lleva `templateId` **o** `text` (los dos vacios → 422 «Cada cláusula debe tener
texto o plantilla.»; lista vacia → 422 «Añade al menos una cláusula de términos.»):

```jsonc
{
  "clauses": [
    { "templateId": "0078ec00-0000-4000-8000-000000000001" },
    { "text": "Cláusula propia del comercio, ya redactada." }
  ]
}
```

Asi se guarda un **TOS personalizado**: mandando `text` en cada clausula. No hace falta
codigo nuevo de escritura — ya se acepta hoy.

### El limite que quien haga la UI tiene que saber

**UNA CLAUSULA DE TEXTO LIBRE NO ADMITE NINGUNA `{{variable}}`.** El renderizador usa el
allowlist **de la plantilla de esa clausula**, y una clausula sin `templateId` no tiene
plantilla: su allowlist es **vacia**, asi que cualquier `{{loquesea}}` —incluida
`{{business_legal_name}}`— responde **422** «La variable {{x}} no está permitida.».

Es el comportamiento de **hoy** y la spec 0078 **no lo cambia**; se declara aca porque el
editor del panel tiene que impedir que el comerciante escriba llaves dobles, o mostrar ese
422 como un error de formulario legible.

*(Detalle del mecanismo, por si alguien lo apoya en el futuro: si una clausula manda
`templateId` **y** `text`, el `text` gana y se renderiza con el allowlist **de esa
plantilla**. No es un camino que ninguna pantalla use hoy y no es contrato: es lo que hace
el codigo.)*

### Dos consecuencias de negocio, declaradas por el owner (ADR 0076 §7)

1. **Un TOS personalizado deja de heredar** las actualizaciones futuras del TOS de su pais:
   un cambio legal no alcanza a los que editaron.
2. **Se guarda ya renderizado** (`loyalty_program.terms_markdown`), asi que si el comercio
   se renombra, su TOS conserva el nombre viejo. Los que usan plantilla se re-renderizan al
   guardar; los personalizados no.

## 4. Lo que NO cambia, y un hallazgo abierto

- `POST /api/onboarding/program` conserva su cuerpo de dos campos
  (`{ target, reward }`) y sus `code`: `invalid_body`, `invalid_program`, `not_owner`,
  `program_exists`, `program_unavailable`, `email_not_verified`, `business_suspended`,
  `business_closed`. **El pais NO es un campo del cuerpo** y no puede serlo: se resuelve con `ownerBusiness`
  desde la sesion. Pinneado por un caso Neon —negocio **MX** que manda `countryCode: "EC"`
  en el cuerpo y recibe igual los `templateId` de `default`— porque hasta la revision de la
  0078 esto era una **convencion sin oraculo**: haciendo ganar al cuerpo, los 65 tests
  quedaban verdes.
- Los programas **ya creados no se re-renderizan**: `terms_markdown` guarda el texto final.
- **HALLAZGO ABIERTO (no lo resuelve esta spec): `GET /api/loyalty-terms/templates`
  devuelve TODAS las plantillas `published` sin filtrar por scope** (`route.ts:26-27`),
  asi que desde la `0038` lista **6** filas —`global-draft`, `default` y `EC`— con titulos
  repetidos («Cómo se acumula» ×3). Si la pantalla «avanzada» del panel usa esa lista para
  ofrecer plantillas, va a mostrar tres copias de cada una. Filtrarla por el scope del
  negocio es un cambio de una linea, pero **es una decision de producto que el owner no
  tomo** y la ruta no esta en el alcance de la 0078.
