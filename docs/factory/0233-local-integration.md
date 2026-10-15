# P1 — entorno local e integración

Registro del coordinador,2026-10-15. P1 se implementa después de R1 aprobado en main local `271dbba682f841b8277093a6431fd3d5408b6231`; base de despacho `3e0ee77f25f3e5447b14ca47d7ddf4bd1d0494ed`. No certifica QA de P1 ni autoriza PROD/push.

## Inventario preparatorio de solo lectura

Node24.20.0, configuración seleccionada externa `local-selected.env` y `localDbUrlOrExit`, sin imprimir variables. DB local:91 migraciones,2 comercios con POS activo,7 órdenes cerradas y2 mappings R1. Agrupación local de fixtures:2 negocios AR/ARS y1 MX/MXN. No se consultó PROD ni se extrapola este inventario a la afirmación del owner sobre comercios reales USD.

Por tanto, el seed local deberá usar lista base para los POS existentes; los7 cierres históricos deben permanecer sin snapshot de pago/comisión inferido. Los mappings R1 y demás historia se conservan. Estas son señales preparatorias mientras implementan A/B; el corte final requiere inventario fresco con writers drenados, migrador protegido y comprobación posterior. No se generó ni aplicó todavía SQL P1 desde coordinación.

Entorno de desarrollo propio levantado tras R1 mediante `pnpm dev:local`; sesión33635. Sigue en dev, con Merchant/Consumer y túnel, sin panel de plataforma configurado. Su reinicio final debe preservar configuración/flags y comprobar health; ningún proceso de worktrees P1 comparte ese servidor.

## Corte local P1 y conservación

Checkpoint combinado `553a9b4dfaffcdc76007286240facaafd0d75277`, Node24.20.0. Se identificó el launcher propio por CWD y descriptor de `tools/dev-local/up.sh` (PID82139), se terminó mediante SIGTERM y su trap retiró apps/túnel. Puerto3201 sin listener antes de inventariar/resguardar; Docker siguió activo. No se detuvo ningún proceso de otro checkout.

Respaldo privado con `pg_dump -Fc`, `/private/tmp/checkpass-p1-local/drained-before-p1.dump`, modo0600,361037bytes, SHA-256 `efbaef5a872501206cb85d33a92f0f4f713c7a7b7898a64fb05cea05fda8dfdd`. `pg_restore -l` leyó el archivo con EXIT0 (730 líneas de índice); no se presenta como ensayo de restauración. Inventario drenado de solo lectura en `drained-before.json`.

El migrador protegido `node --env-file=<local-selected.env> packages/db/src/migrate-local.ts` pasó con93 migraciones totales. Se aplicaron únicamente SQL0091/0092, ya probados en CI y congelados; hashes respectivamente `dd3a6e24a7390aa28999ad03985b989837c698d4714fff25b8a1f354efc15a83` y `0b2a223159935946c29109ae83c064abd3c2e52362b202c6cf3effbb2cd57b7f`. El preflight propio posterior salió0; su `workingTreeDirty:true` incluye assets/skills ajenos sin seguimiento que se preservaron, mientras el diff tracked del checkout estaba vacío.

| Evidencia                                | Antes                                  | Después          |
| ---------------------------------------- | -------------------------------------- | ---------------- |
| Movimientos Stock                        | 27; `7eee2f4ce07ace6d7df4960998416c4d` | 27; misma huella |
| Mappings R1                              | 2; `53f93ce9b8f5c3d3fed9164a6e3c78ba`  | 2; misma huella  |
| Cierres históricos, sin agregar snapshot | 7; `ceae75e58a51716cfe03eaa2e9c6c92c`  | 7; misma huella  |
| Eventos v1                               | 0; `d41d8cd98f00b204e9800998ecf8427e`  | 0; misma huella  |

Inicializados los2 POS activos, uno AR y otro MX, ambos con lista base. Cero activos sin inicialización y cero sin Efectivo. Catálogo12 entradas,11 sugeridas, sin Peigo; pagos/revisiones/comisiones0, sin backfill. Las7 órdenes abiertas y7 cierres históricos permanecen. `MODULE_EVENTS_ENABLED` continúa apagada: el corte no altera el despliegue progresivo ni inventa comisiones positivas conocidas.

Reinicio propio `pnpm dev:local`, sesión66340: Merchant/Consumer disponibles, health de ambos túneles HTTP200. La app local usa el checkpoint P1 en desarrollo; esta evidencia de migración/arranque no sustituye QA financiero ni aceptación final. El candidato corregido y el smoke final se registrarán tras integración.

Smoke HTTP autenticado de la app real en ese checkpoint, sin simular transporte: se comprobó primero host de DB local y proveedor `console` (sin entrega externa), se usó el owner ficticio del seed y se recorrieron login/verify200, GET medios200 con cinco entradas/Efectivo predeterminado y GET catálogo200. La misma ruta sin cookie devolvió401. Se cerró únicamente la sesión del smoke mediante sign-out200. No se creó/cerró ninguna venta ni se modificó configuración comercial. Resultado privado sin cookies/OTP en `authenticated-smoke.json`; no sustituye las pruebas de cierre/comisión en CI.

Comprobación independiente del helper puro extraído por `git archive 4abb4ef1` a `/private/tmp/checkpass-p1-financial-4abb`:17216 casos USD/COP, de los cuales8739 con brutos ya alineados, pasaron HALF_UP de totales, conservación individual de brutos alineados, sumas por línea, cotas y aceptación de builders válidos por el validator. No se atribuye a esa prueba el rechazo del cero falso, cuya regresión es un cambio posterior.
