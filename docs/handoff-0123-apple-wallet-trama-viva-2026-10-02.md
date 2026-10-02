# Handoff — Spec 0123

Estado: implementación local preparada; QA de iPhone y PASS independiente pendientes.

## Archivos tocados

- `packages/domain/src/server/wallet/apple.ts`, `apple-art.ts`, `pass-version.ts`:
  arte firmado, contacto y revisión de marca.
- `packages/domain/scripts/generate-apple-art.mjs`: generación reproducible de nueve
  PNG a partir del logo de Google y el vector Apple aprobado.
- `apps/merchant/src/server/wallet.test.ts`: estructura del paquete, dimensiones,
  hashes, QR, enlace y contacto.
- `docs/specs/0123-pase-apple-wallet-trama-viva.md`,
  `docs/wallet/apple-wallet-design-and-release.md` y registros de proyecto:
  decisión, publicación y límites.
- `docs/design-explorations/apple-wallet-trama-viva.html` y sus fuentes: arte y
  maqueta aprobada. El QR de la maqueta es ficticio.

## Comandos ejecutados y resultado

- `node scripts/generate-apple-art.mjs` desde `packages/domain` — generó nueve assets.
- `pnpm exec vitest run apps/merchant/src/server/wallet.test.ts` — 7/7 tests pasan.
- `pnpm run typecheck` — 6/6 paquetes pasan.
- `pnpm run lint` — pasa.
- `pnpm run build` — 4/4 builds pasan, incluidos consumer y merchant.
- `pnpm exec prettier --check` de archivos tocados — pasa.
- `git diff --check` — pasa.

## DoD

- [x] Paquete local incluye icono, logo y `strip` a 1x/2x/3x y hashes para cada PNG.
- [x] QR y rutas de identidad preservados; contacto público en reverso.
- [x] Revisión de marca posterior a la anterior para PassKit.
- [ ] QA en iPhone firmado confirma el `strip`, QR y pase nuevo/anterior.
- [ ] Despliegue y refresco APNs de pases ya instalados.
- [ ] Revisor independiente emite PASS.

## Hallazgos y límites

- La prueba firma con certificado propio de desarrollo y valida la estructura; ese
  paquete no se instala en un iPhone real.
- Las fuentes oficiales de Apple discrepan sobre `strip` en iOS 26/27. La decisión
  visual está aprobada, pero el comportamiento real en iOS reciente requiere QA.
- El cambio de código local no actualiza automáticamente un pase ya guardado.
  Después del despliegue se debe encolar un `pass_refresh` silencioso y verificar
  una descarga PassKit en un dispositivo de QA antes del lote general.
