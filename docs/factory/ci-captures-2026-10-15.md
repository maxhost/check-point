# Entrega ci-capture-fix-20261015

- Base `dev`: `7531ae9d2f16cfbdb4894fa101ab5e6d7f83e118`.
- Commit de la corrección: `5a3095f1dad60e699768497003fd799485287541`.
- Rama/worktree: `factory-ci-capture-fix-20261015`, `/private/tmp/checkpass-ci-capture-fix-20261015/factory-ci-capture-fix-20261015`.
- Scope: `tests/e2e/brand-fiscal.spec.ts` y este handoff.

## Causa y cambio

La CI de `7531ae9d` falló en los casos fiscales de 390/1280 px al guardar capturas con rutas absolutas `/private/tmp/...` ajenas al runner de GitHub (run `38775662386`). El archivo ahora recibe `testInfo` del runner y construye sus cuatro rutas con `testInfo.outputPath`, siguiendo el patrón existente de `billing-ui` y `counter-mobile`.

Mantiene los nombres de los archivos, las cuatro capturas por ancho (sección/página, claro/oscuro), todas las aserciones, fixtures, tiempos y configuración de retries. No cambió código de producto ni se crearon directorios globales para sostener la ruta anterior. Se esperan ocho capturas bajo el `outputDir` de Playwright al ejecutar ambos anchos.

## Evidencia y pendiente browser

Node `v24.20.0`; comandos precedidos de `source ~/.nvm/nvm.sh && nvm use`.

- `pnpm exec prettier --write tests/e2e/brand-fiscal.spec.ts`: formato correcto.
- `pnpm exec eslint tests/e2e/brand-fiscal.spec.ts`: exit 0.
- `git diff --check`: correcto.

Al congelar esta entrega no se ejecutó browser: el coordinador conserva los puertos 3100/3101/3102 para la suite completa de 461 casos. La comprobación focal de los cuatro casos fiscales queda pendiente de que libere y asigne esos recursos; se ejecutará sobre el mismo SHA, sin mutar fuentes, con `--retries=0 --workers=1`, solo la configuración seleccionada `/private/tmp/checkpass-release-20261015/verification.env` mediante `parseEnv`, `NODE_PATH` propio y `WATCHPACK_POLLING=true`.

El resultado focal y los ocho paths reales de capturas se comunicarán al coordinador después de ejecutarlo. Este handoff no declara PASS funcional ni capturas existentes antes de esa comprobación. Sin DB, puertos tomados, servidores propios, push ni operaciones PROD. Siguiente paso: QA estática y posterior foco browser cuando el coordinador libere los puertos.
