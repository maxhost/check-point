# Publicación 0242

Owner autorizó aplicar migraciones de PROD y push a GitHub el 2026-10-19, después del QA manual. Impresión y cliente/descuento pendientes aceptados para revisión posterior; mejoras registradas en `mejoras.md`. R2 y harness diferidos.

## Preflight

- Base remota confirmada: `90ebe18fe795e11029a11409fbe8167e25b365c4`; main local funcional aprobado: `5c158325aac14618f5f83d6971ff6788bb4a04d4`. Dev agrega documentación, sin diferencias de aplicación respecto de main local.
- PROD inspeccionada sólo en lectura, validando la huella del endpoint: 102 migraciones aplicadas; pendientes 0102–0108. No se aplicó ninguna migración de PROD todavía.
- Numeración documental y UI guard pasan. Dos pruebas de arquitectura reproducidas: 14 casos pasan y 2 fallan; core nombra módulos en cinco archivos y un test de Gastos importa Stock.
- Corrección acotada autorizada por el encargo de publicación: fixtures genéricas en tres tests del contexto; referencia semántica de analytics en su dominio para evitar confundir un handler con un módulo; test de interacción Gastos/Stock ubicado fuera de ambos módulos. No modificar guardias, expectativas ni excepciones para ocultar fallos.
- Conservar servidor 3201, túnel, worktrees y archivos ajenos. No ejecutar builds en el directorio usado por el servidor de QA. Migración y push esperan controles de publicación, revisión del orden de compatibilidad y recuperación de DB antes de ejecutarse.
