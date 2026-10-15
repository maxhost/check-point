# R1 — integración y entorno local

Fecha: 2026-10-15. Registro del coordinador; no sustituye el QA independiente ni autoriza PROD/push. El owner autorizó completar R1 con QA, integrarlo en main local y después hacer lo mismo con P1.

## Esquema local

Desde el checkpoint A `493c0d00ed2545012196b94522ed4b459d802314`, Node24.20.0 y configuración seleccionada externa `/private/tmp/checkpass-specs/local-selected.env`, ejecutado el migrador local protegido:

```
node --env-file=/private/tmp/checkpass-specs/local-selected.env packages/db/src/migrate-local.ts
```

EXIT0,91 entradas de journal. Una lectura posterior contra el mismo destino local comprobó las ocho tablas nuevas de Recetas y coincidencia de los tres hashes SQL/journal:

- 0088: `acce4e2cf65818236000a1384c228650bef27aac837167938e3c91ecfb84eb58`.
- 0089: `ac899ca90c923cc73786524d21c457e88a11905d847d74c9949710dbe04794e2`.
- 0090: `72d3a0329426a74f3a99e3c88b771b5c342f931d905d584cf05f4a9edae52fbf`.

No reset, seed ni cambio de permisos/flags. La alineación del esquema no certifica UI o cobro. La DB de app local es distinta de CI; las pruebas CI no la actualizan.

## Preflight y corte

Ejecutado `node --env-file=/private/tmp/checkpass-specs/local-selected.env tools/recipes-r1/index.ts preflight` desde ese checkpoint: EXIT0, dos productos con receta actual,13 líneas, cero grupos/productos duplicados tanto en catálogo como entre productos con receta. Es una medición real de la DB local, sin extrapolarla a PROD.

El preflight inicial se amplió tras QA. El corte real siguiente usó `4ee5017e5e4e8d47b99eb652661bc390cab2e101`, checkout limpio; `git diff --exit-code 4ee5017e..10b7f6db -- apps packages tools` confirmó identidad del código con el candidato combinado congelado `10b7f6dbcd35532bfb3883354f1d0e4d71525a65`.

Se identificaron PID, parentesco y CWD del lanzador local `tools/dev-local/up.sh` y Merchant del checkout principal; se detuvo ordenadamente ese lanzador. La comprobación posterior dio puerto3201 sin listener y curl000 antes de operar; no había workers ni suscriptores de esa app ejecutándose. DB local permaneció arriba. Backup de datos drenados por `pg_dump -Fc`, privado0600: `/private/tmp/checkpass-r1-local/drained-before-cutover.dump`,358928 bytes, SHA256 `bc0edf3eba9f4ecb41aa435b5c3e4a9d66388e3de43872cf91bc329084fa33b8`. El backup previo también se conservó; `pg_restore --list` verificó731 entradas del archivo, sin restaurarlo ni alterar DB.

Preflight ampliado y `cutover --writers-drained`: EXIT0; migró **2 productos**, verificó equivalencia×1 de ambos y reportó `comparison:{unchanged:true,changed:[]}`. Se conservaron las13 líneas legadas,27 movimientos y9 grupos de cantidad por insumo/local mediante sus huellas exactas. El inventario local tenía0 eventos,0 consumos y0 revisiones legadas; la conservación de snapshots monetarios null/cero/conocidos se prueba en CI, no se atribuye a filas locales inexistentes. Cero duplicados y cero candidatos/renombrados medidos; no se detuvo ni modificó nombre de Catálogo.

Lectura posterior protegida: **2 recetas,13 líneas independientes,2 composiciones,2 resoluciones y2 punteros composition**; puente `recipes_bridge_revision` ausente y0 mappings renombrados. No se alteraron flag de eventos ni puentes Stock EXPAND0227. Fuente del manifiesto y datos de rollout preservados; sin backfill de ventas/dinero/procedencia histórica.

Se reinició el mismo entorno mediante `pnpm dev:local` desde dev. El chequeo de configuración local pasó, Consumer/Merchant levantaron y ambos health por túnel devolvieron **HTTP200**. Panel de plataforma no configurado, como antes. La sesión propia del entorno permanece activa; no equivale a smoke autenticado del POS ni de UI nueva de Recetas (fuera de alcance). Artefactos JSON de preflight/corte y backups quedan privados bajo `/private/tmp/checkpass-r1-local`.
