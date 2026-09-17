# Encargo — spec 0063, RE-REVISION ACOTADA de la sesion B-ter

**Rol: REVISOR INDEPENDIENTE** (`docs/AGENT-WORKFLOW.md`). `PASS` o `FAIL` con evidencia.
**Solo el DELTA de la B-ter**, que cierra el FAIL de la re-revision anterior.

Lo escribio el ORQUESTADOR, que es el mismo turno que escribio el delta. Por eso existis.

## Contexto

El arbol **NO esta commiteado** y el owner ató el commit al PASS. **Tu veredicto lo desbloquea.**

**Llevamos DOS rondas en que el orquestador corrige y un revisor demuestra que la correccion abrio
el mismo agujero un escalon mas abajo.** Las bitacoras previas: `/tmp/revision-sesion-b.md`
(FAIL, 1+5), `/tmp/revision-b-bis.md` (FAIL, 1+4), y la mia `/tmp/sesion-b-ter.md`. **Insumo, no
oraculo.**

## Estado del arbol (medido, 2026-09-12)

- `grep -rn MUTATION apps/merchant/src` → **vacio**. `find apps -name 'zz-*'` → **vacio**. Disco 38 GB.
- Node **v24.20.0** tras `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use`.
- **5 gates ya corridos (re-corrélos):** `test` con integracion **127 archivos / 921 tests / 0
  failed / 0 skipped** · `typecheck --force` 3/3 `0 cached` · `lint` · `format:check` ·
  `build --force` 3/3 `0 cached`.
- **BASELINE** (copias limpias en `/tmp/b-ter-clean/`):

  ```
  a9381ca449be4845c6e6daff5115084c8ea0b3dc  app/backoffice/subscription/page.tsx            (??)
  2add27d40e400b21f168e7e86a907805ccddda36  app/components/confirm-dialog.tsx               ( M)
  50f304c8395b0933bfb48861a750f42cc3f38b91  app/components/confirm-dialog-focus.test.ts     (??)
  11bf7648f11187594d4edeacf85506a662bf3d31  server/billing-pages.neon.integration.test.ts   (??)
  d690a0b0d5b2b6f70933652b74311936a5d7a38a  server/billing-pages-support.ts                 (??)
  ```

## PELIGRO OPERATIVO

1. **Casi todo es `??`: `git checkout` NO revierte nada ahi.** Copia a `/tmp` + `shasum` + fila
   abierta ANTES de tocar. Restaurar = `cp` + `diff` + `shasum`.
2. **`confirm-dialog.tsx` es ` M`:** un `git checkout` se lleva trabajo no commiteado. Nunca.
3. **La fila se abre ANTES de mutar** (`/tmp/revision-b-ter.md`), no despues de medir.
4. **Etiquetá con `MUTATION` y revertí SIEMPRE.**
5. **Un rojo COLATERAL de una mutacion no se arregla: se espera.**
6. **Rojos masivos y absurdos ⇒ `df -k /` antes de leer una asercion.**

