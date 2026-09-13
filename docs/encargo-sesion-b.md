# Encargo — spec 0063, SESION B: REVISION INDEPENDIENTE ACOTADA (delta de la sesion A)

**Rol: REVISOR INDEPENDIENTE** (`docs/AGENT-WORKFLOW.md`). Devolvés `PASS` o `FAIL` con evidencia
observable. **No re-revisás la fase D2 entera** — eso ya lo hizo el revisor del delta y su veredicto
(FAIL de baja severidad) es el insumo de este encargo.

Lo escribio el ORQUESTADOR, que es **el mismo turno que hizo los cambios de la sesion A**: por eso
vos existis. Todo numero de aca esta MEDIDO con el comando que se indica. **Si algo no reproduce,
eso es un hallazgo y va al handoff.**

## Por que hay una sesion B: el owner ató el commit al PASS

El arbol **NO esta commiteado** y el owner decidió (literal, 2026-09-12): «hace el commit ahora si
esta listo. pero si todavia no tenemos el pass del revisor, entonces no». **Tu PASS/FAIL es lo que
desbloquea el commit de 16 archivos `??`.** No es un tramite.

## Estado del arbol al despachar (medido, 2026-09-12)

- `grep -rn MUTATION apps/merchant/src` → **vacio**. `find apps -name 'zz-*'` → **vacio**.
- Disco: **41 GB libres** (`df -k /`). Node **v24.20.0** tras `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use`.
- **Gates ya corridos por el orquestador (re-corrélos, no me creas):** `test` con integracion
  **127 archivos / 917 tests / 0 failed / 0 skipped** · `typecheck --force` 3/3 `0 cached` · `lint`
  `EXIT=0` · `format:check` OK · `build --force` 3/3 `0 cached`.
- Baseline de los archivos del alcance:

  ```
  abc751a0f0c96bfdaf0188b9f9f7128e8d7a12e8  apps/merchant/src/server/billing-pages.neon.integration.test.ts   (??)
  79473252e7a1dcae63ddefeede734e3e5616e7ff  apps/merchant/src/app/components/confirm-dialog-focus.test.ts     (??)
  553dec1982e8bd6e5419fe3bbc34a03154dfe3c0  apps/merchant/src/app/components/confirm-dialog.tsx               ( M)
  963efe9ce5e80a627c22cc634ff487a9b9439cd7  apps/merchant/src/app/backoffice/subscription/page.tsx            (??)
  82388cbb16f4fe279469b84b7513c4e20fef377d  apps/merchant/src/app/backoffice/subscription/subscription-console.tsx (??)
  d48533a330c1d77446ac6821d60d86c0add779d2  apps/merchant/src/server/billing-pages-support.ts                 (??)
  ```

- **Copias limpias ya tomadas en `/tmp/sesion-a-limpio/`** (`page.tsx`, `confirm-dialog.tsx`).
  Para cualquier OTRO archivo que mutes, la copia la sacás vos ANTES.

## PELIGRO OPERATIVO REAL EN ESTE ARBOL — leelo antes de mutar una linea

1. **Casi todo el alcance es `??` (untracked): `git checkout <archivo>` NO HACE NADA sobre ellos.**
   No hay blob. El unico punto de retorno es tu copia en `/tmp` + el `shasum` que registres ANTES.
2. **`confirm-dialog.tsx` es ` M` (tracked y modificado): ahi `git checkout` SI hace algo, y es lo
   PEOR que puede hacer — se lleva tambien el trabajo no commiteado, no solo tu mutacion.**
   Restaurar SIEMPRE con `cp` desde tu copia + `diff` + `shasum`, y **mirá que el `diff` previo a
   restaurar muestre EXACTAMENTE tu mutacion y nada mas.**
3. **LA FILA DE LA BITACORA SE ABRE ANTES DE MUTAR**, no despues de medir: `id + archivo + shasum
   limpio + que invariante ataca`. Escribila a disco (`/tmp/revision-sesion-b.md`) apenas la abris.
   En esta spec ya se perdio una medicion entera por escribir la fila «al terminarla».
