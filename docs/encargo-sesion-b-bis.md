# Encargo — spec 0063, RE-REVISION ACOTADA de la sesion B-bis

**Rol: REVISOR INDEPENDIENTE** (`docs/AGENT-WORKFLOW.md`). `PASS` o `FAIL` con evidencia observable.
**No re-revisás la fase D2 ni la sesion A**: sólo el DELTA que corrige el FAIL de la sesion B.

Lo escribio el ORQUESTADOR, que es **el mismo turno que escribio el delta**. Por eso existis. Todo
numero de aca esta MEDIDO. **Si algo no reproduce, eso es un hallazgo.**

## Contexto en una linea

El arbol **NO esta commiteado** y el owner ató el commit al PASS: «si todavia no tenemos el pass del
revisor, entonces no». **Tu veredicto desbloquea el commit de 16 archivos `??`.**

El revisor anterior (bitacora en `/tmp/revision-sesion-b.md`) dio **FAIL: 1 bloqueante + 5 menores**.
Este delta los cierra. **Su bitacora y la mia (`/tmp/sesion-b-bis.md`) son tu insumo, no tu oraculo.**

## Estado del arbol al despachar (medido, 2026-09-12)

- `grep -rn MUTATION apps/merchant/src` → **vacio**. `find apps -name 'zz-*'` → **vacio**.
- Disco 38 GB. Node **v24.20.0** tras `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use`.
- **5 gates ya corridos por el orquestador (re-corrélos):** `test` con integracion **127 archivos /
  919 tests / 0 failed / 0 skipped** · `typecheck --force` 3/3 `0 cached` · `lint` EXIT=0 ·
  `format:check` OK · `build --force` 3/3 `0 cached`.
- **NUEVO baseline** (copias limpias en `/tmp/b-bis-clean/`):

  ```
  d2cf8bdc311b02fb408ed5e9c668b78a72750306  app/backoffice/subscription/page.tsx                 (??)
  2add27d40e400b21f168e7e86a907805ccddda36  app/components/confirm-dialog.tsx                    ( M)
  ccb82ac5c011edef546ce3e2fff59c3c5ca9e6db  server/billing-pages.neon.integration.test.ts        (??)
  648468e2e48b1774edcdca0b7415efeadacd7878  app/components/confirm-dialog-focus.test.ts          (??)
  ```

## PELIGRO OPERATIVO — leelo antes de mutar

1. **Casi todo es `??`: `git checkout` NO revierte nada ahi.** Copia a `/tmp` + `shasum` + fila
   abierta ANTES de tocar. Restaurar = `cp` + `diff` + `shasum`.
2. **`confirm-dialog.tsx` es ` M`: un `git checkout` se lleva tambien trabajo no commiteado.** Nunca.
3. **La fila de la bitacora se abre ANTES de mutar** (`/tmp/revision-b-bis.md`), no despues de medir.
   En esta spec ya se perdio una medicion entera por escribirla «al terminar».
4. **Etiquetá con el literal `MUTATION` y revertí SIEMPRE.**
5. **Un rojo COLATERAL de una mutacion no se arregla: se espera.**
6. **Rojos masivos y absurdos ⇒ `df -k /` antes de leer una asercion** (ya paso: `ENOSPC`).

