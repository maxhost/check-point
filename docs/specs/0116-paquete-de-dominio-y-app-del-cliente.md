---
spec: 0116
fecha: 2026-09-30
estado: cerrada
resumen: Fase 2 del ADR 0107 — los 111 modulos que arrastran las pantallas y rutas del cliente salen de merchant a packages/domain (@mi-pasaporte/domain, ADR 0108) byte a byte; apps/consumer pasa a tener COPIAS identicas de app/(consumer)/** y app/api/public/** (45 archivos), su CSS y sus assets, y se borran sus demos; merchant sigue sirviendo todo y consumer no recibe trafico.
disjunta: si
archivos: packages/domain/**, apps/merchant/src/** (git mv de 111 modulos + lineas de import), apps/merchant/{package.json,next.config.ts}, apps/consumer/**, tools/google-wallet-callback.test.ts, tools/vi-mock-targets.test.ts, pnpm-lock.yaml, packages/db/src/schema/{billing,membership,staff-pin}.ts (comentarios), .claude/skills/gotchas-del-repo/SKILL.md, docs/**
---

# 0116 — Fase 2: `packages/domain` y la app del cliente

> ADR 0107 fase 2, ADR 0108. Movimiento + copia: **ningun cambio de comportamiento en merchant** y ninguna linea nueva
> de logica. Plantilla grande: toca build, dependencias y dos apps.

## Problema

Medido sobre `d20f2c5` (cierre de imports relativos estaticos, `import()` e `import type`, desde los archivos no-test):

- Las pantallas y rutas del cliente son **50 archivos** en `apps/merchant/src/app/(consumer)/**` (27) y
  `app/api/public/**` (23); **45 sin tests**. Importan solo modulos de merchant y paquetes npm.
- Su cierre son **111 modulos** de `apps/merchant/src` (lista exacta: `0116-modulos-movidos.txt`, rutas relativas a
  `apps/merchant/src`): 83 tambien los usa el resto de merchant, 28 solo el cliente. Ninguno importa un modulo de
  merchant fuera de la lista. Uno es `.tsx` (`components/loyalty/card-preview.tsx`, sin imports, lo usan el backoffice
  y `wallet/program-card.tsx`).
- Fuera del conjunto los importan **250 archivos de merchant** (147 tests, 103 no) — 14 de ellos pantallas de
  `app/backoffice/**` y `app/[locale]/layout.tsx` — y uno de afuera: `tools/google-wallet-callback.test.ts:2`.
- `vi.mock` relativos en `apps/**`: **183, todos resuelven a un archivo**; **49** apuntan a modulos de la lista, en 27
  archivos.
- Uno de los 111 se importa como carpeta: `server/entitlements` (`index.ts`), desde `marketing/plan-gate.ts:4` y
  merchant (`catalog-import/quota.ts:11`, `locations/core.ts:1`, tests).
- `apps/consumer` solo tiene demos (`check-in/demo-bar`, `wallet/demo`, `qa`, `demo.ts` + `demo.test.ts`) y
  `api/health`.
- Estilos: las pantallas usan Tailwind (tokens de `ui/tokens.css`) y clases de `app/globals.css` de merchant: la
  base (`:root`, `*`, `body`, `button, input`, lineas 4–18) y el bloque continuo **3424–3772** (`.card-preview` …
  `.consumer-reward-gap.is-ready`). Clases estaticas usadas: `0116-clases-del-cliente.txt` (49).
- Assets publicos: `push-prompt.tsx:78,89` registra `/sw.js`; `wallet/manifest.webmanifest/route.ts:44` sirve
  `/wallet-logo.png`.

## Alcance

**Entra:**

1. **`packages/domain` = `@mi-pasaporte/domain`** (`private`, `"type": "module"`, fuente TS, ADR 0108):
   - `git mv` de los 111 archivos de la lista a `packages/domain/src/<misma ruta>`. **Byte a byte: ninguno se edita.**
   - `exports`: `"./*": "./src/*.ts"` y `"./components/loyalty/card-preview": "./src/components/loyalty/card-preview.tsx"`.
     Las importaciones de carpeta se escriben con `/index` (`@mi-pasaporte/domain/server/entitlements/index`).
   - Dependencias: las que importan los 111 (`@mi-pasaporte/db` `workspace:*`, `drizzle-orm`, `@aws-sdk/client-s3`,
     `@aws-sdk/s3-request-presigner`, `qrcode`, `node-forge`, `fflate`) **con las mismas versiones** que merchant;
     `react` como `peerDependency`; dev: `@types/node`, `@types/react`, `@types/qrcode`, `@types/node-forge`.
   - `tsconfig.json` como el de `packages/db` (que incluya `**/*.tsx`) y script `typecheck`. **Sin tests propios**:
     los tests de estos modulos se quedan en merchant (la 0117 decide su destino).
2. **Merchant**:
   - Codemod de imports: todo especificador relativo que resuelva a un archivo de la lista pasa a
     `@mi-pasaporte/domain/<ruta sin extension>` — `import`, `export … from`, `import()`, `import type` y `vi.mock` /
     `vi.doMock`. Sin archivos puente (ADR 0107 §1). Las aserciones no se tocan.
   - `package.json`: `"@mi-pasaporte/domain": "workspace:*"`. Una dependencia npm se saca de merchant **solo** si
     `rg` no encuentra ningun import suyo en `apps/merchant/src`. `next.config.ts`: `transpilePackages` suma
     `@mi-pasaporte/domain`.
   - `server/consumer-opt-out-writer.test.ts`: el barrido de quien escribe `marketingOptOutAt` mira tambien
     `packages/domain/src` y `apps/consumer/src`, y `WRITER` pasa a la ruta del paquete. El piso (`> 50` archivos) y la
     asercion de raiz se mantienen; se suma una que asevera que el barrido contiene al menos un archivo de cada raiz.
3. **`apps/consumer`**:
   - Se borran `src/app/check-in/`, `src/app/wallet/demo/`, `src/app/qa/`, `src/app/demo.ts`, `src/app/demo.test.ts`.
     Se quedan `api/health` y su test.
   - **Copia** de los 45 archivos no-test de `app/(consumer)/**` y `app/api/public/**` de merchant (ya con el codemod
     aplicado) a las mismas rutas bajo `apps/consumer/src/app/`. **Byte a byte**: tras el codemod esos archivos solo
     importan entre si (relativo, mismo arbol) o paquetes, asi que la copia no se edita. Los 5 tests NO se copian.
   - `layout.tsx`: el de merchant sin `driver.js/dist/driver.css`, con `title: "CheckPass Club"`.
   - `globals.css`: `@import "tailwindcss";` + `@import "./tokens.css";` + las lineas 4–18 y 3424–3772 del
     `globals.css` de merchant **copiadas tal cual**. `tokens.css` = copia byte a byte de `apps/merchant/src/ui/tokens.css`.
     `postcss.config.mjs` = copia del de merchant.
   - `public/sw.js` y `public/wallet-logo.png`: copias byte a byte (se borra `public/.gitkeep`).
   - `package.json`: `@mi-pasaporte/db` y `@mi-pasaporte/domain` (`workspace:*`), `drizzle-orm`, `next`, `react`,
     `react-dom` y lo que importen los 45 archivos; dev: `tailwindcss`, `@tailwindcss/postcss` (versiones de merchant).
     `next.config.ts`: `transpilePackages: ["@mi-pasaporte/db", "@mi-pasaporte/domain"]`, se conserva
     `allowedDevOrigins`.
   - `vitest.config.ts`: el `esbuild: { jsx: "automatic", jsxImportSource: "react" }` de merchant.
4. **`tools/vi-mock-targets.test.ts`** (nuevo, permanente): todo `vi.mock`/`vi.doMock` con especificador relativo en
   `apps/*/src` y `packages/*/src` resuelve a un archivo existente (`.ts`, `.tsx`, `/index.ts`). Piso: **≥ 120**
   `vi.mock` relativos (medido tras el movimiento: 136; la spec decia 150 por un error de cuenta del orquestador:
   183 − 49 = 134).
5. `tools/google-wallet-callback.test.ts:2` → `../packages/domain/src/server/wallet/google-object`.
6. `pnpm install --offline` y lockfile commiteado (si `--offline` no alcanza por DNS: declarar y frenar, no
   `pnpm fetch`).
7. Deuda de la 0115: los comentarios que nombran `server/schema.ts` en `packages/db/src/schema/billing.ts:8`,
   `membership.ts:23`, `staff-pin.ts:30` pasan a `src/schema.ts`; `staff-contract.ts:6` pasa a
   `@mi-pasaporte/db/permissions-catalog`. Solo prosa.
8. `gotchas-del-repo/SKILL.md:326`: la ruta de `loyalty-program/validation.ts` pasa a la del paquete.

**No entra:** editar una linea de logica; partir `server/brand.ts` (304 lineas: se mueve sin editar); `proxy.ts` o
enrutamiento por host en consumer; pagina `/` del cliente; proyecto de Vercel del cliente, crons, dominios, rol de
Postgres y borrado en merchant (todo 0117); mover tests; podar `globals.css` de merchant.

## Diseño

- **Por que la copia es byte a byte:** los 45 archivos dependen solo de los 111 y entre si (medido: cierre). Con el
  codemod aplicado en merchant, sus imports externos son `@mi-pasaporte/*`, que resuelven igual desde las dos apps.
  Cualquier diferencia entre las dos copias es un error.
- **Mocks:** un `vi.mock("@mi-pasaporte/domain/server/x")` en un test de merchant alcanza el import RELATIVO que
  hace otro modulo del paquete (`./x`). **Medido** con una sonda sobre `packages/db`: `vi.mock("@mi-pasaporte/db/schema/otp")`
  cambia lo que exporta el barrel `@mi-pasaporte/db/schema` (verde) y con una ruta erronea no (rojo); sonda borrada.
- Los tests de las pantallas (los 5 co-ubicados y `server/enroll-*.test.ts`) siguen probando la copia de merchant;
  la de consumer queda cubierta por la igualdad de bytes. Se declara.
- **Comportamiento visible que cambia en consumer, no en merchant:** el `<title>` por defecto (las pantallas que no
  declaran el suyo). Consumer no recibe trafico en esta fase.

## Definition of Done

- [ ] **Movimiento:** para cada ruta de `0116-modulos-movidos.txt`, `apps/merchant/src/<ruta>` **no existe** y
      `packages/domain/src/<ruta>` existe con el **mismo `shasum -a 256`** que tenia en `d20f2c5`
      (`git show d20f2c5:apps/merchant/src/<ruta> | shasum -a 256`). 111/111.
- [ ] **Copia:** `diff -r` entre `apps/merchant/src/app/(consumer)` y `apps/consumer/src/app/(consumer)`, y entre
      los dos `app/api/public`, excluyendo `*.test.ts` → vacio. Y 45 archivos en cada lado (`find … ! -name '*.test.ts'`).
- [ ] `cmp` de `tokens.css`, `sw.js`, `wallet-logo.png` y `postcss.config.mjs` contra merchant → identicos.
- [ ] **CSS:** tras `pnpm --filter @mi-pasaporte/consumer build`, cada clase de `0116-clases-del-cliente.txt` aparece
      como selector en algun `.css` de `apps/consumer/.next/static/` (regex `\.<clase>(?![-\w])`, con `rg -P`). 49/49.
- [ ] `tools/vi-mock-targets.test.ts` verde, con su piso, y **rojo con un `vi.mock` relativo que no
      resuelve** (lo prueba la M5).
- [ ] `consumer-opt-out-writer.test.ts` verde con las cuatro raices.
- [ ] `ls apps/consumer/src/app/{check-in,qa,demo.ts,demo.test.ts,wallet/demo}` → no existen.
- [ ] **Diferencial HTTP:** merchant y consumer levantados (`next dev` o `next start`) con el MISMO entorno y
      `DATABASE_URL` = rama de CI (`NEON_CI_DATABASE_URL` de `apps/merchant/.env.local`, con el interlock de host de
      `tools/neon-test.sh`: nunca la de PROD; el valor no se imprime). Solo GET. Mismo codigo de estado en las dos
      para: `/api/health`, `/recover`, `/wallet`, `/wallet/manifest.webmanifest`, `/c/x`,
      `/enroll/00000000-0000-0000-0000-000000000000`, `/api/public/consumer/coupons`,
      `/api/public/consumer/cross-offers`. Se transcribe la tabla.
- [ ] **Pantalla:** capturas de `/recover` y `/wallet` (sin sesion) en las dos apps a 390×844
      (`pnpm exec playwright screenshot --viewport-size "390, 844" <url> <png>`), adjuntas en la bitacora; si `cmp` difiere, se
      describe la diferencia (no se persigue: se lleva al QA de la 0117).
- [ ] Gates de root: typecheck, lint, test, format:check, build (`TURBO_FORCE=1`), `test:e2e`. Test: **merchant con
      el mismo numero de archivos y de tests que en `d20f2c5`**; consumer pierde exactamente `demo.test.ts` (anotar sus
      tests); tools suma `vi-mock-targets.test.ts`. Se anotan las cifras antes y despues.
- [ ] `tools/neon-test.sh` sobre `src/server/consumer-recovery.neon.integration.test.ts` y
      `src/server/wallet-push.neon.integration.test.ts` → verde.
- [ ] `pnpm install --frozen-lockfile` desde root funciona con el lockfile commiteado.

## Plan de pruebas y verificación

Es un movimiento y una copia: los oraculos son **igualdad** (bytes, conteos, codigos HTTP) y dos barridos. Presupuesto:
**5 mutaciones**, clase de error a cazar = los plausibles de un movimiento mecanico (copia en vez de mover, copia que
diverge, CSS incompleto, barrido que pierde cobertura, mock que apunta a la nada).

| # | Mutacion | Oraculo | Guard hermano |
|---|---|---|---|
| M1 | cambiar un byte de `apps/consumer/src/app/(consumer)/wallet/qr-tab.tsx` | `diff -r` de la DoD da distinto | typecheck no (sigue compilando) |
| M2 | restaurar `apps/merchant/src/lib/currencies.ts` (copia byte a byte del paquete: no tiene imports) y volver `app/api/onboarding/business/route.ts` a importarlo relativo | el chequeo «no existe en merchant» de la DoD lo marca | typecheck y tests NO (la copia compila y es igual): por eso existe la fila |
| M3 | borrar la regla `.consumer-qr {` (linea 3622 en origen) del `globals.css` de consumer | el chequeo de clases sobre el build da 48/49 y nombra `consumer-qr` (no `consumer-qr-tab`: la regex lo excluye) | ninguno automatico |
| M4 | en `packages/domain/src/server/wallet/rotate.ts`, codigo muerto que hace `.set({ marketingOptOutAt: null })` | `consumer-opt-out-writer.test.ts` rojo en «sólo `consumer/marketing-opt-out.ts` la escribe», nombrando el archivo del paquete | ninguno: sin la extension del barrido pasaria verde (es lo que mide) |
| M5 | dejar en un test de merchant un `vi.mock("../wallet/core")` (relativo, a un modulo ya movido) | `tools/vi-mock-targets.test.ts` rojo nombrando archivo y especificador | el test que usaba el mock puede ponerse rojo tambien: la fila mide el de `tools/` |

Protocolo de la skill `protocolo-de-verificacion` §2 (shasum limpio, fila de bitacora ANTES de medir, etiqueta
`MUTATION` donde el archivo lo admita — en `.css` y en la restauracion de M2 va en un comentario —, revertir con `diff`).
Cada rojo se LEE: tiene que nombrar la propiedad, no un error de setup.

**Limites declarados:** las copias de consumer no tienen tests propios (cubiertas por igualdad de bytes); clases
dinamicas fuera de `is-closed`/`is-ready` no estan en la lista; la captura no es un oraculo automatico.

## Handoff requerido

Un implementador y un revisor (`docs/AGENT-WORKFLOW.md`). Con el PASS, el orquestador pushea a `main`, verifica el
deploy de merchant en `READY` con el sha, `business.checkpass.club/api/health` 200 y
`business.checkpass.club/api/public/consumer/coupons` 401 (con `--resolve business.checkpass.club:443:216.198.79.1`).
**Avisar al owner** que 14 pantallas de `app/backoffice/**` cambian lineas de import (`@mi-pasaporte/domain/...`):
la UI que haga con GPT tiene que importar de ahi.

## Abierto

Nada que bloquee. **Medido en la implementacion:** las capturas de `/recover` y `/wallet` difieren entre las dos
apps porque el CSS de consumer no trae reglas de ELEMENTO del `globals.css` de merchant (`select` 40–46, `h1`/`h2`/`p`
235–246, `label:where(…)` desde 247): se suman en la 0117 antes del QA en telefono. Para la 0117: destino de los 28 modulos solo-cliente y de los tests de las pantallas; tokens
duplicados (`tokens.css` en las dos apps).
