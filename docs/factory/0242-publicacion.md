# Publicación 0242

Owner autorizó aplicar migraciones de PROD y push a GitHub el 2026-10-19, después del QA manual. Impresión y cliente/descuento pendientes aceptados para revisión posterior; mejoras registradas en `mejoras.md`. R2 y harness diferidos.

El owner autorizó explícitamente publicar con `git push --no-verify` para esta entrega y corregir después del deploy los dos fallos de arquitectura. No representa un PASS de verificación completa ni una excepción para publicaciones posteriores. No se inició ninguna corrección de esos controles antes de publicar.

Respaldo anterior a migraciones en `/private/tmp/checkpass-release-0242-20261019/before-migrations.dump`, privado0600, 451088 bytes, SHA256 `032c85e05fa8344d60db3c11bfebedeb5f3adbd2d96abb98ae364b9c631aa13c`; índice de pg_restore legible. Inventario previo:181 productos,25 órdenesPOS (4abiertas),2 órdenescore,4membresías,4negociosPOS habilitado,0staffcounter sinpos y0staff activo sinPOS habilitado. La revisión de0102–0108 confirmó expansión de precisión/campos, metadatos por defecto, permisos aditivos y sustitución de barreras por checks permanentes; no borrado de órdenes/productos ni activación automática de módulos.

## Migración de producción completada

`pnpm db:migrate:prod` terminó EXIT0:0102–0108 aplicadas en orden por el migrador existente, endpointPROD verificado. Lectura posterior por TCP:109 migraciones,0pendientes por comparación SHA256 con journal,181productos/25órdenesPOS/4abiertas conservados,0órdenes sin clasificación y0barreras legacy deproducto. Huellas completas local/PROD coinciden; `tools/local-db/huellas-prod.txt` actualizado. Evidencia privada `journal-fingerprints.json` de2026-10-19T15:15:59.533Z. La primera inspección posterior por HTTP falló EHOSTUNREACH antes de obtener resultados; se usó la conexión TCP del respaldo, sin reintentar migraciones ni escribir datos para verificar.

Pendiente inmediato: push de main con la excepción explícita y comprobar despliegues de Vercel ligados al SHA publicado. No afirmar deploy por el éxito del push solamente.

## Preflight anterior a la migración

- Base remota confirmada: `90ebe18fe795e11029a11409fbe8167e25b365c4`; main local funcional aprobado: `5c158325aac14618f5f83d6971ff6788bb4a04d4`. Dev agrega documentación, sin diferencias de aplicación respecto de main local.
- PROD inspeccionada sólo en lectura, validando la huella del endpoint: 102 migraciones aplicadas; pendientes 0102–0108. No se aplicó ninguna migración de PROD todavía.
- Numeración documental y UI guard pasan. Dos pruebas de arquitectura reproducidas: 14 casos pasan y 2 fallan; core nombra módulos en cinco archivos y un test de Gastos importa Stock.
- Corrección acotada autorizada por el encargo de publicación: fixtures genéricas en tres tests del contexto; referencia semántica de analytics en su dominio para evitar confundir un handler con un módulo; test de interacción Gastos/Stock ubicado fuera de ambos módulos. No modificar guardias, expectativas ni excepciones para ocultar fallos.
- Conservar servidor 3201, túnel, worktrees y archivos ajenos. No ejecutar builds en el directorio usado por el servidor de QA. Migración y push esperan controles de publicación, revisión del orden de compatibilidad y recuperación de DB antes de ejecutarse.
