---
spec: 0047
fecha: 2026-08-30
estado: cerrada
resumen: El CI de GitHub está rojo desde hace commits porque `pnpm format:check` falla con 20 archivos sin formatear; como es el PRIMER paso del workflow, lint/typecheck/test/e2e/build nunca llegan a correr. Formatear la deuda, agregar el script `format` que falta y prevenir la recaída.
disjunta: si
archivos: 19 archivos a formatear (lista abajo menos settings.local.json), package.json (script `format`), .prettierignore, .github/workflows/ci.yml (format:check al final), .claude/hooks/format-on-write.sh + .claude/settings.json
---

# 0047 — Deuda de formato y CI rojo

> Deuda encontrada durante la implementación de la spec 0046 (no causada por ella:
> los archivos de 0046 quedaron formateados). Se levanta como spec separada por la
> regla de `CLAUDE.md`: nada de arreglos silenciosos fuera del alcance de otra spec.

## Problema

**El CI del repositorio está rojo y no verifica nada.** `.github/workflows/ci.yml`
corre, en este orden:

```yaml
- run: pnpm format:check   # ← falla acá
- run: pnpm lint
- run: pnpm typecheck
- run: pnpm test
- run: pnpm test:e2e
- run: pnpm build
```

`pnpm format:check` (`prettier --check .`) falla con **20 archivos** con problemas de
estilo. Como es el **primer** paso y GitHub Actions corta la ejecución al primer exit
code distinto de cero, **`lint`, `typecheck`, `test`, `test:e2e` y `build` NUNCA se
ejecutan en CI**. El repositorio tiene la apariencia de un gate de CI pero no tiene el
gate: cualquier regresión de tipos, test roto o build caído pasaría sin ser detectada
por GitHub.

Evidencia (verificada, no inferida):

- `gh run list` muestra **3 corridas de CI seguidas en `failure`** sobre `main`
  (`33329183454`, `33328757578`, `33328440371`).
- `gh run view 33329183454 --log-failed` termina en
  `Code style issues found in 19 files. Run Prettier with --write to fix.` →
  `Process completed with exit code 1`.
- El conteo local hoy es **20** archivos (subió de 19 con trabajo posterior).

Agravante: **no existe el script `format` (escritura) en el `package.json` de root** —
sólo `format:check`. No hay una forma obvia de arreglarlo, lo que explica que la deuda
se haya acumulado.

## Alcance

**Entra:**
- Formatear con Prettier los 20 archivos en deuda, **sin ningún cambio de comportamiento**.
- Agregar el script `format` (`prettier --write .`) al `package.json` de root.
- Dejar el CI verde y verificable.
- Decidir y aplicar una prevención para que no vuelva a acumularse.

**No entra:**
- Cambiar reglas de Prettier o su configuración (`prettier.config.mjs` no se toca).
- Refactors, renombres o cualquier cambio semántico en los archivos tocados.
- Arreglar los warnings de deprecación de Node 20 en las actions del workflow
  (`actions/checkout@v4` etc.) — es ruido distinto, va en su propia tarea.

## Diseño

### 1. Formatear la deuda

Los 20 archivos (`pnpm format:check` al 2026-08-30):

| # | Archivo | Origen |
|---|---|---|
| 1 | `.claude/settings.local.json` | config local |
| 2 | `apps/merchant/src/app/(consumer)/wallet/bottom-nav.tsx` | spec 0031 |
| 3 | `apps/merchant/src/app/backoffice/brand/kit/brand-kit-wizard.tsx` | spec 0041 |
| 4 | `apps/merchant/src/app/backoffice/brand/kit/page.tsx` | spec 0041 |
| 5 | `apps/merchant/src/app/backoffice/brand/kit/poster-preview.tsx` | spec 0041 |
| 6 | `apps/merchant/src/app/backoffice/brand/kit/steps/step-brand-check.tsx` | spec 0041 |
| 7 | `apps/merchant/src/app/backoffice/brand/kit/steps/step-preview.tsx` | spec 0041 |
| 8 | `apps/merchant/src/app/backoffice/brand/kit/steps/step-template.tsx` | spec 0041 |
| 9 | `apps/merchant/src/app/backoffice/brand/kit/templates/parts.tsx` | spec 0041 |
| 10 | `apps/merchant/src/app/backoffice/brand/kit/templates/types.ts` | spec 0041 |
| 11 | `apps/merchant/src/app/page.tsx` | spec 0045 |
| 12 | `apps/merchant/src/server/brand-kit/data.test.ts` | spec 0041 |
| 13 | `apps/merchant/src/server/brand-kit/enroll-url.ts` | spec 0041 |
| 14 | `apps/merchant/src/server/brand-kit/qr.test.ts` | spec 0041 |
| 15 | `apps/merchant/src/server/consumer-enrollment-attribution.neon.integration.test.ts` | spec 0041 |
| 16 | `apps/merchant/src/server/consumer-recovery-failure.neon.integration.test.ts` | spec 0032 |
| 17 | `apps/merchant/src/server/consumer/enrollment.ts` | spec 0028 |
| 18 | `apps/merchant/src/server/consumer/recovery/deliver.ts` | spec 0032 |
| 19 | `apps/merchant/src/server/consumer/recovery/internal.ts` | spec 0032 |
| 20 | `scripts/google-wallet/provision-class.mjs` | wallet |