## Comandos

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use
set -a; . ./.env.integration.local; set +a
pnpm run typecheck --force | pnpm run lint | pnpm run test | pnpm run format:check | pnpm run build --force
pnpm --filter @mi-pasaporte/merchant exec vitest run <path>
echo '{"tool_input":{"file_path":"<abs>"}}' | .claude/hooks/file-size.sh; echo "EXIT=$?"
```

## ALCANCE — lo que este delta dice cerrar

**BLOQUEANTE (la 6a preimagen) — el oraculo de props pasa a un HELPER y se corre COMPLETO en cada
estado.** `expectCrossesExactly` (en `billing-pages-support.ts`) hace las cuatro: `type`, `key`,
UNA lectura (`structuredClone`) y `toEqual` de TODAS las props. Se llama desde **dos `it`
separados** (estado normal y estado bloqueado), **los dos sembrados con `custId`/`subId` reales**.
Medido:
- fuga en `notice` gateada al bloqueado → **ROJO solo en el `it` nuevo**, `- "notice": null` /
  `+ "notice": "cus_secret_SIXTH_S1"`.
- fuga en `downgradeBlock.message` conservando el «2» → **ROJO** en el `toEqual`.
- `<main>` envolviendo la consola → **ROJO** `expected 'main' to be [Function SubscriptionConsole]`.
- fuga del `key` → **ROJO 2, uno por `it`**, `expected 'cus_props_27bf91c1' to be null` y
  `expected 'cus_bloq_27bf91c1' to be null`.

**Por que DOS `it` y no dos tramos de uno:** medido — adentro del mismo `it` el primer rojo corta y
el 2o estado **no se evalua** (la fuga del `key` solo exhibia el secreto del primero).

**MENOR 3 — el guard `event.key !== "Tab"`:** 4o caso en `confirm-dialog-focus.test.ts`; con otra
tecla el handler sale ANTES del `querySelectorAll`, asi que se asevera `seen` **vacio**. Borrar el
guard → **ROJO 1/4**, solo ese caso.

**MENORES 2 y 4 y la observacion fuera de alcance — documentacion:** ADR 0062 (6 vueltas, requisito
4 reescrito, y **se corrige a si mismo**: la version anterior declaraba aplicado un requisito que no
lo estaba y citaba una asercion inflada), fila de `docs/INDEX.md`, items 8 y 12 de la spec, el
docblock de `page.tsx`, y el **§Hallazgos punto 2 de la spec, que era un LIMITE FALSO** («queda sin
oraculo que apretar el boton ABRA el modal») — `billing-click-probe.test.ts` lo pinnea y muerde.

## LO QUE TENES QUE CONTESTAR

1. **¿Hay una SEPTIMA preimagen?** Van seis, y **las dos ultimas las abrio el fix de la anterior**.
   Miralo con esa sospecha: **¿que abrio ESTE fix?** El helper centraliza — ¿se puede pasar por al
   lado? ¿un tercer estado sin `it`? ¿un camino que no llame al helper? **Medí con una sonda sobre
   el serializador real** (`/tmp/probe5-revb-bis.cjs`, `/tmp/flight-probe3.cjs`).
2. **El helper tiene DEFAULTS implicitos?** Revisa si alguna prop quedo fuera del `toEqual` por la
   forma en que el test construye el objeto esperado.
3. **¿Los docs afirman EXACTAMENTE lo que hay?** El ADR 0062 ya se corrigio a si mismo **dos veces**
   por afirmar de mas. Verificá cada numero y cada asercion que cita: tienen que salir de una
   corrida tuya.
4. **Mutaciones FUERA de esta lista.** En las tres rondas anteriores ahi estuvo TODO el valor.
5. **Si vas a declarar un limite, intentalo primero.** En esta spec **cuatro** limites declarados
   resultaron falsos (el ultimo, el del §Hallazgos, lo cazo tu antecesor).

## Fuera de alcance

- Fases A, B, C, D1 y el resto de la D2.
- `app/onboarding/page.tsx`: 469 lineas, violacion **PREEXISTENTE** que no crecio.
- **Dos archivos en 300 EXACTAS:** `billing-offers.test.ts` y `billing-store.neon…`. Si tu trabajo
  exige sumarles lineas, el corte se decide antes. (`billing-pages.neon` bajo a **296**.)

## DoD

- [ ] 5 gates re-corridos por vos, con numeros.
- [ ] Las 5 mutaciones del bloqueante + la del menor 3, re-ejecutadas por vos → ROJO, **leyendo la
      asercion** y **verificando en QUE `it` cae**.
- [ ] Al menos 2 mutaciones fuera de esta lista.
- [ ] Veredicto sobre la 7a preimagen, con la sonda que lo mide.
- [ ] Auditoria de que los docs no afirman de mas ni de menos.
- [ ] Higiene: `grep MUTATION` vacio, sin `zz-*`, los 5 shasums == baseline, tamaños al hook.
- [ ] Handoff con `PASS`/`FAIL` explicito.

**Bitacora a `/tmp/revision-b-ter.md`, fila por fila, A DISCO.** Esta spec lleva 14 muertes.
