---
adr: 0104
fecha: 2026-09-29
estado: aceptada
resumen: «Mis beneficios» = TODOS los cupones propios sin filtrar + las OFERTAS CRUZADAS; la oferta cruzada es una plantilla de campaña que activa el comercio (premio, cupo mensual, vigencia y publico: no clientes / dormidos / cualquiera), su cupon NO exige estar enrolado, y el filtro de rubro distinto + 2 km se aplica SOLO a ella (corrige el ADR 0103 §4). Quien entra por la cruzada no recibe ademas la Bienvenida.
---

# 0104 — La oferta cruzada es una campaña, y el filtro de rubro es solo suyo

## Contexto

El ADR 0103 §4 escribio el filtro de «Mis beneficios» (rubro distinto, ≤ 2 km, GPS o ultimo escaneo) como si
aplicara a todo lo que se ve, incluidos los comercios donde el cliente ya es miembro («Todo filtrado»). Al pedir
las decisiones de la spec de «Mis beneficios», el owner acoto el alcance y definio que es un beneficio cruzado.

**Owner (2026-09-29, AskUserQuestion, textual):**
- «la idea del cruzado es que sea una campaña que active el merchant como la de bienvenida por ejemplo, entonces
  en esta campaña elije el premio o cupon, o lo que sea y es lo que aparece tambien en mis beneficios».
- «esto y la pregunta de referencia que me hiciste solo es para un unico caso, cuando hay ofertas cruzadas, nada
  mas. no es para todo. Si yo estoy en el cafe A, y veo un beneficio de un comercio cruzado no vere de
  cafeterias, vere el del gym por ejemplo. pero si estoy en cafe a, y no hay ningun cupon o nada en mis
  beneficios de otro coercio cruzado, puedo ver los cupones de todos mis beneficios […] la idea no es que si
  estas pasando frente a la cafeteria A, de repente entras a tu checkpass y ves ofertas de la cafeteria b que
  esta a una cuadra, porque esto le puede quitar clientes a un comercio».
- Referencia del rubro con GPS: **«Ambos»** — el rubro del ultimo comercio escaneado Y el del local donde esta
  parado.
- Sin GPS y sin un escaneo en un local con coordenadas: **«Solo sus comercios»** (ninguna oferta cruzada).
- «ese cupon no requiere que el cliente este enrolado en el programa del gym, porque lo que buscamos con este
  cross es justamente que vaya y lo descubra, es un tipo especifico de campaña, entonces no confundas con las
  otras campañas que un comercio emite para sus clientes enrolados».
- Publico: «lo define en la campaña el merchant. puede ser solo a no clientes, a dormidos, o a cualquiera».
- Si entra por la cruzada y el comercio tiene Bienvenida activa: **«Solo el cruzado»**.

## Decision

1. **«Mis beneficios» tiene dos partes.** (a) Los cupones propios del cliente, **todos, sin filtro de rubro ni de
   distancia** (la UI los agrupa como quiera: todos / por programa). (b) Las **ofertas cruzadas**, filtradas.
   **Corrige el ADR 0103 §4:** el filtro de rubro y 2 km NO se aplica a los cupones propios.
2. **La oferta cruzada es una plantilla de campaña** (`template_key = 'cross'`), activada por el comercio como la
   Bienvenida: elige el premio (los mismos tipos que cualquier cupon, ADR 0098), un **cupo mensual**, la
   **vigencia** del cupon y el **publico**: `non_members` (nunca se sumaron), `dormant` (miembros sin actividad
   hace `dormantDays`) o `any`. No sale por proximidad ni por push: su unico canal es «Mis beneficios».
3. **El cupon cruzado no exige estar enrolado.** Se emite a la cuenta del cliente sin membresia; el mostrador ya
   enrola solo al escanear (ADR 0033, `counter/resolve.ts:132`), asi que al canjearlo la membresia existe.
4. **Filtro de la oferta cruzada del comercio X:** X tiene un `category_gcid` distinto al del **ultimo comercio
   escaneado** y, si el telefono da el GPS, distinto tambien al del **local donde esta parado**; y algun local
   activo de X queda a **≤ 2 km** del GPS, o —sin GPS— del ultimo local escaneado. Sin ninguna de las dos
   ubicaciones: no se muestra ninguna oferta cruzada.
5. **Una sola bienvenida por cliente nuevo:** quien tiene un cupon cruzado de X no recibe la Bienvenida de X.

## Consecuencias

- `core.campaign_coupon.membership_id` deja de ser `NOT NULL` para el cupon cruzado (migracion).
- La spec 0112 implementa esto. Horas valle (ADR 0103 §5) sigue siendo su propia spec; si usa el mismo filtro,
  lo reutiliza.
- El arbitro del orden (ADR 0103 §6) todavia no existe: las ofertas cruzadas salen por cercania.