Se aplica `prettier --write` sobre esa lista. **Riesgo real a vigilar:** el formateo
puede empujar un archivo por encima del límite de 300 líneas del hook `file-size`
(le pasó a `merchant-recovery.test.ts` en la spec 0046, que hubo que dividir). Si
ocurre, se **divide** el archivo, no se extiende el límite.

**Decisión cerrada (2026-09-01) — `.claude/settings.local.json` va a `.prettierignore`.**
Evidencia: `git check-ignore -v` lo resuelve contra el ignore global del usuario
(`/Users/maxi/.config/git/ignore:1: **/.claude/settings.local.json`), o sea **no está
versionado y nunca llega a GitHub**. Eso explica exactamente la discrepancia de conteos:
el log de CI dice `19 files` y el `format:check` local dice `20`. Es config que el arnés
reescribe sola, así que formatearla es ruido recurrente que vuelve a ensuciar el gate.
Se ignora, no se formatea. Quedan **19** archivos a formatear (la tabla de arriba menos
el #1).

### 2. Script `format` que falta

En el `package.json` de root, junto a `format:check`:

```json
"format": "prettier --write ."
```

Sin esto, arreglar la deuda exige recordar la invocación cruda de Prettier; es la
causa estructural de que se haya acumulado.

### 3. Prevención (elegir una, decisión del owner)

- **(a) Mover `format:check` al final del workflow.** El CI sigue fallando ante deuda
  de formato, pero primero corre lint/typecheck/test/build, así que un problema real
  se ve aunque el formato esté sucio. Cambio de una línea, arregla el peor síntoma
  (que el CI no verifique nada).
- **(b) Hook `PostToolUse` que corra `prettier --write` sobre el archivo tocado.**
  Alineado con la doctrina de `CLAUDE.md` ("las reglas verificables van en hooks"):
  la deuda no se vuelve a acumular porque cada escritura sale formateada. Es el fix
  estructural real.
- **(c) Ambas.** Recomendado: (b) previene, (a) hace que el CI siga siendo útil
  mientras tanto.

**Decisión cerrada (2026-09-01): (c), ambas.**

- **(a)** En `.github/workflows/ci.yml`, `format:check` pasa a ser el **último** paso.
  Motivo: el estilo es la falla menos informativa del set; que corte antes de
  `typecheck`/`test`/`build` es precisamente lo que dejó al repo sin gate. Sigue siendo
  bloqueante (el job falla igual), pero ya no oculta las fallas que importan.
- **(b)** Hook `PostToolUse` (`.claude/hooks/format-on-write.sh`) sobre `Write|Edit`:
  corre `prettier --write` **sólo sobre el archivo tocado**. Es el fix estructural
  (mistake→rule): la deuda no se acumula porque cada escritura sale formateada, y cuesta
  cero tokens. Requisitos del hook, para no romper el turno:
  - Sale `0` **siempre** (es higiene, no un gate): si prettier falla, no ignora el archivo
    o no está instalado, sale 0 en silencio. Un `exit 2` acá bloquearía ediciones válidas.
  - Respeta `.prettierignore`, así no pelea con `settings.local.json` ni con `docs/`.
    **Corrección durante la implementación (verificada, no asumida):** NO se pasa
    `--ignore-path`. En Prettier 3 el default es `{.gitignore, .prettierignore}` y fijar
    la flag perdería el `.gitignore`; sin ella el hook aplica exactamente el mismo
    criterio que `pnpm format:check`. Sí se usa `--ignore-unknown`.
  - **Corre siempre parado en la raíz del repo.** Prettier resuelve `.prettierignore`
    desde el **CWD**, no desde la ruta del archivo: verificado que con `cwd=/tmp` un
    `prettier --write <ruta absoluta>` **reescribe** `.claude/settings.local.json`, es
    decir reintroduce en cada sesión justo la deuda que esta spec saca. El hook hace
    `cd` a la raíz (`CLAUDE_PROJECT_DIR`, con fallback que la busca hacia arriba).
  - **Guard de contención: sólo toca archivos bajo la raíz del repo.** Sin esto el hook
    reformatea código de OTROS proyectos con la config de Prettier de éste si en la
    sesión se edita un archivo de afuera (reproducido por el revisor con `/tmp/...`).
    La comparación normaliza ambos paths (symlinks — en macOS `/tmp` → `/private/tmp`—,
    relativos, `..`, trailing slash); un guard ingenuo daría falsos negativos y dejaría
    un hook decorativo que pasa todas las pruebas negativas sin formatear nada.
  - Se registra **después** de `file-size.sh` en el mismo matcher `Write|Edit`, para que
    el aviso de tamaño siga viéndose.

## Archivos

| Archivo | Acción |
|---|---|
| Los 19 de la tabla (todos menos `.claude/settings.local.json`) | formatear con `prettier --write` |
| `package.json` (root) | editar — agregar script `format` |
| `.github/workflows/ci.yml` | editar — `format:check` pasa al final (decisión (a)) |
| `.claude/settings.json` | editar — registrar el hook de formato (decisión (b)) |
| `.claude/hooks/format-on-write.sh` | crear — hook `PostToolUse` de formato |
| `.prettierignore` | editar — agregar `.claude/settings.local.json` |

### Disjunta?

**Sí.** Es formateo mecánico sobre archivos de specs ya `implementada` (0028, 0031,
0032, 0041, 0045). No toca la spec 0046 (sus archivos ya están formateados) ni ninguna
spec abierta. **Precaución de orden:** conviene correrla cuando no haya otra spec con
cambios sin commitear sobre esos mismos archivos, para que el diff de formato no se
mezcle con un diff de lógica.

## Criterios de aceptación (verificables)

- [ ] `pnpm run format:check` sale **exit 0**, sin archivos en warn.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm run test` y `pnpm run build` siguen
  verdes con los mismos conteos que antes del formateo (el test count no baja).
- [ ] `git diff` de los 19 archivos es **exclusivamente de formato**: cero cambios de
  identificadores, literales, orden de sentencias o lógica. Verificable con
  `git diff --ignore-all-space` acotado y revisión.
- [ ] Ningún archivo formateado supera las 300 líneas del hook `file-size`; si alguno
  las supera, quedó **dividido**, no exceptuado.
- [ ] `pnpm run format` existe y arregla la deuda en un comando.
- [ ] **La corrida de CI del commit de esta spec queda en `success`** — verificable con
  `gh run list --limit 1`. Es el criterio que cierra el problema de fondo.
- [ ] Se aplicó la prevención (c) y está documentada: `format:check` es el último paso de
  `ci.yml` **y** el hook `format-on-write.sh` está registrado en `.claude/settings.json`.
- [ ] El hook de formato está **probado**, no sólo escrito: editar un archivo mal formateado
  lo deja formateado, y un archivo de `.prettierignore` queda intacto.

## Pruebas

- **Automatizada:** los 5 gates de root + `format:check`. La señal que importa no la
  genera el modelo: el commit status de GitHub Actions.
- **Manual:** ninguna. No hay cambio de comportamiento que probar en pantalla; si algo
  se ve distinto en la app, el formateo no fue sólo formateo.

## Notas

- Esta spec no tiene ADR: no hay decisión de arquitectura, es higiene. La única
  decisión abierta (prevención a/b/c) se resuelve dentro de la spec.
- Al terminar, conviene mirar si el CI destapa fallas que estaban ocultas detrás del
  `format:check`: **hace commits que `lint`/`typecheck`/`test`/`e2e`/`build` no corren
  en GitHub**. Localmente están verdes (verificado en la sesión de la spec 0046), pero
  `test:e2e` en particular **nunca se corrió en esta máquina** y podría estar roto sin
  que nadie lo sepa.
