---
spec: 0048
fecha: 2026-09-02
estado: cerrada
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

**RESUELTO (2026-09-02): los tests están sanos. Se corrieron localmente con browser real
por primera vez.** Era la incógnita que bloqueaba esta spec, y la respuesta es buena:

```
Running 6 tests using 4 workers
  ✓ platform exposes its health contract        (40ms)
  ✓ consumer exposes its health contract        (37ms)
  ✓ merchant exposes its health contract        (38ms)
  ✓ owner changes the analytics demo sector...  (716ms)   ← el que fallaba en CI
  ✓ owner activates and deactivates a stamp...  (907ms)   ← el que fallaba en CI
  -  programa de fidelización real › ...                   (skipped, ver abajo)
  1 skipped, 5 passed (5.3s)
```

Los 2 que el CI daba por rojos **pasan**: era exclusivamente el browser faltante. El fallo
es de infraestructura del runner y no había ninguna falla real de test detrás.

**Descubrimiento colateral: el caché de browsers YA ESTABA en la máquina de desarrollo**
(`~/Library/Caches/ms-playwright` con `chromium_headless_shell-1200`, exactamente el build
que el runner reclamaba). Estos tests se podían correr en local desde siempre; lo que
faltaba era correrlos. Lo que impidió correrlos hoy no fue Playwright: eran los puertos
**3000** y **3001** ocupados por dev servers de **otros proyectos** (`next dev` de
`gym-app` y `55mas`), contra los que la suite choca con `EADDRINUSE` y aborta antes de
ejecutar un solo test. Los puertos son fijos en los scripts `dev` (consumer 3000, merchant
3001, platform 3002). Es fricción local conocida, no un problema de CI (allá siempre están
libres), pero conviene saberlo antes de perder media hora diagnosticando Playwright.

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

## Diseño

Un step nuevo en `.github/workflows/ci.yml`, antes de `- run: pnpm test:e2e`:

```yaml
- run: pnpm exec playwright install --with-deps chromium
```

Las tres decisiones que estaban abiertas, cerradas con evidencia:

1. **Qué se instala: sólo `chromium`.** `playwright.config.ts` no declara `projects`, así
   que corre con el default de Playwright, que es chromium. Confirmado por la corrida
   local: los 5 tests que se ejecutan usan chromium, y el error del runner pedía
   `chromium_headless_shell`. `playwright install chromium` baja el headless shell junto
   al chromium completo (verificado en el caché local: conviven `chromium-1200` y
   `chromium_headless_shell-1200`). Instalar los tres browsers sería regalar minutos de CI
   en cada push por dos que nadie usa. `--with-deps` sí hace falta: el runner de Ubuntu no
   trae las libs del sistema que chromium necesita.
2. **Caché: NO entra en esta spec.** `actions/cache` sobre `~/.cache/ms-playwright`
   ahorraría ~20-30s por corrida, pero agrega una pieza que puede dar **falsos verdes** si
   la key queda vieja respecto de la versión de Playwright — y el problema que estamos
   arreglando es justamente un CI que mentía. Primero verde y confiable; la optimización
   se mide después, cuando haya un tiempo de corrida real contra el cual comparar.
3. **`loyalty-real.spec.ts` no es un gate que no gatea: es opt-in deliberado.** Se saltea
   con una condición explícita y documentada en el propio archivo — requiere
   `E2E_MERCHANT_BASE_URL`, `E2E_MERCHANT_EMAIL`, `E2E_MERCHANT_PASSWORD` y
   `E2E_LOYALTY_MUTATION_TEST=true`, con el motivo escrito: *"requiere owner de prueba
   nuevo y aislado de la rama de desarrollo"*. Es un test que **muta datos reales**, apagado
   a propósito salvo que alguien lo encienda. **No se enciende en CI**: sin owner de prueba
   aislado, correrlo escribiría contra un entorno real desde cada push. Que quede skippeado
   es la conducta correcta, no deuda. (Es el único `skip` de toda la suite — verificado con
   `grep -rn skip tests/e2e/`.)

## Archivos

| Archivo | Acción |
|---|---|
| `.github/workflows/ci.yml` | editar — step de instalación de browsers (+ caché si se decide) |

### Disjunta?

**Sí.** Toca un solo archivo, y ninguna otra spec abierta lo toca.

## Criterios de aceptación (verificables)

- [ ] `pnpm test:e2e` corre en CI con browser real: cero errores `browserType.launch:
  Executable doesn't exist`.
- [x] Se sabe y está escrito **qué hace cada uno de los 6 tests**: 5 pasan (3 de health +
  analytics + loyalty), 1 se saltea por opt-in deliberado (`loyalty-real`, muta datos
  reales). Ninguno queda en "no sé". **Verificado corriéndolos, no leyéndolos.**
- [ ] Los steps `pnpm build` y `pnpm format:check` **llegan a ejecutarse** (hoy no llegan).
- [ ] La corrida de CI del commit de esta spec queda en `success`
  (`gh run list --limit 1`). Si no se puede sin tocar tests, la spec vuelve a `borrador`
  con el hallazgo en vez de forzar el verde.
- [ ] Ningún test e2e fue editado ni borrado para conseguir el verde.

## Pruebas

- **Automatizada:** la corrida de GitHub Actions. Es la única señal que vale para el
  criterio de verde, porque el fallo es específico del runner limpio y **no se reproduce en
  local** (acá los browsers ya están descargados). La corrida local **sí es evidencia** de
  otra cosa distinta y necesaria: que los tests en sí funcionan (5/5 verdes), así que si el
  CI sigue rojo después de este cambio, la causa está en el runner, no en los tests.
- **Manual:** ninguna.

## Notas

- Sin ADR: no hay decisión de arquitectura, es infraestructura de CI.
- Esta spec es la razón por la que la 0047 no pudo cerrar su último criterio de
  aceptación ("la corrida de CI queda en `success`"). Ese criterio se cierra acá.
