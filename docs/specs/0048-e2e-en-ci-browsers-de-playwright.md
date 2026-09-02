---
spec: 0048
fecha: 2026-09-02
estado: borrador
resumen: El job de CI falla en `pnpm test:e2e` porque el workflow nunca instala los binarios de browser de Playwright (`pnpm install` trae el paquete, no los browsers). Destapado por la spec 0047, que sacó el `format:check` del primer paso y dejó que el CI corriera de verdad por primera vez.
disjunta: si
archivos: .github/workflows/ci.yml
---

# 0048 — e2e en CI: los browsers de Playwright no se instalan

> Deuda **destapada** (no causada) por la spec 0047. Mientras `pnpm format:check` era el
> primer step del workflow, el job moría ahí y `test:e2e` nunca llegaba a ejecutarse.
> Con 0047 el CI por fin corre, y lo primero que muestra es esto. Se levanta como spec
> separada por la regla de `CLAUDE.md`: nada de arreglos silenciosos fuera de alcance.

## Problema

**El CI de `main` está rojo en `pnpm test:e2e`.** La corrida `33575852432` (commit
`8e0d7c0`, spec 0047) da:

```
Run pnpm lint       ✓
Run pnpm typecheck  ✓
Run pnpm test       ✓
Run pnpm test:e2e   ✗   ← corta acá
Run pnpm build      -   (nunca corre)
Run pnpm format:check -  (nunca corre)
```

Salida real del step que falla:

```
Running 6 tests using 1 worker
Error: browserType.launch: Executable doesn't exist at
  /home/runner/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell
Looks like Playwright Test or Playwright was just installed or updated.
Please run the following command to download new browsers: pnpm exec playwright install
2 failed
3 passed (10.6s)
```

**Causa (verificada, no inferida):** `grep -n playwright .github/workflows/*.yml` no
devuelve **ninguna** línea — el workflow nunca corre `playwright install`.
`pnpm install --frozen-lockfile` instala el **paquete** `@playwright/test@1.57.0`, pero
los binarios de browser se descargan aparte, a `~/.cache/ms-playwright`. En un runner
limpio ese caché está vacío.

Los 3 tests que pasan son los que no abren browser; los que fallan son los que sí
(`analytics.spec.ts`, `loyalty.spec.ts`, `loyalty-real.spec.ts` usan `page`).

**Nota importante sobre el estado real de los e2e:** este fallo es de **infraestructura
del runner**, no dice nada sobre si los tests pasan. Nunca se ejecutaron con browser: ni
en CI (tapados por el `format:check`) ni en esta máquina. Que arreglar la instalación deje
el CI verde **no está garantizado** — puede destapar fallas reales de los propios tests.
Eso es información que hoy no tenemos y que esta spec va a producir.

## Alcance

**Entra:**
- Que el workflow instale los browsers que los tests necesitan, antes de `pnpm test:e2e`.
- Dejar la corrida de CI de `main` en `success`, o —si los e2e fallan por razones reales—
  documentar cada falla con evidencia y decidir explícitamente qué se hace con ella.

**No entra:**
- Reescribir o borrar tests e2e para conseguir verde (lo prohíbe `CLAUDE.md`). Un test
  rojo se arregla o se discute; no se edita para que el gate pase.
- Los warnings de deprecación de Node 20 en las actions (`actions/checkout@v4` etc.) —
  siguen siendo su propia tarea, heredada del "No entra" de la 0047.
- Cambiar `playwright.config.ts`, salvo que la investigación demuestre que ahí está el
  problema (y en ese caso vuelve a `borrador` con el hallazgo).

## Diseño (a cerrar)

Un step nuevo en `.github/workflows/ci.yml`, antes de `- run: pnpm test:e2e`. Decisiones
abiertas, a resolver con evidencia, no por costumbre:

1. **Qué se instala.** `playwright install --with-deps chromium` (sólo el browser que se
   usa) vs `--with-deps` (los tres). Hay que **verificar qué proyectos declara
   `playwright.config.ts`** — hoy no declara `projects`, así que usa el default; confirmar
   contra qué browser corre de verdad antes de elegir. Instalar de más es minutos de CI
   regalados en cada push; instalar de menos es el mismo error con otro nombre.
2. **Caché.** `~/.cache/ms-playwright` con `actions/cache` keyeado por la versión de
   Playwright del lockfile. Baja el tiempo de cada corrida, pero suma una pieza que puede
   dar falsos verdes si la key queda vieja. Decidir si entra ahora o después.
3. **`loyalty-real.spec.ts` toca DB.** Verificar si necesita `DATABASE_URL` en CI y qué
   hace hoy sin ella (¿se salta, o falla?). De los 6 tests, 3 pasaron y 2 fallaron: falta
   **1**, probablemente skippeado — confirmar qué pasa con ese, porque un test que se
   auto-saltea en silencio es un gate que no gatea.

## Archivos

| Archivo | Acción |
|---|---|
| `.github/workflows/ci.yml` | editar — step de instalación de browsers (+ caché si se decide) |

### Disjunta?

**Sí.** Toca un solo archivo, y ninguna otra spec abierta lo toca.

## Criterios de aceptación (verificables)

- [ ] `pnpm test:e2e` corre en CI con browser real: cero errores `browserType.launch:
  Executable doesn't exist`.
- [ ] Se sabe y está escrito **qué hace cada uno de los 6 tests** en CI: pasa, falla o se
  saltea, y por qué. Ningún test queda en "no sé".
- [ ] Los steps `pnpm build` y `pnpm format:check` **llegan a ejecutarse** (hoy no llegan).
- [ ] La corrida de CI del commit de esta spec queda en `success`
  (`gh run list --limit 1`). Si no se puede sin tocar tests, la spec vuelve a `borrador`
  con el hallazgo en vez de forzar el verde.
- [ ] Ningún test e2e fue editado ni borrado para conseguir el verde.

## Pruebas

- **Automatizada:** la corrida de GitHub Actions. Es la única señal que vale acá — el
  fallo es específico del runner limpio y **no se reproduce en local**, donde los browsers
  ya están descargados. Correr los e2e en esta máquina es útil como información pero **no
  es evidencia** de que el CI queda verde.
- **Manual:** ninguna.

## Notas

- Sin ADR: no hay decisión de arquitectura, es infraestructura de CI.
- Esta spec es la razón por la que la 0047 no pudo cerrar su último criterio de
  aceptación ("la corrida de CI queda en `success`"). Ese criterio se cierra acá.
