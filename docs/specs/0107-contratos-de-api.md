# 0107 — Contrato de API: plantilla «Bienvenida»

> Contrato para quien hace la UI (GPT). Implementa la spec 0107 / ADR 0099. Rutas relativas a
> `apps/merchant/src/`. Convenciones y errores: los de `0101-contratos-de-api.md`; el premio, el de
> `0106-contratos-de-api.md` («`Reward` — forma comun»). **El `code` es el contrato; el `error` es
> copia.** Estado de cada entrega: `docs/INDEX.md`.

## E1 — La plantilla en marketing

**`GET /api/marketing/templates`**: `welcome` va PRIMERA. Su definicion trae:

| Campo | Valor |
|---|---|
| `key` / `title` | `"welcome"` / `"Bienvenida"` |
| `channels` | `[]` — no sale por proximidad ni push: se entrega al instalar el pase |
| `dormantDays` | `null` (el resto de las plantillas lo sigue trayendo) |
| `couponRequired` | `true` (campo nuevo en todas; `false` en el resto) |
| `message.default` | titular de la oferta en la pagina de alta (≤ 60) |
| `welcome` | `{ validDays: {options:[7,15,30], default:15}, reminderDays: {options:[1,3,7], default:3}, monthlyCap: {min:1, max:10000, default:50}, redeemFrom: {options:["next_day","same_visit"], default:"next_day"} }` — `null` en el resto |

**`POST /api/marketing/templates/welcome/enable`** — cuerpo:

| Campo | Regla |
|---|---|
| premio (`couponKind`, `couponLabel`, `couponCost`, …) | **obligatorio**; SIN `couponMaxRedemptions` |
| `message` | opcional (def. el de la plantilla) |
| `welcomeValidDays` | 7 \| 15 \| 30, def. 15 |
| `welcomeReminderDays` | 1 \| 3 \| 7, def. 3; **menor** que `welcomeValidDays` |
| `welcomeMonthlyCap` | entero 1..10000, def. 50 — por negocio, mes calendario de su zona |
| `welcomeRedeemFrom` | `"next_day"` (def.: vale desde el dia siguiente) \| `"same_visit"` |
| `startsAt` / `endsAt` | opcionales; `endsAt` **no** es obligatorio aunque haya premio |

Errores nuevos, `400 validation` con `fields`: `couponLabel` (sin premio), `couponMaxRedemptions`
(presente), `channels` / `dormantDays` / `excludedLocationIds` (presentes), `welcomeValidDays`,
`welcomeReminderDays` (fuera de opciones o ≥ vigencia), `welcomeMonthlyCap`, `welcomeRedeemFrom`.
Cualquier `welcome*` en OTRA plantilla → 400 con ese campo. `disable` sin cambios: los regalos ya
entregados siguen valiendo hasta su vencimiento.

**DTO `Campaign`** (0101 §2): suma `welcome: { validDays, reminderDays, monthlyCap, redeemFrom } |
null`. Una bienvenida trae `channels: []`.

## E5 — Pagina de alta: `getEnrollLanding(programId)`

La pagina `/enroll/[programId]` es un server component: lee `getEnrollLanding`
(`server/consumer/enrollment.ts`, sin ruta HTTP). Suma:

```ts
welcomeOffer: {
  message: string;         // titular editable del comercio
  label: string;           // el premio visible («Un café gratis»)
  kind: CouponKind;
  rule: string | null;     // condiciones
  validDays: 7 | 15 | 30;
  redeemFrom: "next_day" | "same_visit";
} | null
```

`null` = no mostrar nada (sin bienvenida activa, plan sin marketing o tope del mes alcanzado). La
oferta **solo** se anuncia aca (owner). Copia sugerida del detalle: «Instalá tu pase y en tu próxima
visita te llevás {label}. Vence a los {validDays} días.» (con `same_visit`: «…y hoy mismo te llevás…»).
El regalo se entrega **al instalar el pase** en Apple/Google Wallet: sin pase instalado no hay regalo.

## E5 — Cupones del cliente: `GET /api/public/consumer/coupons`

El `ConsumerCoupon` (0106 §E3) suma `validFrom` (ISO) y el estado **`scheduled`**: el regalo existe
pero todavia no vale (con `next_day`, hasta mañana). Precedencia: `redeemed` → `expired` →
`unavailable` → `scheduled` → `valid`. El grupo vigente se ordena `valid`, `scheduled`,
`unavailable`. Copia sugerida: «Válido desde {validFrom, fecha local}». El mostrador NO lo muestra
hasta `validFrom`.

## Sin contrato de UI

El callback de Google (`POST /api/public/wallet/google/callback`) y el push de aviso de vencimiento
(«Tu regalo de bienvenida vence en N días») no tienen pantalla.
