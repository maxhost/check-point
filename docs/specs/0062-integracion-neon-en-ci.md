---
spec: 0062
fecha: 2026-09-10
estado: implementada
resumen: Los 27 archivos `.neon.integration` pasan a correr en CI contra una rama Neon persistente `ci-integration`, con un paso que FALLA si el secret falta, para que un "skipped" no pueda volver a parecer un "passed".
disjunta: sí
archivos: `.github/workflows/ci.yml`, secrets del repo en GitHub, rama Neon `ci-integration`
---

# 0062 — La integración Neon corre en CI

## Problema

**Hoy se puede borrar un guard de producción con los 5 gates en verde.** Demostrado por
mutación en la spec 0061: sacando `eq(locations.status, "active")` de
`assertLocationInBusiness`, `pnpm run test` da 506/506 verde. El único oráculo de ese guard
—y de todos los invariantes de dinero y concurrencia del repo— son los 27 archivos
`.neon.integration`, que se auto-skipean sin `NEON_INTEGRATION_DATABASE_URL` +
`NEON_INTEGRATION_ISOLATED=true`. `.github/workflows/ci.yml` no las setea. Y un "skipped" se
ve exactamente igual que un "passed" desde afuera.

No lo introdujo la 0061: es la convención preexistente de todo el repo (tarea 51).

## Decisión del owner (2026-09-10)

«Completá la tarea 51.» La ejecución se hace ahora.

## Diseño

- **Una rama Neon persistente, `ci-integration`** (`br-icy-hat-axsfqc8k`), hija de `main`.
  *Alternativa descartada por el orquestador, vetable:* una rama efímera por corrida con la
  GitHub Action oficial de Neon. Es más limpia (aislamiento total, borrado automático) pero
  exige una **API key de Neon** como secret, que el orquestador no tiene ni puede sacar del
  MCP. Con una rama persistente todo lo hace el orquestador: crearla, sacar su connection
  string y cargarla en GitHub. Si el owner crea la API key, migrar a efímera-por-corrida es
  un cambio chico de `ci.yml`.
- **Dos secrets en GitHub:** `NEON_CI_DATABASE_URL` (pooled, para los tests) y
  `NEON_CI_DATABASE_URL_UNPOOLED` (para `drizzle-kit migrate`, que necesita el host sin
  `-pooler`).
- **`concurrency: { group: ci-integration, cancel-in-progress: false }`** — la rama es
  compartida; dos jobs a la vez se pisarían los `FOR UPDATE` y el estado. Se serializan.
- **Migrar la rama de CI en cada corrida**, antes de los tests: nace de `main` y queda atrás
  con cada migración nueva. `drizzle-kit migrate` aplica solo las pendientes.
- **Un paso que FALLA FUERTE si el secret no llegó.** Es el corazón de la spec: sin él, un
  secret borrado o mal escrito devolvería el repo al estado anterior —integración skipeada,
  gates verdes— sin que nadie lo note. El "skipped" no puede volver a disfrazarse.

**Límite declarado, y por qué es real:** en `pull_request` desde un **fork**, GitHub no
entrega secrets, así que ese paso fallaría. Hoy el repo no recibe PRs de forks; si un día
los recibe, el paso se condiciona a `github.event_name == 'push'`. Se deja como está a
propósito: preferible un rojo explicable a un skip silencioso.

## Cierre — verificado en la corrida real de CI (2026-09-10)

Corrida `34529269621` sobre `a335e28`, `success`. **La evidencia es el resumen de vitest en
el log, no el check verde ni un parser propio:**

| Dónde | Resultado |
|---|---|
| **CI** (`Unit + integracion Neon`) | `Test Files 99 passed (99)` · **`Tests 678 passed (678)` — cero skipped** |
| Local, sin Neon, mismo commit | `Tests 521 passed \| 157 skipped` |

Los **157** tests que se auto-skipeaban son exactamente los que ahora corren en CI. Los 33
archivos `.neon.integration` (los 27 previos + los 5 de la 0061 + `consumer/programs`)
muestran `✓` con conteo y tiempo; **ninguno `↓ skipped`**. Por la API de jobs, los tres
pasos nuevos dan `completed / success`: el guard del secret, `Migrar la rama Neon de CI`
(`migrations applied successfully`) y `Unit + integracion Neon`.

**Costo medido:** la integración tardó 49 s (20:56:35 → 20:57:24). Tolerable en cada push.

**Trampa propia, anotada para quien lea el log después:** un primer extracto con `awk`
reportó «0 passed / 0 skipped» porque los códigos ANSI y los tabs del log desplazan las
columnas; y un `grep -c error` sobre el paso guardia contó **1** — era el texto `::error::`
del propio script, no una falla. **Para leer un log de Actions: `sed 's/\x1b\[[0-9;]*m//g'`
primero, y la conclusión de un paso se lee de `actions/runs/<id>/jobs`, no de un grep.**

**`ci-integration` (`br-icy-hat-axsfqc8k`) es INFRAESTRUCTURA, no una rama efímera.** No
entra en ninguna limpieza de ramas: borrarla rompe CI en el siguiente push (el guard
fallaría fuerte, que es lo correcto — pero sería un rojo evitable).

## Definition of Done

- [x] Una corrida de CI en `main` muestra los `.neon.integration` **corriendo** — con
      `passed`, no `skipped` — verificado leyendo el log real de la corrida, no el check
      verde.
- [x] El paso de guardia falla si el secret está ausente (se verifica leyéndolo; probarlo
      borrando el secret en prod de CI no vale la pena por el costo de una corrida rota).
- [x] La migración corre en CI antes de los tests sin error.
- [x] Los 5 gates locales siguen verdes; `format:check` acepta el `ci.yml`.

## Plan de pruebas y verificación

- [x] `gh run view <id> --log` de la corrida que introduce esto: buscar los archivos
      `.neon.integration` y confirmar `✓` con conteo de tests, y **cero `↓ skipped`** en
      ellos.
- [x] `gh api repos/maxhost/check-point/commits/<sha>/status` en `success`.

## Abierto

Nada.
