# Mesas 0187 — merge local a main

Owner autorizó el merge el 2026-10-10. Árbol limpio al empezar; fetch confirmó
`main` y `origin/main` en `9405c93`, ambos ancestros de `dev`. No se hizo push.

## Verificación ejecutada

Node 24.20.0, `pnpm verify` contra `origin/main`, 16 archivos antes del ajuste
de la prueba. Los gates de código pasaron. E2E inicialmente no pudo iniciar
porque `pnpm dev:local` ya tenía Next activo en el mismo checkout. Se detuvo
temporalmente ese ambiente y se repitió únicamente el check E2E.

| Gate | Resultado real |
| --- | --- |
| Typecheck | 0; seis paquetes |
| Lint | 0; global |
| UI guard | 0; seis archivos, sin aumentos |
| Format check | 0; global |
| Unitarias | 2458 passed; suites de integración omitidas en esta fase |
| Build | 0; cuatro paquetes |
| Neon relacionadas merchant | 4/4 passed; base aislada de CI |
| Neon relacionadas consumer | Omitidas: ningún cambio del consumer |
| E2E final | 298 passed, 21 skipped, 1.3 minutos; salida 0 |

La primera corrida E2E real pasó 297 pruebas y falló una de impresión: el
baseline de red se capturaba antes de la nueva consulta de mesas al abrir la
orden. Commit `869e65c` agrega el mock de mesas y espera exactamente una lectura
inicial antes del baseline. Conserva la igualdad estricta de lecturas durante
ambos toques de impresión y el control del gesto de usuario. Sin cambios en
el módulo de impresión, API, servidor, kit ni producto. Lint y formato de esa
prueba en 0; 15/15 pruebas de impresión y después E2E completo en 0.

Son gates acumulados reales: `pnpm verify` original devolvió ROJO por el arranque
E2E y se completó ese gate con las corridas posteriores. No se afirma una segunda
corrida completa de verify. Las suites omitidas no cuentan como aprobadas.
`ci:status` no accedió a GitHub; fetch sí confirmó el estado remoto.

Logs locales:

- `/private/tmp/0187-pre-main-verify.log`
- `/private/tmp/0187-pre-main-e2e.log`
- `/private/tmp/0187-pre-main-printing.log`
- `/private/tmp/0187-pre-main-e2e-final.log`

## Resultado

Merge `--ff-only` local ejecutado: `main` de `9405c93` a `869e65c`.
El registro de cierre se commitea en dev y se incorpora a main por otro
fast-forward de documentación. Se deja checkout main para QA local del owner
y se vuelve a levantar el ambiente local. Sin push ni publicación en live.

No se migró PROD: 0067/0068 ya estaban aplicadas según el encargo y estado de
Claude. El wrapper de pruebas solo verificó/migró la rama aislada de CI.
