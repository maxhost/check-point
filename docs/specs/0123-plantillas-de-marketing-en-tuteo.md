---
spec: 0123
fecha: 2026-10-02
estado: implementada
resumen: Los tres mensajes por defecto de las plantillas de marketing que seguian en voseo pasan a tuteo, como manda `apps/merchant/COPY.md`; texto aprobado por el owner.
disjunta: si
archivos: packages/domain/src/server/marketing/templates.ts, apps/merchant/src/server/marketing/templates-table.test.ts, apps/merchant/src/server/marketing/template-input-welcome.test.ts, apps/merchant/src/server/marketing-templates.neon.integration.test.ts, apps/merchant/src/server/marketing-templates-race.neon.integration.test.ts
---

# 0123 — Plantillas de marketing en tuteo

> Decision del owner (2026-10-02): aprueba el texto de la tabla de abajo, palabra por palabra.

## Problema

- `apps/merchant/COPY.md`: el tuteo «se aplica a las plantillas predeterminadas que el comercio puede
  mostrar a sus clientes». Tres no lo cumplen (`packages/domain/src/server/marketing/templates.ts`):

| Linea | Plantilla | Hoy | Nuevo (aprobado) |
|---|---|---|---|
| 126 | `welcome` | «Sumate hoy y en tu próxima visita te llevás un regalo» | «Únete hoy y en tu próxima visita te llevas un regalo» |
| 203 | `win_back` | «¡Volvé! Te estamos esperando.» | «¡Vuelve! Te estamos esperando.» |
| 254 | `unclaimed_reward` | «Tenés un premio esperándote. ¡Vení a canjearlo!» | «Tienes un premio esperándote. ¡Ven a canjearlo!» |

- Barrido de voseo sobre `templates.ts` (2026-10-02): solo esas tres lineas. Los tres textos nuevos
  miden menos que `maxLength: 60`.

## Alcance

**Entra:** las tres lineas de `templates.ts` y los tests que pinnean esos defaults o siembran ese texto:
`templates-table.test.ts:23,104,156`, `template-input-welcome.test.ts:31`,
`marketing-templates.neon.integration.test.ts:259`, `marketing-templates-race.neon.integration.test.ts:53`
(seed con el mismo texto; se alinea por coherencia).

**No entra:**
- **Campañas ya creadas**: el mensaje se copia a `core.campaign.message` al crearla, y en plantillas no es
  editable (`template_not_editable`). Las existentes conservan el texto viejo. Va al owner como hallazgo.
- Specs historicas que citan el texto viejo (0101, 0101-contratos, 0104): son registro de su fecha.
- Cualquier otro texto de la app.

## Diseño

Reemplazo literal de los tres strings, con los textos de la tabla exactos (acentos y signos incluidos).

## Archivos

| Archivo | Accion |
|---|---|
| `packages/domain/src/server/marketing/templates.ts` | editar (3 lineas) |
| `apps/merchant/src/server/marketing/templates-table.test.ts` | editar (3 literales) |
| `apps/merchant/src/server/marketing/template-input-welcome.test.ts` | editar (1 literal) |
| `apps/merchant/src/server/marketing-templates.neon.integration.test.ts` | editar (1 literal) |
| `apps/merchant/src/server/marketing-templates-race.neon.integration.test.ts` | editar (1 literal) |

**Disjunta?** Si.

## Definition of Done

- [x] `rg -n 'Sumate hoy y en tu|¡Volvé! Te estamos|Tenés un premio esperándote. ¡Vení' apps packages -g '!**/.next/**'` → vacio.
      *(Corregido por el orquestador al cerrar: el patron original `Tenés un premio esperándote` era mas ancho que
      el default y matcheaba el seed propio de `marketing-balance-push.neon.integration.test.ts:130,160`, que no
      pinnea la plantilla. Ese seed queda en voseo: es dato de test, fuera de alcance.)*
- [x] `rg -nF` de cada texto nuevo encuentra `templates.ts` y sus tests.
- [x] `tools/neon-test.sh` sobre `marketing-templates` y `marketing-templates-race`, de a una → verdes. Nunca contra `DATABASE_URL`.
- [x] Gates de root con Node 24, una vez al final: `typecheck`, `lint`, `test`, `format:check`, `build`.
- [x] `rg -n MUTATION apps tools packages` → vacio.

## Mutaciones — presupuesto: 1. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `templates.ts:203` vuelve a «¡Volvé! Te estamos esperando.» | `templates-table.test.ts` (el `toEqual` de `TEMPLATES`, con el `default` de `win_back` en el diff). A medir |

**Protocolo:** `shasum` limpio → fila de bitacora antes de medir → etiqueta `MUTATION` → medir y
transcribir → revertir con `diff` contra copia limpia. Leer la asercion del rojo.

## Declarado AFUERA

- Las campañas existentes con el texto viejo (ver «No entra»).

## Handoff

UN implementador; revision liviana del orquestador (reemplazo literal aprobado).

## Abierto

Nada.
