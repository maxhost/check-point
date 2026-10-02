# Handoff — Spec 0130, pase PWA «Trama viva»

Fecha: 2026-10-02. Estado: implementación local verificada; QA móvil y PASS independiente pendientes.

## Decisión del owner

El owner aprobó la composición de la [maqueta](design-explorations/pwa-pase-trama-viva.html) y aclaró que la pestaña debe mostrar un solo CTA de Wallet según el SO, con la marca correspondiente. La [spec 0130](specs/0130-pase-pwa-trama-viva.md) quedó cerrada antes de editar código.

## Cambios

- `qr-tab.tsx` muestra el hero y logo Trama viva en cabecera, con el QR intacto en una sección blanca separada. El CTA aparece desde el primer render, antes del aviso de notificaciones.
- `wallet-shell.tsx` ya no condiciona el CTA de la pestaña a una segunda apertura. El popup de Wallet y su condición de apertura siguen presentes.
- `wallet-cta.tsx` conserva el enlace único por `isIos` y reemplaza el glifo privado de Apple por un SVG. Google conserva su marca y destino.
- `wallet.css` define la tarjeta responsiva y mantiene el QR sobre blanco en claro/oscuro.
- `page.tsx` ajusta la firma de props para cumplir el tipo `PageProps` generado por Next 16; tres llamadas de test pasan `{}`. No cambia la lógica de sesión.

## Comandos y resultado

- `pnpm exec vitest run 'apps/consumer/src/app/(consumer)/wallet/qr-tab.test.ts' 'apps/consumer/src/app/(consumer)/wallet/page-no-session.test.ts' apps/consumer/src/server/wallet-account-opened.test.ts` — 3 archivos, 8 tests verdes.
- `pnpm --filter @mi-pasaporte/consumer typecheck` — verde.
- `pnpm exec eslint` sobre los TS/TSX tocados — verde.
- `pnpm --filter @mi-pasaporte/consumer exec next build --webpack` — compilación, TypeScript y rutas completos, verde.
- `pnpm --filter @mi-pasaporte/consumer build` — Turbopack falla al abrir un puerto interno del proceso CSS (`Operation not permitted`) en este entorno, incluso fuera del sandbox. El mismo código compiló con Webpack.
- `pnpm exec prettier --check` sobre los archivos tocados — verde tras formatear `wallet.css`.

## DoD y pendientes

- [x] El test de render conserva literalmente el SVG de prueba y verifica un solo CTA con destino y marca por plataforma.
- [x] Build de producción con Webpack, typecheck, lint y tests afectados pasan.
- [ ] Abrir en iPhone y Android reales, en PWA instalada y navegador; probar 320 px, letra grande y tema oscuro.
- [ ] Escanear el QR de una cuenta de QA en mostrador y verificar Apple/Google Wallet desde sus dispositivos respectivos, sin compartir el token.
- [ ] Revisor independiente emite PASS. Hasta entonces la spec permanece `cerrada`, no `implementada`.

El arte de la maqueta usa un QR ficticio. La pestaña real conserva el QR de la cuenta generado por servidor. No se tocó emisión de pases nativos, API, token ni base de datos.
