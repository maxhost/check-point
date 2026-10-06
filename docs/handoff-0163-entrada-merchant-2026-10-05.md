# Handoff — Spec 0163: entrada del merchant sin sesión

Estado: implementado y publicado en `main`; falta revisión independiente. La spec permanece `cerrada`.

## Alcance entregado

- Al abrir `https://business.checkpass.club/` sin cookie de sesión merchant, el servidor responde con redirección a `/es/business/onboarding`.
- Si hay cookie, Better Auth comprueba la sesión. Una cookie inválida o vencida también lleva al onboarding. Una sesión válida conserva la portada de la raíz: el guard del backoffice usa `/` como destino de rebote y enviarla de nuevo al panel podría crear un ciclo.
- El cambio se limita a UI, prueba e2e y documentación. No toca API, servidor, paquetes, migraciones ni tooling.

## Archivos y commits

| Archivo | Cambio |
|---|---|
| `apps/merchant/src/app/page.tsx` | Decide la redirección en el servidor usando `getSessionCookie` y `getSession`. |
| `tests/e2e/merchant-entry.spec.ts` | Comprueba URL final y título del wizard desde un contexto sin sesión. |
| `docs/specs/0163-raiz-del-merchant-abre-onboarding.md` | Contrato, DoD, mutación y gates. |

Spec reservada en `1889b6d`, implementación en `bc8f3fd`, publicación y estado en `37776ae` y `c563517`. `main` y `origin/main` estaban sincronizados al iniciar este handoff.

## Comandos ejecutados y resultado

- `nvm use` → Node 24.20.0.
- `pnpm exec playwright test tests/e2e/merchant-entry.spec.ts` → 1 pasó.
- Mutación M1: destino `/backoffice` → 1 falló en `toHaveURL` por recibir `/backoffice` en vez de `/es/business/onboarding`; se restauró el archivo con hash idéntico y `diff -u` vacío. Bitácora en la spec.
- `pnpm verify` final y hook `pre-push` → `verify: ok` en ambos. Typecheck, lint, formato, unitarios, build y Neon relacionado en verde; e2e global: 179 pasaron y 21 omitidos. Neon relacionado no encontró pruebas aplicables a `page.tsx`.
- `curl -sSI https://business.checkpass.club/` sin cookies → `HTTP/2 307` y `location: /es/business/onboarding` después del push. Esta sonda confirma el destino HTTP en producción, no el comportamiento del wizard con datos reales.
- `git status --short --branch` → árbol limpio después de la publicación.

## DoD y límites para el revisor

- [x] Visitante sin sesión llega al onboarding y ve «Encuentra tu negocio» en e2e local.
- [x] Respuesta HTTP de producción redirige al destino exacto.
- [x] `pnpm verify` y hook de push verdes.
- [ ] Sesión válida y rebotes del guard: la rama se preservó por inspección, sin prueba nueva con identidad real.
- [ ] PASS independiente. El implementador no puede emitirlo ni marcar la spec `implementada`.

Revisar desde la spec y el diff `1889b6d..bc8f3fd`. En particular, probar una sesión válida y una sesión vencida, y comprobar que los rebotes del guard no forman un ciclo. La prueba e2e intercepta `GET /api/onboarding/state` y `GET /api/onboarding/prefill`; no prueba esas APIs ni un alta real. La respuesta pública `/` con `?e=` y sin sesión también termina en onboarding; revisar si el motivo del rebote debe conservarse en una tarea posterior.
