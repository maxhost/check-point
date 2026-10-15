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

Pendiente ampliar las señales del preflight según la spec y ejecutar el corte tras retirar los writers viejos y verificar el candidato combinado. No se ha ejecutado `cutover` ni se ha declarado equivalencia de datos antes/después todavía.
