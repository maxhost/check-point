# Handoff — Mostrador móvil y veredicto automático del cupón

Fecha: 2026-10-04. Checkout de GPT: `~/Documents/claude-workspace/check-point/`, rama `main`.

## Estado de publicación

- `origin/main` está en `1927742`. Ese único push contiene el servidor 0153 de Claude (`motor` `8a635b0`), la UI móvil 0152 (`d30136f`) y la UI del cupón 0154 (`eaa03b3`).
- El owner confirmó que el deploy de Vercel de `1927742` terminó. No se hizo QA real todavía.
- `docs/estado/gpt.md` y `docs/INDEX.md` registran la publicación y el deploy en el commit **local** `313faa3`. Este handoff también queda local para conservar `1927742` como SHA desplegado. No pushear documentación antes del QA sin considerar que un nuevo push cambiaría el SHA de Vercel.
- Las specs 0152 y 0154 siguen `cerradas`. Faltan QA físico, PASS independiente de la UI y resolver el build de Turbopack antes de marcarlas `implementadas`.

## Qué quedó hecho

- 0152: en teléfono, escaneo y vistas de venta/canje ocultan la navegación inferior; la X vuelve al inicio del mostrador. La venta detallada aprovecha el ancho móvil y deja visibles las acciones del footer.
- 0154: M0/M1 muestran `couponState.selected.verdict` verde o rojo con el `message` literal; se quitó M2/«Validar»; «Quitar» funciona para todo cupón elegido; M4 manda el cupón solo si está verde. En detallada, un cupón válido con producto fijo agrega 1 unidad gratis o 2 para 2x1 una vez por escaneo. El ticket separa unidades de venta y extras del cupón.
- No se modificó el servidor desde el checkout de GPT. Contrato rector: `docs/specs/0153-contratos-de-api.md`; decisión: `docs/adr/0120-el-sistema-valida-el-cupon-no-el-comercio.md`.

## Verificación y excepción

Node 24.20.0. `pnpm verify` pasó typecheck, lint, formato, unitarios, e2e (115 pasaron, 5 omitidos), Neon merchant (410 pasaron, 25 omitidos) y Neon consumer (60 pasaron). Las cuatro e2e nuevas de la 0154 pasaron; capturas verde y roja de 390 px revisadas. Build Webpack de merchant verde.

`pnpm verify` quedó **rojo solo en build Turbopack**: `Operation not permitted` al abrir un puerto interno al procesar `business/onboarding/onboarding.css`, incluso fuera del sandbox. El owner autorizó expresamente `git push --no-verify` para el único push conjunto `1927742`. No se debe generalizar esa excepción a futuros pushes.

## QA pendiente del owner

1. En Panadería, elegir «Café americano gratis» desde la cuenta del cliente. Escanear: ver ✓ verde y ningún botón «Validar». Cerrar con X y volver a escanear: el cupón debe seguir elegido.
2. Entrar a Venta detallada: el café aparece una vez en el carrito. Confirmar y comprobar que el ticket muestra el café bonificado y el total devuelto por el servidor.
3. Elegir un cupón vencido: ver ✗ rojo con «Este cupón venció el …» y usar «Quitar». Comprobar también que Venta rápida muestra el veredicto.
4. Revisar en teléfono la X, la ausencia de navegación inferior en escaneo/venta/canje y los botones «Cancelar» y «Acreditar compra» en el footer detallado.

## Al retomar

Leer `AGENTS.md`, `docs/TRABAJO-EN-PARALELO.md` y `docs/estado/gpt.md`. Correr `nvm use`, `git status`, `git pull --ff-only` y `pnpm ci:status` según la rutina. El checkout local tiene commits de documentación por encima de `origin/main`; si el remoto avanzó y `pull --ff-only` no puede avanzar, conservarlos y coordinar el rebase. Registrar resultados de QA en la spec correspondiente; resolver hallazgos antes de marcar `implementada`. Las suites Neon solo se corren con `tools/neon-test.sh`, nunca contra `DATABASE_URL` (producción).