4. **Toda mutacion va ETIQUETADA con el literal `MUTATION`** en el codigo mientras esta puesta (lo
   exige el hook `no-mutations-left.sh`), y se revierte SIEMPRE antes de cualquier otra cosa.
5. **Un rojo COLATERAL de una mutacion no se arregla: se espera.** Si sacar algo deja un import sin
   usar y `lint` se pone rojo, borrar el import consolida la mutacion.
6. **Si aparecen rojos masivos y absurdos** (todos los archivos, en segundos, «no tests»): `df -k /`
   ANTES de leer una sola asercion. Ya paso en esta spec (`ENOSPC`, 124 «FAIL» que eran mentira).

## Comandos

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use       # 24.20.0; el shell del agente arranca en 22
set -a; . ./.env.integration.local; set +a                      # rama Neon efimera spec-0063-billing
pnpm run typecheck --force | pnpm run lint | pnpm run test | pnpm run format:check | pnpm run build --force
pnpm --filter @mi-pasaporte/merchant exec vitest run <path>     # un archivo suelto
echo '{"tool_input":{"file_path":"<abs>"}}' | .claude/hooks/file-size.sh; echo "EXIT=$?"   # tamaño AL HOOK
```

`lint`/`test`/`format:check`/`build` son scripts de **ROOT**, no del paquete. **NO uses worktrees**:
`pnpm run`/`pnpm exec` adentro de uno intenta purgar el `node_modules` real.

## ALCANCE — los DOS cambios de la sesion A, y nada mas

### Cambio 1 — `structuredClone` en el test de props (cierra el bloqueante del revisor del delta)

`server/billing-pages.neon.integration.test.ts:157`: `const props = structuredClone(element.props)`
como **UNICA lectura**, y las 3 aserciones (claves, `nonPlainPaths`, `toEqual`) leen el clon.

**El problema que cierra** (ADR 0062, leelo): el test leia `element.props` DOS veces y **Flight lo
lee UNA**, asi que un getter con estado o un `Proxy` que devuelve el secreto solo en la primera
lectura dejaba **15/15 en VERDE** mientras el serializador real mandaba `"endpoint":"cus_secret_ZZ9"`.
Es la CUARTA preimagen de la misma fuga (S7); las tres anteriores —render del HTML,
`JSON.stringify`, allow-list de CLAVES— tambien se veian suficientes y no lo eran.

**Ejecutado por el orquestador (re-ejecutalo, no lo heredes):** E4 (getter con estado en
`offers.downgrade.endpoint`) → ROJO con `- "endpoint": "/api/billing/cancel"` / `+ "endpoint":
"cus_secret_ZZ9"`; E5 (`Proxy` sobre `offers.downgrade`) → ROJO `DataCloneError`. Control 6/6 VERDE.

**LA PREGUNTA QUE TENES QUE CONTESTAR: ¿hay una QUINTA preimagen?** Esta fuga lleva cuatro rondas y
cada cierre parecio definitivo. Pensá en canales que `structuredClone` + `toEqual` no vean pero el
serializador SI mande — y **medí que manda el serializador de verdad con una sonda** (hay una previa
en `/tmp/flight-probe2.cjs` sobre `next/dist/compiled/react-server-dom-webpack/server.node.js`), no
razones sobre el `.d.ts`. Sin esa medicion no podes distinguir una **fuga** de un **limite**.
Y la otra mitad: **¿que queda FUERA del alcance del oraculo?** (por ejemplo: que props mira y cuales
no). Si encontras un limite real, **acotalo a la parte exacta que lo es** — y si escribis «esto no
se puede», **intentalo primero**: en esta misma spec dos limites declarados resultaron falsos.

### Cambio 2 — `confirm-dialog-focus.test.ts` (promociona la sonda R18 y mata un limite falso)

Archivo NUEVO (95 lineas). Render real con `renderToStaticMarkup` + `parse()` de
`next/dist/compiled/node-html-parser` (**viene bundleado en `next`**, con motor CSS) + el `onKeyDown`
y el `ref` REALES del elemento. **VERDE 1/1 en 12 ms, cero paquetes.** Mutacion **R18** (selector →
`"button, input, select, textarea"`) → **ROJO**: `expected [ 'BUTTON:Cancelar', 'BUTTON:Confirmar' ]
to deeply equal [ 'A:tus locales', 'BUTTON:Cancelar' ]`.

Ademas se corrigio el limite falso en **los dos lugares donde estaba escrito**: el docblock de
`confirm-dialog.tsx` y el item 12 de la spec 0063 (+ dos filas viejas de `docs/TASKS.md`).

**LO QUE TENES QUE MIRAR:** el test mockea `react` (`useId`/`useRef`/`useEffect`) y stubea
`document.activeElement`. **¿Alguno de esos atajos lo hace pasar por el motivo equivocado?** Un
VERDE por el setup se ve igual que un VERDE por la propiedad. Y al reves: **¿que afirma el docblock
nuevo que el test NO pinnea?** El docblock corregido es una AFIRMACION como cualquier otra — si dice
de mas, es el ADR 0054 otra vez, esta vez cometido al *corregir* un limite (que ya paso en la 0057).
**Las mutaciones que valen son las que NO estan en ninguna tabla**: en las fases B, C y D1 ahi
estuvo todo el valor. Listá los comentarios del codigo nuevo que afirman un invariante y mutá cada uno.

### Los 3 MENORES del revisor del delta — perdidos, hay que recuperarlos

El revisor del delta cerro **FAIL de baja severidad: 1 bloqueante (ya cerrado arriba) + 3 menores**,
y **el detalle de los 3 murio con el agente**. Su bitacora sobrevivio en `/tmp/revision-delta-d2.md`
(el veredicto esta al final; los menores no estan detallados ahi).

**NO tenés que «encontrar tres».** El numero es lo unico que sobrevivio y **un menor inventado para
llegar a tres es peor que un menor perdido**. Reportá los que encuentres con evidencia, y decí
explicitamente cuantos encontraste y que el numero original era 3.

## Fuera de alcance (no lo toques, no lo re-revises)

- Las fases A, B, C y D1: cerradas con PASS y commiteadas.
- El resto de la fase D2 (paginas, D8, D10, las rutas): ya lo reviso el revisor del delta.
- **`app/onboarding/page.tsx` tiene 469 lineas y viola el hook `file-size`: es PREEXISTENTE y NO
  crecio** (469 antes y 469 despues, medido al hook las dos veces). No es tuyo.
- **`billing-offers.test.ts` y `billing-store.neon.integration.test.ts` estan en 300 EXACTAS**
  (`EXIT=0`, limite 300). No les sumes nada sin decidir el corte antes.

## DoD de esta revision

- [ ] Los 5 gates re-corridos POR VOS sobre los bytes actuales, con sus numeros.
- [ ] E4 y E5 re-ejecutadas por tu cuenta → ROJO, **leyendo la asercion** (no «vi un rojo»).
- [ ] R18 re-ejecutada por tu cuenta → ROJO, leyendo la asercion.
- [ ] Al menos una mutacion FUERA de la tabla por cada cambio, elegida por vos.
- [ ] Veredicto sobre la quinta preimagen: existe (fuga) o no (limite), **con la sonda que lo mide**.
- [ ] Higiene al cerrar: `grep MUTATION` vacio, sin `zz-*`, los 6 shasums == baseline, tamaños al hook.
- [ ] Handoff con el bloque minimo de `docs/AGENT-WORKFLOW.md` y `PASS`/`FAIL` explicito.

**Tu bitacora va a `/tmp/revision-sesion-b.md` y se escribe A DISCO fila por fila.** En esta spec
hubo 12 muertes de sesion: lo que vive solo en tu contexto se pierde.
