---
spec: 0055
fecha: 2026-09-08
estado: anexo
resumen: Los dos contratos que la seccion «Archivos compartidos» de la spec 0055 asigna al orquestador antes de despachar — la forma canonica del DTO de premio (compartido por resolve, el wizard y el wallet) y la firma + tabla de casos de `planRedemption`. Es normativo para el implementador y es el oraculo del revisor.
---

# 0055 — Anexo del orquestador: contratos fijados antes de despachar

> La spec 0055 §«Archivos compartidos» exige que el orquestador fije **dos** contratos
> antes de entregar el encargo. Van acá, en disco, para que sobrevivan a la sesión.
> No cambian ninguna decisión de la spec: la aterrizan sobre el código real.

## 1. DTO de premio (`RewardDTO`) — compartido por `resolve`, el wizard y el wallet

**Hoy ya existe medio contrato y le falta el `id`.** `loyalty-program/client-view.ts`
define `toRewardDTO` (usado por el wizard vía `toClientProgram`) y **no serializa el
`id`** — porque el wizard reescribe todos los premios en cada guardado y nunca lo
necesitó. El canje **sí** lo necesita: el body de `/api/counter/redeem` manda `rewardId`.

**Decisión: una sola función, `toRewardDTO`, extendida con `id`. No se crea un segundo
DTO de premio.** Un segundo DTO es exactamente el mecanismo que produjo la fuga de
`*ObjectKey` que el revisor cazó en marca (spec 0025) y las listas MIME duplicadas de la
0033/0039/0040: dos lugares que deciden lo mismo divergen.

Forma canónica:

```ts
export type RewardDTO = {
  id: string;                 // core.loyalty_reward.id — NUEVO
  type: "catalog_product" | "custom" | "discount";
  label: string;
  productId: string | null;
  discountPercent: number | null;
  pointsCost: number | null;
  position: number;
  imagePath: string | null;   // ruta pública; NUNCA `imageObjectKey`
};
```

Reglas:

- `loadProgramRewards` (`loyalty-program/persistence.ts`) suma `id: loyaltyRewards.id` al
  `select`; `RewardRow` suma `id: string`. Es aditivo: el wizard recibe un campo más.
- **`imageObjectKey` no sale nunca del server.** La regla de `CLAUDE.md` («una ruta que
  devuelve una entidad al navegador nunca serializa claves internas de R2») se blinda con
  **un test por superficie nueva**: `resolve` y el summary del wallet. No alcanza con el
  test viejo del wizard.
- Los tres consumidores usan **la misma** función:
  - `counter/resolve.ts` → `rewards: RewardDTO[]` ordenados por `position`.
  - `consumer/programs.ts` → `ConsumerProgramSummary.rewards: RewardDTO[]`.
  - wizard (`toClientProgram`) → sin cambios de forma más allá del `id`.
- Orden: **siempre `position` ascendente**, en las tres. El orden es parte del contrato:
  es el que el owner configuró en el paso 4.

## 2. `planRedemption` — firma exacta y tabla de casos

Archivo: `src/server/counter/redeem-plan.ts`. **Puro, sin DB, sin imports del server.**

```ts
export type RedeemPlanInput = {
  kind: "points" | "stamps";
  /** El saldo BLOQUEADO (points_balance o stamps_count), leído con FOR UPDATE. */
  balance: number;
  /** `configuration.target` CRUDO del programa (jsonb). Sólo se mira en Sellos. */
  target: unknown;
  /** Sólo se mira `pointsCost` en Puntos. */
  reward: { pointsCost: number | null };
  allowInsufficient: boolean;
};

export type RedeemPlan =
  | { unitsToDebit: number; balanceAfter: number; override: boolean }
  | { error: "invalid_reward" | "invalid_program" | "insufficient_balance" };

export function planRedemption(input: RedeemPlanInput): RedeemPlan;
```

**Orden de evaluación (normativo — cambiarlo cambia qué error ve el operador):**

1. `balance` entero `>= 0`, si no → `invalid_program`. *(Defensivo: la DB tiene el check
   `>= 0`, así que es inalcanzable por el camino real. Se declara en vez de omitirse.)*
2. **Costo requerido**, por `kind`:
   - `points` → `required = reward.pointsCost`. Entero `>= 1`, si no → **`invalid_reward`**.
     (`pointsCost` es nullable en la DB y su check sólo dice `IS NULL OR > 0`.)
   - `stamps` → `required = Number(target)`. Entero `>= 1`, si no → **`invalid_program`**.
     `null` / `""` / `false` / `{}` / `NaN` / `0` / `1.5` / negativos son todos error.
     `Number(null) === 0` es la trampa exacta que documenta la spec.