## Comandos

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use
set -a; . ./.env.integration.local; set +a
pnpm run typecheck --force | pnpm run lint | pnpm run test | pnpm run format:check | pnpm run build --force
pnpm --filter @mi-pasaporte/merchant exec vitest run <path>
echo '{"tool_input":{"file_path":"<abs>"}}' | .claude/hooks/file-size.sh; echo "EXIT=$?"
```

Scripts de **ROOT**, no del paquete. **No uses worktrees.**

## ALCANCE — los 6 items que este delta dice cerrar

**B1 (era el bloqueante) — el canal `element.key`.** Se agrega `expect(element.key).toBeNull()` en
los DOS estados. Medido: `key={…}` → ROJO `expected 'cus_secret_ZZ9' to be null` en 2 tests, con el
test del HTML **verde** (un `key` no se renderiza).

**m1 — el `toEqual` pinneaba UN SOLO ESTADO.** Se agrega el 2o estado (`downgradeBlock` NO nulo) en
«con 2 locales activos…». Medido: clave de mas en esa rama → ROJO `+ "customer": null`.
**Matiz que te toca auditar: el seed de ese test no tiene `stripeCustomerId`, asi que la mutacion
filtro un `null`. El `toEqual` mordio por la CLAVE, no por el valor.** ¿Alcanza, o el 2o estado
necesita un secreto de verdad para ser un oraculo honesto?

**m2 — el comentario de `nonPlainPaths`** decia que caza instancias y el `structuredClone` se lo
llevo. Reescrito: caza `Map`/`Set`/`Date`, NO instancias (el clon aplana el prototipo), y eso es
**limite y no fuga** porque Flight las rechaza.

**m3 — docblocks de la 3a vuelta.** Corregidos `page.tsx` y el item 8 de la spec.

**m4 y m5 — el test de foco era TAUTOLOGICO y cubria una sola mitad.** Reescrito a **3 casos** con un
helper `tabDesde(activo, shiftKey)`. Medido, y **cada mutacion pone rojo un test DISTINTO**: selector
⇒ test 1; sacar `activeElement === last` ⇒ test 2 (`expected "vi.fn()" to not be called at all`);
borrar la rama del shift+Tab ⇒ test 3 (`to be called 1 times, but got 0 times`).

**Ademas: ADR 0062 reescrito** (5 vueltas, 4 requisitos) + fila de `docs/INDEX.md`, y el docblock de
`confirm-dialog.tsx`.

## LO QUE TENES QUE CONTESTAR

1. **¿Hay una SEXTA preimagen?** Van cinco y las cinco se veian cerradas. Pensá en canales que
   `structuredClone(props)` + `toEqual` + `element.key` no vean, y **medí con una sonda sobre el
   serializador real** (`/tmp/flight-probe3.cjs` es el punto de partida). Sin medicion no distinguis
   **fuga** de **limite**.
2. **¿Los docs corregidos afirman EXACTAMENTE lo que hay?** Es la familia que esta spec pago seis
   veces, y el delta que estas revisando **es en su mayoria documentacion**. El ADR 0062 ahora dice
   «los 4 puntos aplicados y con su mutacion en ROJO ejecutada»: **verificá cada una**. Un ADR que
   miente es peor que uno incompleto.
3. **Mutaciones FUERA de esta lista.** Es donde estuvo el valor en TODAS las fases de esta spec, sin
   excepcion. **Listá los comentarios del codigo nuevo que afirman un invariante y mutá cada uno.**
4. **Si vas a declarar un limite, intentalo primero.** En esta spec **tres** limites declarados
   resultaron falsos, y uno resulto **sobredimensionado al reves** (decir «tiene oraculo» cuando solo
   lo tenia un tercio). Las dos formas cuentan como hallazgo.

## Fuera de alcance

- Fases A, B, C, D1 (con PASS y commiteadas) y el resto de la D2.
- `app/onboarding/page.tsx` viola `file-size` con **469 lineas: es PREEXISTENTE y no crecio**.
- **TRES archivos al filo:** `billing-pages.neon…` **299**, `billing-offers.test.ts` **300**,
  `billing-store.neon…` **300**. Si tu trabajo exige sumar lineas ahi, **el corte se decide antes**.

## DoD

- [ ] 5 gates re-corridos por vos, con numeros.
- [ ] Las mutaciones de B1, m1, m4 y m5 re-ejecutadas por vos → ROJO, **leyendo la asercion**.
- [ ] Al menos 2 mutaciones fuera de esta lista, elegidas por vos.
- [ ] Veredicto sobre la SEXTA preimagen, con la sonda que lo mide.
- [ ] Auditoria de que los docs corregidos (ADR 0062, spec items 8 y 12, los 2 docblocks) no afirman
      de mas **ni de menos**.
- [ ] Higiene: `grep MUTATION` vacio, sin `zz-*`, los 4 shasums == baseline, tamaños al hook.
- [ ] Handoff con `PASS`/`FAIL` explicito.

**Bitacora a `/tmp/revision-b-bis.md`, fila por fila, A DISCO.** Esta spec lleva 13 muertes.
