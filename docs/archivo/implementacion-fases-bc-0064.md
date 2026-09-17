> ## ⚠️ BITACORA CERRADA (2026-09-15) — NO ES TRABAJO PENDIENTE
>
> Documento de TRABAJO de las fases B y C de la spec 0064, conservado como evidencia. **El arco esta
> cerrado:** spec `implementada`, commit `ca2d746` en prod y **QA del owner en verde**.
>
> **Los checkboxes sin marcar de «Estado» quedaron asi porque el implementador se corto a mitad; el
> trabajo SI se completo** — lo termino el orquestador a mano. La evidencia final (gates, tamaños al
> hook, el hook probado que muerde y que discrimina) esta en la **spec 0064**, seccion «Cierre».

# Implementación fases B (UI) y C (hook) — spec 0064

> Bitácora del implementador. **Las filas de mutación se abren ANTES de mutar** (`CLAUDE.md`:
> tres agentes murieron a mitad en esta spec y lo único que salvó el árbol fue el hash escrito
> de antemano).

## Condición de corte (del encargo del orquestador)

El owner cortó el ciclo de verificación de esta spec: **el oráculo que define es el QA humano
sobre la pantalla**, no la suite. Presupuesto: **máximo 6 mutaciones**, y sólo sobre decisiones
que el owner **no vería** con los ojos en el QA (una fuga de dato interno al navegador). Lo que
se ve —un texto, una fecha, un botón— **no se muta: se deja para el QA**. Las dos pruebas del
hook (que muerde / que discrimina) **no cuentan** contra ese presupuesto.

## Bitácora de mutaciones

| id | archivo | shasum limpio | tracked | invariante que ataca | resultado |
|----|---------|---------------|---------|----------------------|-----------|
| C1 | `apps/merchant/.next/types/validator.ts` | `72d7a2ae2c7a7f5a12ce1b08e9e34483f294902b` | **gitignoreado** (artefacto de build) | «el fantasma del validator es real y `verify.sh` lo mata ANTES de los gates» | **CONFIRMADO**, ver abajo |
| M1 | `apps/merchant/src/server/billing/facts.ts` | `5d43b27e0727687b61d198e74ec251b71c830147` | **`??` UNTRACKED** → `git checkout` NO EXISTE; copia limpia en `/tmp/0064-facts-clean.ts` | «una llave interna de Stripe NO cruza al navegador» — el `it` nuevo de `billing-pages-props.neon.integration.test.ts`. Se mete el `stripeCustomerId` dentro de `receiptUrl`, que es TYPE-LEGAL (los dos son `string`), o sea la fuga que el typecheck NO caza | **ROJO 1/3** — ver abajo. REVERTIDA (`shasum` = baseline, `diff` = solo la mutación) |

### M1 — resultado, transcrito de la corrida (no predicho)

`vitest run src/server/billing-pages-props.neon.integration.test.ts` → **1 failed | 2 passed**.

- **Rojo**: `con los datos del cobro poblados, el customer id y el subscription id SIGUEN sin
  cruzar`, y la aserción NOMBRA la fuga:
  `+ "receiptUrl": "https://stripe.test/recibo?cliente=cus_facts_03409f98"`.
  Es un `cus_` REAL cruzando al navegador, no un fallo de setup.
- **Verdes los otros dos** `it` (`…el DTO, NO la fila` y `…estado BLOQUEADO`): **no siembran
  facts**, así que no recorren esta rama. Eso es la ATRIBUCIÓN, que es lo que una tabla de
  mutaciones tiene que dejar escrito: el `it` nuevo no es redundante — es el ÚNICO que cubre
  la rama que lee Stripe, y sin él esta fuga pasaba con la suite entera en verde.
- **Precisión honesta sobre el guard por substring** de ese mismo `it`: NO llegó a ejecutarse,
  porque el `toEqual` exacto falla antes y corta. Confirma lo que dice su comentario — el
  trabajo lo hace el valor exacto y el substring es sólo un mensaje de error. No se le atribuye
  cobertura.

### C1 — resultado, transcrito de la corrida (no predicho)

1. Sembrado el bloque de `resume` en el validator real (`shasum` pasa a `120ddf79…`).
2. `pnpm --filter @mi-pasaporte/merchant exec tsc --noEmit` → **EXIT=1**:
   `.next/types/validator.ts(740,39): error TS2307: Cannot find module '../../src/app/api/billing/resume/route.js'`.
   **El fantasma es real y es exactamente el que describe la spec §4.b.**
3. `bash .claude/hooks/verify.sh` → **EXIT=0**, con el hook disparando PRIMERO y escribiendo
   por stderr `stale-validator: BORRE apps/…/validator.ts` + la ruta culpable.
4. `tsc --noEmit` directo despues → **EXIT=0**. Validator ausente; lo regenera el proximo build.

**HALLAZGO QUE NO ESTABA EN LA SPEC, y que refuerza por que el hook tiene que ARREGLAR y no
solo avisar: el gate de ROOT no ve el fantasma.** `pnpm run typecheck` pasa por turbo y con el
bloque sembrado dio **EXIT=0 / `FULL TURBO` / 28ms** — cache hit, porque `.next/` no entra en el
hash de inputs de turbo. O sea que el fantasma NO rompe el gate de root de forma fiable, pero SI
rompe el `tsc` directo, el `next build` y el IDE del owner — que es donde alguien lo persigue a
mano. Es justo lo que la spec dice («el rojo aparece en el unico lugar donde alguien lo va a
perseguir»), con el agravante medido de que la suite puede estar verde al mismo tiempo.

**C1 no es una mutacion de codigo fuente: es SEMBRAR el fantasma** en un archivo GENERADO y
gitignoreado, para probar end-to-end la fase C. No lleva etiqueta `MUTATION` porque el hook
`no-mutations-left.sh` solo barre `*.ts`/`*.tsx` bajo `apps/*/src` — este archivo vive en
`.next/`. Punto de retorno: **el propio hook lo borra**, y el proximo `next build`/`dev` lo
regenera desde el arbol de archivos, ya sin el bloque sembrado. No hay nada que restaurar a
mano y nada puede sobrevivir al turno.

## Estado

- [x] **Fase B — UI.** Dividida ANTES de agregar: salieron `upgrade-card.tsx` (79),
      `interval-dialog.tsx` (44) y `subscription-format.ts` (76); `subscription-console.tsx`
      quedó en 294. Los cinco ítems del DoD están en pantalla (etiqueta de intervalo, fecha de
      renovación, importe + recibo, modal de confirmación del intervalo, aviso de la baja).
- [x] **Fase C — hook `stale-validator.sh`**, con las dos pruebas (muerde / discrimina) y una
      corrida end-to-end. Se invoca desde la PRIMERA línea útil de `verify.sh`.
- [x] **Higiene de tamaños**: `billing-pages.neon.integration.test.ts` 302 → 215 (el oráculo de
      props se mudó a `billing-pages-props.neon.integration.test.ts`),
      `billing-offers.test.ts` 299 → 156 (el modal se mudó a `billing-cancel-dialog.test.ts`),
      `billing-click-probe.test.ts` 294. **Quedan 4 archivos de `server/` en 301-302** — ver la
      sección de abajo.