3. `balance >= required` → `{ unitsToDebit: required, balanceAfter: balance - required, override: false }`.
4. `balance < required` y `allowInsufficient === false` → **`insufficient_balance`**.
5. `balance < required` y `allowInsufficient === true` →
   `{ unitsToDebit: balance, balanceAfter: 0, override: true }`.

**`unitsToDebit` y `balanceAfter` son lo que se ESCRIBE.** No hay aritmética paralela en
SQL: el `UPDATE` hace `SET <col> = plan.balanceAfter`, nunca `saldo - costo` ni `GREATEST`.

### Tabla de casos — es el oráculo del unit, se transcribe tal cual

| # | kind | balance | target | pointsCost | allow | → resultado |
|---|---|---|---|---|---|---|
| 1 | points | 100 | — | 30 | false | debit 30, after 70, override false |
| 2 | points | 30 | — | 30 | false | debit 30, after 0, override false (saldo justo) |
| 3 | points | 29 | — | 30 | false | `insufficient_balance` |
| 4 | points | 80 | — | 100 | **true** | debit 80, after 0, **override true** (ejemplo del owner §9) |
| 5 | points | 0 | — | 100 | **true** | debit 0, after 0, **override true** (cortesía, §9) |
| 6 | points | 100 | — | **null** | false | **`invalid_reward`** |
| 7 | points | 100 | — | **null** | **true** | **`invalid_reward`** (la dispensa NO tapa un premio roto) |
| 8 | points | 100 | — | 0 | false | `invalid_reward` |
| 9 | points | 100 | — | -5 | false | `invalid_reward` |
| 10 | points | 100 | — | 2.5 | false | `invalid_reward` |
| 11 | stamps | 12 | 10 | null | false | debit 10, after **2**, override false (**arrastre**, §3) |
| 12 | stamps | 10 | 10 | null | false | debit 10, after 0, override false |
| 13 | stamps | 9 | 10 | null | false | `insufficient_balance` |
| 14 | stamps | 9 | 10 | null | **true** | debit 9, after 0, **override true** (ejemplo del owner §9) |
| 15 | stamps | 5 | **null** | null | false | **`invalid_program`** |
| 16 | stamps | 5 | **null** | null | **true** | **`invalid_program`** (la dispensa NO tapa un programa roto) |
| 17 | stamps | 5 | **0** | null | false | `invalid_program` (**el canje gratis ilimitado**) |
| 18 | stamps | 5 | `""` | null | false | `invalid_program` |
| 19 | stamps | 5 | `false` | null | false | `invalid_program` |
| 20 | stamps | 12 | `"10"` | null | false | debit 10, after 2, override false — el **string numérico se acepta** como target (`Number("10") === 10`, igual que `programs.ts:81`); el jsonb puede traerlo así |
| 21 | stamps | 5 | 2.5 | null | false | `invalid_program` |
| 22 | stamps | 5 | -3 | null | false | `invalid_program` |
| 23 | stamps | 0 | 10 | null | **true** | debit 0, after 0, override true |
| 24 | points | 100 | — | 30 | **true** | debit 30, after 70, override **false** (la dispensa no se activa si alcanza) |

**El caso 24 es el que impide la trampa fácil**: `override` no es «el programa permite» —
es «esta operación **usó** la dispensa». Es el campo que el owner va a auditar.

**Lo que extraer NO cubre, declarado (lección de la tarea 38):** que el llamador invoque
`planRedemption` con el saldo **bloqueado** y con el premio **que el operador eligió**.
Eso no lo pinnea ningún unit ni ningún barrido: lo cubre la integración Neon
(`insufficient_override` bajo concurrencia + canje ‖ acreditación). Se declara acá en vez
de taparse con un regex.

## 3. Numeración fijada

- Migración: **`0028_*.sql`** (la última aplicada es `0027_good_drax`).
- ADR: la spec nombra `docs/adr/0053-*.md`, que **ya existe y ya está aceptado**
  (canje de premios). **El implementador no escribe ADRs nuevos**: si aparece una decisión
  de diseño no prevista, es un bloqueo que sube al orquestador (regla de `CLAUDE.md`: lo
  que el owner no dijo no se escribe como decisión suya).
