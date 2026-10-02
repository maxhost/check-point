# Handoff — Spec 0122, pase Google Wallet «Trama viva»

Fecha: 2026-10-01 (America/Guayaquil).
Estado: código y assets preparados localmente; publicación y QA real pendientes.

## Archivos tocados

- `apps/consumer/public/wallet-logo-trama-v1.png` — copia versionada del logo circular de marca, 660 × 660.
- `apps/consumer/public/wallet-trama-hero-v1.png` — exportación de la referencia vectorial aprobada, 1032 × 812.
- `scripts/google-wallet/provision-class.mjs` — clase Trama viva, modo `--inspect` de solo lectura, `--apply` explícito, sufijo aislado para QA, verificación de PNG públicos y `PATCH` idempotente de presentación.
- `scripts/google-wallet/provision-class.test.mjs` — pruebas puras de contrato visual, preservación e idempotencia.
- `docs/wallet-go-live.md` — secuencia de deploy, QA, snapshot y publicación.
- `docs/INDEX.md` y `docs/PARQUEADO.md` — estado de la spec y del arte de Wallet.
- `docs/design-explorations/*` y `docs/specs/0122-pase-google-wallet-trama-viva.md` — referencia y contrato aprobados previamente.

## Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `file apps/consumer/public/wallet-logo-trama-v1.png apps/consumer/public/wallet-trama-hero-v1.png` | PNG de 660 × 660 y 1032 × 812. |
| `node --test scripts/google-wallet/provision-class.test.mjs` | 4/4 PASS. |
| `pnpm exec vitest run apps/merchant/src/server/wallet.test.ts` | 7/7 PASS. |
| `pnpm run lint` | PASS. |
| `pnpm run build` | 4/4 tareas PASS. |
| `pnpm run typecheck` después del build | 6/6 PASS. |
| `pnpm exec prettier --check` sobre scripts y documentos de la spec | PASS. |
| `curl -sSI http://127.0.0.1:3004/wallet-logo-trama-v1.png` y hero | Ambos HTTP 200, `Content-Type: image/png` desde Next en modo producción local. |
| `git diff --check` | PASS. |

El primer `pnpm run typecheck` falló porque `.next/types/validator.ts` todavía referenciaba cinco rutas de recuperación retiradas antes de esta spec. `pnpm run build` regeneró los tipos y el segundo `pnpm run typecheck` pasó. No se modificaron esas rutas.

## DoD y límites

- [x] Assets dimensionados, servidos localmente y visualizados; hero sin texto ni iconos sobre el QR.
- [x] Payload de clase y lista fijado por pruebas; `PATCH` conserva callbacks, ubicaciones, mensajes y otros campos no gestionados.
- [x] Sin modificación de la emisión del objeto, QR, enlaces, avisos o Apple Wallet.
- [ ] PNG públicos desde `https://my.checkpass.club/` después del despliegue.
- [ ] Clase de QA aislada y prueba de lista, pase abierto y detalle en Android real.
- [ ] Lectura/snapshot, actualización y revisión de la clase real, más verificación de un pase ya guardado y uno nuevo.
- [ ] PASS de revisor independiente para marcar la spec `implementada` según `docs/AGENT-WORKFLOW.md`.

La Loyalty Class real **no fue modificada**. El provisionador requiere `--apply` y comprueba que los PNG respondan por HTTPS antes de escribir. Los pasos de QA, rollback y publicación están en `docs/wallet-go-live.md`. No se imprimieron ni copiaron credenciales ni tokens de pase.
