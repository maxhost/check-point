# P1 — entorno local e integración

Registro del coordinador,2026-10-15. P1 se implementa después de R1 aprobado en main local `271dbba682f841b8277093a6431fd3d5408b6231`; base de despacho `3e0ee77f25f3e5447b14ca47d7ddf4bd1d0494ed`. No certifica QA de P1 ni autoriza PROD/push.

## Inventario preparatorio de solo lectura

Node24.20.0, configuración seleccionada externa `local-selected.env` y `localDbUrlOrExit`, sin imprimir variables. DB local:91 migraciones,2 comercios con POS activo,7 órdenes cerradas y2 mappings R1. Agrupación local de fixtures:2 negocios AR/ARS y1 MX/MXN. No se consultó PROD ni se extrapola este inventario a la afirmación del owner sobre comercios reales USD.

Por tanto, el seed local deberá usar lista base para los POS existentes; los7 cierres históricos deben permanecer sin snapshot de pago/comisión inferido. Los mappings R1 y demás historia se conservan. Estas son señales preparatorias mientras implementan A/B; el corte final requiere inventario fresco con writers drenados, migrador protegido y comprobación posterior. No se generó ni aplicó todavía SQL P1 desde coordinación.

Entorno de desarrollo propio levantado tras R1 mediante `pnpm dev:local`; sesión33635. Sigue en dev, con Merchant/Consumer y túnel, sin panel de plataforma configurado. Su reinicio final debe preservar configuración/flags y comprobar health; ningún proceso de worktrees P1 comparte ese servidor.
